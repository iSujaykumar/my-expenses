/**
 * Minimal database interface used by the whole app.
 * The app uses an expo-sqlite implementation; unit tests use an in-memory
 * better-sqlite3 implementation so real SQL is executed in tests.
 */
export type SqlValue = string | number | null;
export type SqlParams = SqlValue[];

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  first<T>(sql: string, params?: SqlParams): Promise<T | null>;
}

/** Error with a user-safe message. Never contains transaction details. */
export class DatabaseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

/** Validation error thrown by repositories for bad input. */
export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/** Runs `task` inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction<T>(db: SqlDatabase, task: () => Promise<T>): Promise<T> {
  await db.exec("BEGIN");
  try {
    const result = await task();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure; original error is more useful
    }
    throw error;
  }
}
