import { STARTER_CATEGORIES } from "../constants/categories";
import { nowIso } from "../utils/id";
import { DatabaseError, SqlDatabase, withTransaction } from "./types";

export interface Migration {
  version: number;
  description: string;
  up(db: SqlDatabase): Promise<void>;
}

/** Default settings inserted by migration 1. */
export const DEFAULT_SETTINGS: Record<string, string> = {
  theme: "system",
  week_start: "monday",
  date_format: "DD MMM YYYY",
};

/**
 * Ordered list of migrations. NEVER edit a released migration;
 * add a new one with the next version number instead.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "Initial schema + starter categories + default settings",
    async up(db) {
      await db.exec(`
CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE merchants (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_merchants_name ON merchants (lower(name));

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise > 0),
  description TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  time TEXT CHECK (time IS NULL OR time GLOB '[0-2][0-9]:[0-5][0-9]'),
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  merchant_id TEXT REFERENCES merchants (id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'debit_card', 'credit_card', 'bank_transfer', 'other')),
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'refunded')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_transactions_date ON transactions (date);
CREATE INDEX idx_transactions_category ON transactions (category_id);
CREATE INDEX idx_transactions_status ON transactions (status);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('overall', 'category')),
  category_id TEXT REFERENCES categories (id) ON DELETE CASCADE,
  monthly_amount_paise INTEGER NOT NULL CHECK (typeof(monthly_amount_paise) = 'integer' AND monthly_amount_paise > 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((scope = 'overall' AND category_id IS NULL) OR (scope = 'category' AND category_id IS NOT NULL))
);
CREATE UNIQUE INDEX idx_budgets_overall ON budgets (scope) WHERE scope = 'overall';
CREATE UNIQUE INDEX idx_budgets_category ON budgets (category_id) WHERE scope = 'category';

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);
      const now = nowIso();
      let order = 0;
      for (const c of STARTER_CATEGORIES) {
        await db.run(
          `INSERT INTO categories (id, name, color, icon, is_archived, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
          [c.id, c.name, c.color, c.icon, order++, now, now],
        );
      }
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db.run(`INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)`, [key, value, now, now]);
      }
    },
  },
  {
    version: 2,
    description: "Recurring expense templates + recorded/skipped occurrences",
    async up(db) {
      await db.exec(`
CREATE TABLE recurring_templates (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  amount_paise INTEGER NOT NULL CHECK (typeof(amount_paise) = 'integer' AND amount_paise > 0),
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  merchant_id TEXT REFERENCES merchants (id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'debit_card', 'credit_card', 'bank_transfer', 'other')),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  day_of_month INTEGER CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recurring_occurrences (
  template_id TEXT NOT NULL REFERENCES recurring_templates (id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('recorded', 'skipped')),
  transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, due_date)
);
`);
    },
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.first<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

/**
 * Applies every migration newer than PRAGMA user_version, each in its own
 * transaction. A failed migration is rolled back and the version is not bumped.
 */
export async function migrate(db: SqlDatabase, migrations: readonly Migration[] = MIGRATIONS): Promise<number> {
  const current = await getSchemaVersion(db);
  const latest = migrations.length ? migrations[migrations.length - 1].version : 0;
  if (current > latest) {
    throw new DatabaseError(
      "DB_TOO_NEW",
      `Database version ${current} is newer than this app supports (${latest}). Please update Meow.`,
    );
  }
  for (const m of migrations) {
    if (m.version <= current) continue;
    try {
      await withTransaction(db, async () => {
        await m.up(db);
        await db.exec(`PRAGMA user_version = ${Math.trunc(m.version)}`);
      });
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError("MIGRATION_FAILED", `Could not upgrade the database to version ${m.version}.`);
    }
  }
  return getSchemaVersion(db);
}

/** Pragmas applied on every open. */
export async function configureConnection(db: SqlDatabase): Promise<void> {
  await db.exec("PRAGMA foreign_keys = ON");
}

/** Configure + migrate. Throws DatabaseError with a user-safe message on failure. */
export async function initDatabase(db: SqlDatabase): Promise<number> {
  try {
    await configureConnection(db);
    return await migrate(db);
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("INIT_FAILED", "Could not open the expense database.");
  }
}
