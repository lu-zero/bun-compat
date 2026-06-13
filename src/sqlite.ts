import { DatabaseSync, type StatementSync } from "node:sqlite";

type SqliteValue = string | number | bigint | Uint8Array | boolean | null;

type SqliteInputValue = string | number | bigint | Uint8Array | null;

type SqliteRow = Record<string, SqliteValue>;

function toInput(v: SqliteValue): SqliteInputValue {
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function toInputs(params: SqliteValue[]): SqliteInputValue[] {
  return params.map(toInput);
}

export type SQLQueryBindings =
  | null
  | undefined
  | number
  | string
  | bigint
  | Uint8Array
  | boolean
  | Record<string, SqliteValue>
  | SqliteValue[];

export type { SqliteRow, SqliteValue };
export type SqliteBinding = SqliteValue | undefined;

export class Statement<
  Row = Record<string, SqliteValue>,
  Bindings = SqliteValue[] | Record<string, SqliteValue>,
> {
  _stmt: StatementSync;
  _columnNames: string[] | null = null;

  constructor(stmt: StatementSync) {
    this._stmt = stmt;
  }

  get(...params: (SqliteValue | undefined)[]): Row | undefined {
    const result = this._stmt.get(...toInputs(params as SqliteValue[]));
    return result as Row | undefined;
  }

  all(...params: (SqliteValue | undefined)[]): Row[] {
    return this._stmt.all(...toInputs(params as SqliteValue[])) as Row[];
  }

  run(...params: (SqliteValue | undefined)[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  } {
    return this._stmt.run(...toInputs(params as SqliteValue[])) as {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  }

  get columnNames(): string[] {
    if (this._columnNames === null) {
      this._columnNames = this._stmt.columns().map((c) => c.name);
    }
    return this._columnNames;
  }

  get paramsCount(): number {
    const sql = this._stmt.sourceSQL ?? "";
    let count = 0;
    let inString = false;
    let stringChar = "";
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (inString) {
        if (ch === stringChar && sql[i - 1] !== "\\") inString = false;
        continue;
      }
      if (ch === "'" || ch === '"') {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "?") count++;
      if (ch === "$" || ch === ":" || ch === "@") {
        const rest = sql.slice(i);
        if (/^[$:@]\d+/.test(rest)) {
          count++;
          while (i < sql.length && /\d/.test(sql[i]!)) i++;
          i--;
        }
      }
    }
    return count;
  }

  finalize(): void {}
}

export class Database {
  _db: DatabaseSync;

  constructor(
    path: string,
    options?: {
      create?: boolean;
      readwrite?: boolean;
      readonly?: boolean;
      strict?: boolean;
    },
  ) {
    this._db = new DatabaseSync(path, {
      open: options?.create !== false,
      readOnly: options?.readonly,
    });
  }

  prepare<
    Row = Record<string, SqliteValue>,
    Bindings = SqliteValue[] | Record<string, SqliteValue>,
  >(sql: string): Statement<Row, Bindings> {
    return new Statement(this._db.prepare(sql));
  }

  run(
    sql: string,
    params?: Record<string, SqliteValue>,
  ): { changes: number; lastInsertRowid: number | bigint } {
    if (!params && sql.includes(";")) {
      this.exec(sql);
      return { changes: 0, lastInsertRowid: 0n };
    }
    const stmt = this._db.prepare(sql);
    if (params) {
      return stmt.run(...toInputs(Object.values(params))) as {
        changes: number;
        lastInsertRowid: number | bigint;
      };
    }
    return stmt.run() as { changes: number; lastInsertRowid: number | bigint };
  }

  exec(sql: string): void {
    this._db.exec(sql);
  }

  query<Row = SqliteRow, Bindings extends SQLQueryBindings = SQLQueryBindings>(
    sql: string,
  ): Statement<Row, Bindings> {
    return new Statement<Row, Bindings>(this._db.prepare(sql));
  }

  close(): void {
    this._db.close();
  }

  get inTransaction(): boolean {
    return this._db.isTransaction;
  }

  serialize(fn?: () => void): void {
    if (fn) fn();
  }

  deserialize(fn?: () => void): void {
    if (fn) fn();
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const wrapper = (...args: Parameters<T>): ReturnType<T> => {
      this._db.exec("BEGIN");
      try {
        const result = fn(...args);
        this._db.exec("COMMIT");
        return result;
      } catch (e) {
        this._db.exec("ROLLBACK");
        throw e;
      }
    };
    return wrapper as T;
  }
}
