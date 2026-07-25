export type SqlValue = number | string | null;

export type SqlRow = Record<string, unknown>;

export interface SqlDriver {
  readonly all: (sql: string, params?: readonly SqlValue[]) => SqlRow[];
  readonly close: () => void;
  readonly exec: (sql: string) => void;
  readonly run: (sql: string, params?: readonly SqlValue[]) => number;
}
