import { SqlDatabase, withTransaction } from "../db/types";
import { isValidDateString } from "../utils/date";
import { nowIso } from "../utils/id";

/**
 * The user's own sample list (Phase 6 message), one entry per amount.
 * "Tissue 196 and 99" and "Bra 221 and 1243" become two entries each; "Amazon Now" becomes 8.
 * Amounts are whole rupees as written. Totals are always computed from this list, never typed in.
 * `flag` marks anything uncertain; it is shown in the preview and saved in the expense notes.
 */
export interface SampleItem {
  key: string;
  description: string;
  rupees: number;
  categoryId: string;
  merchant?: string;
  flag?: string;
}

const AMAZON_NOW_FLAG = "Amazon Now order: no item description in the original note";

export const SAMPLE_ITEMS: readonly SampleItem[] = [
  { key: "01", description: "8-in-1 hub", rupees: 703, categoryId: "cat_electronics" },
  { key: "02", description: "Laptop cover + keyboard cover", rupees: 274, categoryId: "cat_electronics" },
  { key: "03", description: "AirTag", rupees: 283, categoryId: "cat_electronics" },
  { key: "04", description: "Gloves", rupees: 329, categoryId: "cat_clothing" },
  { key: "05", description: "Grocery", rupees: 321, categoryId: "cat_groceries" },
  { key: "06", description: "Tissue", rupees: 196, categoryId: "cat_home", flag: 'Original note "Tissue 196 and 99" split into two entries (1 of 2)' },
  { key: "07", description: "Tissue", rupees: 99, categoryId: "cat_home", flag: 'Original note "Tissue 196 and 99" split into two entries (2 of 2)' },
  { key: "08", description: "Black jacket", rupees: 263, categoryId: "cat_clothing" },
  { key: "09", description: "Masala dabba", rupees: 129, categoryId: "cat_home" },
  { key: "10", description: "Sipper", rupees: 99, categoryId: "cat_home" },
  { key: "11", description: "Screen guard", rupees: 260, categoryId: "cat_electronics" },
  { key: "12", description: "Gym bag", rupees: 197, categoryId: "cat_health" },
  { key: "13", description: "Luffy sticker", rupees: 117, categoryId: "cat_shopping" },
  { key: "14", description: "Blue jacket + green kurta", rupees: 768, categoryId: "cat_clothing" },
  { key: "15", description: "Knee caps", rupees: 199, categoryId: "cat_health" },
  { key: "16", description: "Gym underwear", rupees: 546, categoryId: "cat_clothing" },
  { key: "17", description: "Comfort", rupees: 247, categoryId: "cat_home", flag: 'Unclear what "Comfort" is (possibly fabric conditioner); category is a guess' },
  { key: "18", description: "Amazon Now order", rupees: 153, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "19", description: "Amazon Now order", rupees: 207, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "20", description: "Amazon Now order", rupees: 503, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "21", description: "Amazon Now order", rupees: 659, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "22", description: "Amazon Now order", rupees: 674, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "23", description: "Amazon Now order", rupees: 2223, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "24", description: "Amazon Now order", rupees: 408, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "25", description: "Amazon Now order", rupees: 364, categoryId: "cat_shopping", merchant: "Amazon Now", flag: AMAZON_NOW_FLAG },
  { key: "26", description: "Blue jeans", rupees: 443, categoryId: "cat_clothing" },
  { key: "27", description: "Cat shoes", rupees: 289, categoryId: "cat_clothing", flag: 'Unclear if "Cat" is a brand/design or shoes for a cat; filed under Clothing' },
  { key: "28", description: "Cat bed", rupees: 404, categoryId: "cat_pets" },
  { key: "29", description: "Charger", rupees: 649, categoryId: "cat_electronics" },
  { key: "30", description: "Shoes for grandfather", rupees: 1024, categoryId: "cat_gifts" },
  { key: "31", description: "Bra", rupees: 221, categoryId: "cat_clothing", flag: 'Original note "Bra 221 and 1243" split into two entries (1 of 2)' },
  { key: "32", description: "Bra", rupees: 1243, categoryId: "cat_clothing", flag: 'Original note "Bra 221 and 1243" split into two entries (2 of 2)' },
  { key: "33", description: "Laptop sleeve", rupees: 1001, categoryId: "cat_electronics" },
  { key: "34", description: "Screen cleaning + stand", rupees: 1525, categoryId: "cat_electronics" },
  { key: "35", description: "Bed cover", rupees: 741, categoryId: "cat_home" },
  { key: "36", description: "Broadband", rupees: 470, categoryId: "cat_bills" },
  { key: "37", description: "Airtel recharge", rupees: 548, categoryId: "cat_bills", merchant: "Airtel", flag: 'Original note also had "8788"; its meaning is unknown, so it was not used' },
  { key: "38", description: "Flipkart order", rupees: 2200, categoryId: "cat_shopping", merchant: "Flipkart", flag: "No item recorded in the original note" },
];

