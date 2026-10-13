import Constants from "expo-constants";

import { Repositories } from "../repo";
import { MAX_LIST_LIMIT } from "../repo/transactions";
import { buildBackup } from "./backup";
import { transactionsToCsv } from "./csv";
import { shareTextFile, timestampedName } from "./files";

export const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

export async function exportCsv(repos: Repositories): Promise<number> {
  const rows = await repos.transactions.list({ sort: "date_asc", limit: MAX_LIST_LIMIT });
  await shareTextFile(timestampedName("meow-expenses", "csv"), transactionsToCsv(rows), "text/csv");
  return rows.length;
}

export async function exportBackup(repos: Repositories): Promise<number> {
  const backup = await buildBackup(repos.db, APP_VERSION);
  await shareTextFile(timestampedName("meow-backup", "json"), JSON.stringify(backup, null, 2), "application/json");
  return backup.data.transactions.length;
}
