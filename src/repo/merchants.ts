import { SqlDatabase, ValidationError } from "../db/types";
import { newId, nowIso } from "../utils/id";

export interface Merchant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface MerchantRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const toMerchant = (r: MerchantRow): Merchant => ({ id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at });

export function createMerchantRepository(db: SqlDatabase) {
  return {
    async list(): Promise<Merchant[]> {
      return (await db.all<MerchantRow>("SELECT * FROM merchants ORDER BY name COLLATE NOCASE")).map(toMerchant);
    },

    async getById(id: string): Promise<Merchant | null> {
      const row = await db.first<MerchantRow>("SELECT * FROM merchants WHERE id = ?", [id]);
      return row ? toMerchant(row) : null;
    },

    /** Returns the merchant with this name (case-insensitive), creating it if needed. */
    async getOrCreate(name: string): Promise<Merchant> {
      const clean = (name ?? "").trim().replace(/\s+/g, " ");
      if (!clean) throw new ValidationError("merchant", "Merchant name is empty.");
      if (clean.length > 80) throw new ValidationError("merchant", "Merchant name must be 80 characters or fewer.");
      const existing = await db.first<MerchantRow>("SELECT * FROM merchants WHERE lower(name) = lower(?)", [clean]);
      if (existing) return toMerchant(existing);
      const now = nowIso();
      const id = newId("mer_");
      await db.run("INSERT INTO merchants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [id, clean, now, now]);
      return (await this.getById(id)) as Merchant;
    },

    /** Merchants ordered by most recent use in an expense (then newest created). */
    async recent(limit = 8): Promise<Merchant[]> {
      const rows = await db.all<MerchantRow>(
        `SELECT m.* FROM merchants m
         LEFT JOIN (SELECT merchant_id, MAX(date || ' ' || created_at) AS last_used FROM transactions
                    WHERE merchant_id IS NOT NULL GROUP BY merchant_id) u ON u.merchant_id = m.id
         ORDER BY u.last_used IS NULL, u.last_used DESC, m.created_at DESC LIMIT ?`,
        [limit],
      );
      return rows.map(toMerchant);
    },

    async search(prefix: string, limit = 10): Promise<Merchant[]> {
      const rows = await db.all<MerchantRow>(
        "SELECT * FROM merchants WHERE name LIKE ? ESCAPE '\\' ORDER BY name COLLATE NOCASE LIMIT ?",
        [`${escapeLike(prefix.trim())}%`, limit],
      );
      return rows.map(toMerchant);
    },
  };
}

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type MerchantRepository = ReturnType<typeof createMerchantRepository>;