/** Every sample expense ID starts with this, so they can be found and removed exactly. */
export const SAMPLE_ID_PREFIX = "sample_v1_";
export const sampleId = (key: string) => `${SAMPLE_ID_PREFIX}${key}`;

export const sampleCount = (items: readonly SampleItem[] = SAMPLE_ITEMS) => items.length;
export const sampleTotalPaise = (items: readonly SampleItem[] = SAMPLE_ITEMS) => items.reduce((s, i) => s + i.rupees * 100, 0);

export function sampleNotes(item: SampleItem): string {
  return item.flag ? `Sample data. Check: ${item.flag}` : "Sample data";
}

/** IDs of sample expenses already in the database. */
export async function existingSampleIds(db: SqlDatabase): Promise<Set<string>> {
  const rows = await db.all<{ id: string }>("SELECT id FROM transactions WHERE substr(id, 1, ?) = ?", [SAMPLE_ID_PREFIX.length, SAMPLE_ID_PREFIX]);
  return new Set(rows.map((r) => r.id));
}

/**
 * Inserts the samples with the chosen dates (by item key) in one transaction.
 * Idempotent: items whose ID already exists are skipped. If a suggested category was deleted,
 * the expense goes to "Other" (or the first category) instead.
 */
export async function loadSampleData(db: SqlDatabase, dates: Record<string, string>, items: readonly SampleItem[] = SAMPLE_ITEMS): Promise<{ inserted: number; skipped: number }> {
  for (const i of items) if (!isValidDateString(dates[i.key] ?? "")) throw new Error("Every sample needs a valid date.");
  return withTransaction(db, async () => {
    const existing = await existingSampleIds(db);
    const cats = new Set((await db.all<{ id: string }>("SELECT id FROM categories")).map((c) => c.id));
    const fallback = cats.has("cat_other") ? "cat_other" : [...cats][0];
    const now = nowIso();
    const merchantIds = new Map<string, string>();
    let inserted = 0;
    for (const item of items) {
      const id = sampleId(item.key);
      if (existing.has(id)) continue;
      let merchantId: string | null = null;
      if (item.merchant) {
        merchantId = merchantIds.get(item.merchant) ?? null;
        if (!merchantId) {
          const found = await db.first<{ id: string }>("SELECT id FROM merchants WHERE lower(name) = lower(?)", [item.merchant]);
          merchantId = found?.id ?? `${SAMPLE_ID_PREFIX}m_${item.merchant.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
          if (!found) await db.run("INSERT INTO merchants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [merchantId, item.merchant, now, now]);
          merchantIds.set(item.merchant, merchantId);
        }
      }
      await db.run(
        `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 'other', 'paid', ?, ?, ?)`,
        [id, item.rupees * 100, item.description, dates[item.key], cats.has(item.categoryId) ? item.categoryId : fallback, merchantId, sampleNotes(item), now, now],
      );
      inserted++;
    }
    return { inserted, skipped: items.length - inserted };
  });
}

/** Deletes exactly the sample expenses (and sample-created merchants no longer used). Your own expenses are never touched. */
export async function removeSampleData(db: SqlDatabase): Promise<number> {
  return withTransaction(db, async () => {
    const n = SAMPLE_ID_PREFIX.length;
    await db.run("DELETE FROM recurring_occurrences WHERE substr(transaction_id, 1, ?) = ?", [n, SAMPLE_ID_PREFIX]);
    const r = await db.run("DELETE FROM transactions WHERE substr(id, 1, ?) = ?", [n, SAMPLE_ID_PREFIX]);
    await db.run(
      "DELETE FROM merchants WHERE substr(id, 1, ?) = ? AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.merchant_id = merchants.id) AND NOT EXISTS (SELECT 1 FROM recurring_templates rt WHERE rt.merchant_id = merchants.id)",
      [n, SAMPLE_ID_PREFIX],
    );
    return r.changes;
  });
}
