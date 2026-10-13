import { PAYMENT_METHODS, STATUSES } from "../constants/categories";
import { getSchemaVersion } from "../db/migrations";
import { SqlDatabase } from "../db/types";
import { SETTING_OPTIONS } from "../repo/settings";
import { isValidDateString, isValidTimeString } from "../utils/date";
import { isValidPaise } from "../utils/money";

export const BACKUP_FORMAT = "meow-backup";
export const BACKUP_FORMAT_VERSION = 1;

export interface CategoryRecord { id: string; name: string; color: string; icon: string; is_archived: number; sort_order: number; created_at: string; updated_at: string }
export interface MerchantRecord { id: string; name: string; created_at: string; updated_at: string }
export interface TransactionRecord {
  id: string; amount_paise: number; description: string; date: string; time: string | null; category_id: string;
  merchant_id: string | null; payment_method: string; status: string; notes: string; created_at: string; updated_at: string;
}
export interface BudgetRecord { id: string; scope: "overall" | "category"; category_id: string | null; monthly_amount_paise: number; enabled: number; created_at: string; updated_at: string }
export interface SettingRecord { key: string; value: string; created_at: string; updated_at: string }

export interface BackupData {
  categories: CategoryRecord[];
  merchants: MerchantRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  settings: SettingRecord[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  format_version: number;
  app_version: string;
  schema_version: number;
  exported_at: string;
  data: BackupData;
}

export const TABLE_ORDER = ["categories", "merchants", "transactions", "budgets", "settings"] as const;
export type TableName = (typeof TABLE_ORDER)[number];

/** Reads every table exactly as stored (snake_case columns, integer paise). */
export async function readAllData(db: SqlDatabase): Promise<BackupData> {
  return {
    categories: await db.all<CategoryRecord>("SELECT id, name, color, icon, is_archived, sort_order, created_at, updated_at FROM categories ORDER BY sort_order, id"),
    merchants: await db.all<MerchantRecord>("SELECT id, name, created_at, updated_at FROM merchants ORDER BY id"),
    transactions: await db.all<TransactionRecord>(
      "SELECT id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at FROM transactions ORDER BY date, created_at, id",
    ),
    budgets: await db.all<BudgetRecord>("SELECT id, scope, category_id, monthly_amount_paise, enabled, created_at, updated_at FROM budgets ORDER BY id"),
    settings: await db.all<SettingRecord>("SELECT key, value, created_at, updated_at FROM settings ORDER BY key"),
  };
}

export async function buildBackup(db: SqlDatabase, appVersion: string, now: Date = new Date()): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    app_version: appVersion,
    schema_version: await getSchemaVersion(db),
    exported_at: now.toISOString(),
    data: await readAllData(db),
  };
}

// ---------------------------------------------------------------- validation

export interface InvalidRecord {
  table: TableName;
  /** Position in the file (1-based) */
  index: number;
  id: string;
  reason: string;
}

