import { SqlDatabase, withTransaction } from "../db/types";
import { BackupData, BudgetRecord, InvalidRecord, TABLE_ORDER, TableName } from "./backup";
import { seedDefaults } from "./reset";

export type ImportMode = "merge" | "replace";

export interface TableCounts {
  /** Will be added */
  new: number;
  /** Already present (same ID, or same name for categories/merchants); kept as is */
  duplicate: number;
  /** Failed validation; never written */
  invalid: number;
}

export interface ImportPlan {
  mode: ImportMode;
  counts: Record<TableName, TableCounts>;
  invalid: InvalidRecord[];
  /** Rows that will actually be inserted, with references already remapped. */
  toInsert: BackupData;
  /** Replace is refused when anything is invalid, so a partial file can never wipe good data. */
  blockedReason: string | null;
}

const emptyCounts = (): Record<TableName, TableCounts> =>
  Object.fromEntries(TABLE_ORDER.map((t) => [t, { new: 0, duplicate: 0, invalid: 0 }])) as Record<TableName, TableCounts>;

/**
 * Works out exactly what an import would do, without writing anything.
 *
 * Duplicate strategy (merge): every record has a stable ID that never changes, so a record whose
 * ID already exists on this phone is the same record and is skipped (the phone's copy is kept).
 * Categories and merchants with a different ID but the same name (ignoring case) are treated as the
 * same category/merchant, and imported expenses are linked to the existing one. Budgets for a scope
 * that already has a budget are skipped. Settings on the phone are kept.
 * Replace: everything on the phone is deleted and the backup's valid records are written instead.
 */
export async function planImport(db: SqlDatabase, valid: BackupData, invalid: InvalidRecord[], mode: ImportMode): Promise<ImportPlan> {
  const counts = emptyCounts();
  for (const r of invalid) counts[r.table].invalid += 1;

  if (mode === "replace") {
    for (const t of TABLE_ORDER) counts[t].new = valid[t].length;
    return {
      mode,
      counts,
      invalid,
      toInsert: valid,
      blockedReason: invalid.length ? "This backup has invalid records. Replace is disabled so nothing is lost. Use Merge, or fix the file." : null,
    };
  }

  const toInsert: BackupData = { categories: [], merchants: [], transactions: [], budgets: [], settings: [] };
  const existingCats = await db.all<{ id: string; name: string }>("SELECT id, name FROM categories");
  const catById = new Set(existingCats.map((c) => c.id));
  const catByName = new Map(existingCats.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const catMap = new Map<string, string>();
  for (const c of valid.categories) {
    if (catById.has(c.id)) {
      counts.categories.duplicate++;
      catMap.set(c.id, c.id);
    } else if (catByName.has(c.name.trim().toLowerCase())) {
      counts.categories.duplicate++;
      catMap.set(c.id, catByName.get(c.name.trim().toLowerCase()) as string);
    } else {
      counts.categories.new++;
      catMap.set(c.id, c.id);
      toInsert.categories.push(c);
    }
  }

  const existingMer = await db.all<{ id: string; name: string }>("SELECT id, name FROM merchants");
  const merById = new Set(existingMer.map((m) => m.id));
  const merByName = new Map(existingMer.map((m) => [m.name.trim().toLowerCase(), m.id]));
  const merMap = new Map<string, string>();
  for (const m of valid.merchants) {
    const key = m.name.trim().toLowerCase();
    if (merById.has(m.id)) {
      counts.merchants.duplicate++;
      merMap.set(m.id, m.id);
    } else if (merByName.has(key)) {
      counts.merchants.duplicate++;
      merMap.set(m.id, merByName.get(key) as string);
    } else {
      counts.merchants.new++;
      merMap.set(m.id, m.id);
      merByName.set(key, m.id);
      toInsert.merchants.push(m);
    }
  }

  const txIds = new Set((await db.all<{ id: string }>("SELECT id FROM transactions")).map((r) => r.id));
  for (const t of valid.transactions) {
    if (txIds.has(t.id)) counts.transactions.duplicate++;
    else {
      counts.transactions.new++;
      toInsert.transactions.push({
        ...t,
        category_id: catMap.get(t.category_id) ?? t.category_id,
        merchant_id: t.merchant_id === null ? null : (merMap.get(t.merchant_id) ?? t.merchant_id),
      });
    }
  }

  const existingBudgets = await db.all<{ id: string; scope: string; category_id: string | null }>("SELECT id, scope, category_id FROM budgets");
  const budgetIds = new Set(existingBudgets.map((b) => b.id));
  const budgetScopes = new Set(existingBudgets.map((b) => (b.scope === "overall" ? "overall" : `c:${b.category_id}`)));
  for (const b of valid.budgets) {
    const mapped: BudgetRecord = { ...b, category_id: b.category_id === null ? null : (catMap.get(b.category_id) ?? b.category_id) };
    const scopeKey = mapped.scope === "overall" ? "overall" : `c:${mapped.category_id}`;
    if (budgetIds.has(b.id) || budgetScopes.has(scopeKey)) counts.budgets.duplicate++;
    else {
      counts.budgets.new++;
      budgetScopes.add(scopeKey);
      toInsert.budgets.push(mapped);
    }
  }

  counts.settings.duplicate = valid.settings.length; // merge keeps this phone's settings
  return { mode, counts, invalid, toInsert, blockedReason: null };
}

async function insertAll(db: SqlDatabase, d: BackupData): Promise<void> {
  for (const c of d.categories) {
    await db.run(
      "INSERT INTO categories (id, name, color, icon, is_archived, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [c.id, c.name.trim(), c.color, c.icon, c.is_archived, c.sort_order, c.created_at, c.updated_at],
    );
  }
  for (const m of d.merchants) {
    await db.run("INSERT INTO merchants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [m.id, m.name.trim(), m.created_at, m.updated_at]);
  }
  for (const t of d.transactions) {
    await db.run(
      `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.amount_paise, t.description, t.date, t.time, t.category_id, t.merchant_id, t.payment_method, t.status, t.notes, t.created_at, t.updated_at],
    );
  }
  for (const b of d.budgets) {
    await db.run(
      "INSERT INTO budgets (id, scope, category_id, monthly_amount_paise, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [b.id, b.scope, b.category_id, b.monthly_amount_paise, b.enabled, b.created_at, b.updated_at],
    );
  }
  for (const s of d.settings) {
    await db.run(
      `INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [s.key, s.value, s.created_at, s.updated_at],
    );
  }
}

/** Applies a plan in ONE database transaction: either everything is written or nothing changes. */
export async function applyImport(db: SqlDatabase, plan: ImportPlan): Promise<void> {
  if (plan.blockedReason) throw new Error(plan.blockedReason);
  await withTransaction(db, async () => {
    if (plan.mode === "replace") {
      await db.exec("DELETE FROM transactions; DELETE FROM budgets; DELETE FROM merchants; DELETE FROM categories; DELETE FROM settings;");
      await insertAll(db, plan.toInsert);
      // A backup without settings still leaves the app with valid defaults.
      await seedDefaults(db, { categories: false, settingsIfMissing: true });
    } else {
      await insertAll(db, plan.toInsert);
    }
  });
}
