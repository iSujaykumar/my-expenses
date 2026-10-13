import { STARTER_CATEGORIES } from "../constants/categories";
import { DEFAULT_SETTINGS } from "../db/migrations";
import { SqlDatabase, withTransaction } from "../db/types";
import { nowIso } from "../utils/id";

/** Inserts the starter categories and/or any missing default settings. */
export async function seedDefaults(db: SqlDatabase, options: { categories: boolean; settingsIfMissing: boolean }): Promise<void> {
  const now = nowIso();
  if (options.categories) {
    let order = 0;
    for (const c of STARTER_CATEGORIES) {
      await db.run(
        "INSERT INTO categories (id, name, color, icon, is_archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
        [c.id, c.name, c.color, c.icon, order++, now, now],
      );
    }
  }
  if (options.settingsIfMissing) {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db.run("INSERT OR IGNORE INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)", [key, value, now, now]);
    }
  }
}

/** Deletes every expense, merchant, budget, category and setting, then restores the starter categories and defaults. All-or-nothing. */
export async function resetAllData(db: SqlDatabase): Promise<void> {
  await withTransaction(db, async () => {
    await db.exec("DELETE FROM transactions; DELETE FROM budgets; DELETE FROM merchants; DELETE FROM categories; DELETE FROM settings;");
    await seedDefaults(db, { categories: true, settingsIfMissing: true });
  });
}

export const RESET_CONFIRM_WORD = "DELETE";
