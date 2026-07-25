declare module "bun:sqlite" {
  export type SQLQueryBindings = number | string | null;

  export interface Statement {
    all: (...params: SQLQueryBindings[]) => unknown[];
  }

  export class Database {
    constructor(path: string, options?: { create?: boolean });
    close(): void;
    exec(sql: string): void;
    query(sql: string): Statement;
    run(sql: string, params?: SQLQueryBindings[]): { changes: number };
  }
}