export type BackupValidation =
  | { ok: false; fileError: string }
  | { ok: true; file: BackupFile; valid: BackupData; invalid: InvalidRecord[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isTimestamp = (v: unknown) => isStr(v) && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v);
const isId = (v: unknown): v is string => isStr(v) && v.length > 0 && v.length <= 64;

/**
 * Checks a parsed backup completely before anything is written.
 * File-level problems reject the whole file. Record-level problems mark that record invalid
 * (and anything that depends on it, e.g. an expense whose category is invalid).
 */
export function validateBackup(input: unknown): BackupValidation {
  if (!isObj(input)) return { ok: false, fileError: "This file is not a Meow backup (not a JSON object)." };
  if (input.format !== BACKUP_FORMAT) return { ok: false, fileError: "This file is not a Meow backup." };
  if (typeof input.format_version !== "number" || !Number.isInteger(input.format_version)) {
    return { ok: false, fileError: "The backup has no valid format_version." };
  }
  if (input.format_version > BACKUP_FORMAT_VERSION) {
    return { ok: false, fileError: `This backup was made by a newer version of Meow (format ${input.format_version}). Please update the app first.` };
  }
  if (input.format_version < 1) return { ok: false, fileError: "Unsupported backup format version." };
  if (!isStr(input.exported_at) || !isTimestamp(input.exported_at)) return { ok: false, fileError: "The backup has no valid exported_at date." };
  if (!isObj(input.data)) return { ok: false, fileError: "The backup has no data section." };
  const data = input.data;
  for (const t of TABLE_ORDER) {
    if (!Array.isArray(data[t])) return { ok: false, fileError: `The backup is missing the "${t}" list.` };
  }

  const invalid: InvalidRecord[] = [];
  const valid: BackupData = { categories: [], merchants: [], transactions: [], budgets: [], settings: [] };

  function check<T>(table: TableName, rows: unknown[], idKey: string, validate: (r: Record<string, unknown>) => string | null, push: (r: T) => void) {
    const seen = new Set<string>();
    rows.forEach((raw, i) => {
      const id = isObj(raw) && isStr(raw[idKey]) ? (raw[idKey] as string) : "";
      let reason: string | null = null;
      if (!isObj(raw)) reason = "not an object";
      else if (!isId(raw[idKey])) reason = `missing or invalid ${idKey}`;
      else if (seen.has(id)) reason = `duplicate ${idKey} in the file`;
      else reason = validate(raw);
      if (id) seen.add(id);
      if (reason) invalid.push({ table, index: i + 1, id, reason });
      else push(raw as T);
    });
  }
  const timestamps = (r: Record<string, unknown>) => (isTimestamp(r.created_at) && isTimestamp(r.updated_at) ? null : "invalid created_at/updated_at");

  check<CategoryRecord>("categories", data.categories as unknown[], "id", (r) => {
    if (!isStr(r.name) || !r.name.trim() || r.name.length > 40) return "invalid name";
    if (!isStr(r.color) || !/^#[0-9A-Fa-f]{6}$/.test(r.color)) return "invalid color";
    if (!isStr(r.icon) || !r.icon) return "invalid icon";
    if (r.is_archived !== 0 && r.is_archived !== 1) return "is_archived must be 0 or 1";
    if (typeof r.sort_order !== "number" || !Number.isInteger(r.sort_order)) return "invalid sort_order";
    return timestamps(r);
  }, (r) => valid.categories.push(r));
  // Category names must be unique (case-insensitive) within the file.
  const names = new Set<string>();
  valid.categories = valid.categories.filter((c) => {
    const key = c.name.trim().toLowerCase();
    if (names.has(key)) {
      invalid.push({ table: "categories", index: (data.categories as unknown[]).indexOf(c) + 1, id: c.id, reason: "duplicate category name in the file" });
      return false;
    }
    names.add(key);
    return true;
  });

  check<MerchantRecord>("merchants", data.merchants as unknown[], "id", (r) => {
    if (!isStr(r.name) || !r.name.trim() || r.name.length > 80) return "invalid name";
    return timestamps(r);
  }, (r) => valid.merchants.push(r));

  const catIds = new Set(valid.categories.map((c) => c.id));
  const merIds = new Set(valid.merchants.map((m) => m.id));

  check<TransactionRecord>("transactions", data.transactions as unknown[], "id", (r) => {
    if (!isValidPaise(r.amount_paise)) return "amount_paise must be a whole number of paise above 0";
    if (!isStr(r.date) || !isValidDateString(r.date)) return "invalid date (expected YYYY-MM-DD)";
    if (r.time !== null && !(isStr(r.time) && isValidTimeString(r.time))) return "invalid time (expected HH:MM or null)";
    if (!isStr(r.description) || r.description.length > 200) return "invalid description";
    if (!isStr(r.notes) || r.notes.length > 1000) return "invalid notes";
    if (!isStr(r.payment_method) || !(PAYMENT_METHODS as readonly string[]).includes(r.payment_method)) return "unknown payment_method";
    if (!isStr(r.status) || !(STATUSES as readonly string[]).includes(r.status)) return "unknown status";
    if (!isStr(r.category_id) || !catIds.has(r.category_id)) return "category_id does not match a valid category in the file";
    if (r.merchant_id !== null && !(isStr(r.merchant_id) && merIds.has(r.merchant_id))) return "merchant_id does not match a valid merchant in the file";
    return timestamps(r);
  }, (r) => valid.transactions.push(r));

  const budgetKeys = new Set<string>();
  check<BudgetRecord>("budgets", data.budgets as unknown[], "id", (r) => {
    if (r.scope !== "overall" && r.scope !== "category") return "invalid scope";
    if (r.scope === "overall" && r.category_id !== null) return "overall budget must not have a category_id";
    if (r.scope === "category" && !(isStr(r.category_id) && catIds.has(r.category_id))) return "category_id does not match a valid category in the file";
    if (!isValidPaise(r.monthly_amount_paise)) return "monthly_amount_paise must be a whole number of paise above 0";
    if (r.enabled !== 0 && r.enabled !== 1) return "enabled must be 0 or 1";
    const key = r.scope === "overall" ? "overall" : `c:${r.category_id}`;
    if (budgetKeys.has(key)) return "more than one budget for the same scope";
    budgetKeys.add(key);
    return timestamps(r);
  }, (r) => valid.budgets.push(r));

  check<SettingRecord>("settings", data.settings as unknown[], "key", (r) => {
    const opts = (SETTING_OPTIONS as Record<string, readonly string[]>)[r.key as string];
    if (!opts) return "unknown setting";
    if (!isStr(r.value) || !opts.includes(r.value)) return "invalid value";
    return timestamps(r);
  }, (r) => valid.settings.push(r));

  return { ok: true, file: input as unknown as BackupFile, valid, invalid };
}

/** Parses text then validates. */
export function parseAndValidateBackup(text: string): BackupValidation {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, fileError: "This file is not valid JSON." };
  }
  return validateBackup(json);
}
