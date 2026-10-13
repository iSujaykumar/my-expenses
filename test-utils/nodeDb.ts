import Database from "better-sqlite3";

import { initDatabase } from "../src/db/migrations";
import { SqlDatabase, SqlParams } from "../src/db/types";

/** In-memory SQLite (better-sqlite3) behind the app's SqlDatabase interface, so tests execute real SQL. */
/** Pass a file path for a file-backed database (used to test persistence across close/reopen). */
export function createNodeDatabase(path = ":memory:"): { db: SqlDatabase; raw: Database.Database } {
  const raw = new Database(path);
  const db: SqlDatabase = {
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params: SqlParams = []) => {
      const r = raw.prepare(sql).run(...params);
      return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T,>(sql: string, params: SqlParams = []) => raw.prepare(sql).all(...params) as T[],
    first: async <T,>(sql: string, params: SqlParams = []) => (raw.prepare(sql).get(...params) as T | undefined) ?? null,
  };
  return { db, raw };
}

export async function createMigratedDatabase() {
  const handle = createNodeDatabase();
  await initDatabase(handle.db);
  return handle;
}
