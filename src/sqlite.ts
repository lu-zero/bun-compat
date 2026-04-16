import { DatabaseSync, type StatementSync } from "node:sqlite";

type SqliteValue = string | number | bigint | Uint8Array | boolean | null;

type SqliteInputValue = string | number | bigint | Uint8Array | null;

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

export class Statement<
  Row = Record<string, SqliteValue>,
  Bindings = SqliteValue[] | Record<string, SqliteValue>,
> {
  #stmt: StatementSync;
  #columnNames: string[] | null = null;

  constructor(stmt: StatementSync) {
    this.#stmt = stmt;
  }

  get(...params: SqliteValue[]): Row | undefined {
    const result = this.#stmt.get(...toInputs(params));
    return result as Row | undefined;
  }

  all(...params: SqliteValue[]): Row[] {
    return this.#stmt.all(...toInputs(params)) as Row[];
  }

  run(...params: SqliteValue[]): {
    changes: number;
    lastInsertRowid: number | bigint;
  } {
    return this.#stmt.run(...toInputs(params)) as {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  }

  get columnNames(): string[] {
    if (this.#columnNames === null) {
      this.#columnNames = this.#stmt.columns().map((c) => c.name);
    }
    return this.#columnNames;
  }

  get paramsCount(): number {
    const sql = this.#stmt.sourceSQL ?? "";
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
  #db: DatabaseSync;

  constructor(
    path: string,
    options?: {
      create?: boolean;
      readwrite?: boolean;
      readonly?: boolean;
      strict?: boolean;
    },
  ) {
    this.#db = new DatabaseSync(path, {
      open: options?.create !== false,
      readOnly: options?.readonly,
    });
  }

  prepare<
    Row = Record<string, SqliteValue>,
    Bindings = SqliteValue[] | Record<string, SqliteValue>,
  >(sql: string): Statement<Row, Bindings> {
    return new Statement(this.#db.prepare(sql));
  }

  run(
    sql: string,
    params?: Record<string, SqliteValue>,
  ): { changes: number; lastInsertRowid: number | bigint } {
    if (!params && sql.includes(";")) {
      this.exec(sql);
      return { changes: 0, lastInsertRowid: 0n };
    }
    const stmt = this.#db.prepare(sql);
    if (params) {
      return stmt.run(...toInputs(Object.values(params))) as {
        changes: number;
        lastInsertRowid: number | bigint;
      };
    }
    return stmt.run() as { changes: number; lastInsertRowid: number | bigint };
  }

  exec(sql: string): void {
    this.#db.exec(sql);
  }

  close(): void {
    this.#db.close();
  }

  get inTransaction(): boolean {
    return this.#db.isTransaction;
  }

  serialize(fn?: () => void): void {
    if (fn) fn();
  }

  deserialize(fn?: () => void): void {
    if (fn) fn();
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    const wrapper = (...args: Parameters<T>): ReturnType<T> => {
      this.#db.exec("BEGIN");
      try {
        const result = fn(...args);
        this.#db.exec("COMMIT");
        return result;
      } catch (e) {
        this.#db.exec("ROLLBACK");
        throw e;
      }
    };
    return wrapper as T;
  }
}
