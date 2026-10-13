import * as SQLite from "expo-sqlite";

import { initDatabase } from "./migrations";
import { DatabaseError, SqlDatabase, SqlParams } from "./types";

export const DATABASE_NAME = "meow.db";

/** Wraps an expo-sqlite database in the app's SqlDatabase interface. */
export function wrapExpoDatabase(db: SQLite.SQLiteDatabase): SqlDatabase {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParams = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: (sql, params: SqlParams = []) => db.getAllAsync(sql, params),
    first: (sql, params: SqlParams = []) => db.getFirstAsync(sql, params),
  };
}

/** Opens the on-device database and runs migrations. */
export async function openAppDatabase(): Promise<SqlDatabase> {
  let raw: SQLite.SQLiteDatabase;
  try {
    raw = await SQLite.openDatabaseAsync(DATABASE_NAME);
  } catch {
    throw new DatabaseError("OPEN_FAILED", "Could not open the expense database on this device.");
  }
  const db = wrapExpoDatabase(raw);
  await initDatabase(db);
  return db;
}
