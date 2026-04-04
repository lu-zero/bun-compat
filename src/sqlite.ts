import {
  DatabaseSync,
  type StatementResultingChanges,
  type StatementSync,
} from "node:sqlite";

type SqliteValue = string | number | bigint | Uint8Array | null;

export class Database {
  #db: DatabaseSync;
  #open: boolean = true;

  constructor(
    filename: string,
    opts?: { create?: boolean; readonly?: boolean },
  ) {
    this.#db = new DatabaseSync(filename, { open: opts?.create !== false });
  }

  get sqlite(): DatabaseSync {
    return this.#db;
  }

  query(
    sql: string,
    params?: Record<string, SqliteValue>,
  ): { rows: Record<string, SqliteValue>[] } {
    const stmt: StatementSync = this.#db.prepare(sql);
    if (params) {
      // deno-lint-ignore no-explicit-any
      return {
        rows: stmt.all(...[params] as any[]) as Record<string, SqliteValue>[],
      };
    }
    return { rows: stmt.all() as Record<string, SqliteValue>[] };
  }

  run(
    sql: string,
    params?: Record<string, SqliteValue>,
  ): StatementResultingChanges {
    const stmt: StatementSync = this.#db.prepare(sql);
    if (params) {
      // deno-lint-ignore no-explicit-any
      return stmt.run(...[params] as any[]);
    }
    return stmt.run();
  }

  exec(sql: string) {
    this.#db.exec(sql);
  }

  prepare(sql: string): StatementSync {
    return this.#db.prepare(sql);
  }

  close() {
    if (this.#open) {
      this.#db.close();
      this.#open = false;
    }
  }

  get inTransaction(): boolean {
    return ((this.#db as unknown as Record<string, unknown>)
      .inTransaction as boolean) ??
      false;
  }

  serialize(fn?: () => void) {
    if (fn) fn();
  }

  deserialize(fn?: () => void) {
    if (fn) fn();
  }

  transaction(
    fn: (...args: unknown[]) => unknown,
  ): (...args: unknown[]) => unknown {
    return (...args: unknown[]) => {
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
  }
}
