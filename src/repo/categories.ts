import { SqlDatabase, ValidationError } from "../db/types";
import { newId, nowIso } from "../utils/id";

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  icon: r.icon,
  isArchived: r.is_archived === 1,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function cleanName(name: string): string {
  const n = (name ?? "").trim();
  if (!n) throw new ValidationError("name", "Category name is required.");
  if (n.length > 40) throw new ValidationError("name", "Category name must be 40 characters or fewer.");
  return n;
}

function checkColor(color: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(color ?? "")) throw new ValidationError("color", "Colour must look like #1F6F5C.");
  return color;
}

export function createCategoryRepository(db: SqlDatabase) {
  async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
    const row = await db.first<{ id: string }>(
      "SELECT id FROM categories WHERE lower(name) = lower(?) AND id != ?",
      [name, exceptId ?? ""],
    );
    return row !== null;
  }

  return {
    /** Active categories by default; pass includeArchived to see all (e.g. for history/filters). */
    async list(options: { includeArchived?: boolean } = {}): Promise<Category[]> {
      const where = options.includeArchived ? "" : "WHERE is_archived = 0";
      const rows = await db.all<CategoryRow>(`SELECT * FROM categories ${where} ORDER BY sort_order, name`);
      return rows.map(toCategory);
    },

    async getById(id: string): Promise<Category | null> {
      const row = await db.first<CategoryRow>("SELECT * FROM categories WHERE id = ?", [id]);
      return row ? toCategory(row) : null;
    },

    async create(input: { name: string; color: string; icon: string }): Promise<Category> {
      const name = cleanName(input.name);
      if (await nameTaken(name)) throw new ValidationError("name", "A category with this name already exists.");
      const color = checkColor(input.color);
      if (!input.icon) throw new ValidationError("icon", "Pick an icon.");
      const max = await db.first<{ m: number | null }>("SELECT MAX(sort_order) AS m FROM categories");
      const now = nowIso();
      const id = newId("cat_");
      await db.run(
        `INSERT INTO categories (id, name, color, icon, is_archived, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
        [id, name, color, input.icon, (max?.m ?? -1) + 1, now, now],
      );
      return (await this.getById(id)) as Category;
    },

    /**
     * Renames / recolours a category. Transactions reference the category by id,
     * so every past transaction keeps its category and amount unchanged.
     */
    async update(id: string, patch: { name?: string; color?: string; icon?: string; sortOrder?: number }): Promise<Category> {
      const existing = await this.getById(id);
      if (!existing) throw new ValidationError("id", "Category not found.");
      const name = patch.name !== undefined ? cleanName(patch.name) : existing.name;
      if (patch.name !== undefined && (await nameTaken(name, id))) {
        throw new ValidationError("name", "A category with this name already exists.");
      }
      const color = patch.color !== undefined ? checkColor(patch.color) : existing.color;
      const icon = patch.icon ?? existing.icon;
      const sortOrder = patch.sortOrder ?? existing.sortOrder;
      await db.run(
        "UPDATE categories SET name = ?, color = ?, icon = ?, sort_order = ?, updated_at = ? WHERE id = ?",
        [name, color, icon, sortOrder, nowIso(), id],
      );
      return (await this.getById(id)) as Category;
    },

    /** Archive hides the category from pickers; its transactions and totals are untouched. */
    async setArchived(id: string, archived: boolean): Promise<Category> {
      const r = await db.run("UPDATE categories SET is_archived = ?, updated_at = ? WHERE id = ?", [archived ? 1 : 0, nowIso(), id]);
      if (r.changes === 0) throw new ValidationError("id", "Category not found.");
      return (await this.getById(id)) as Category;
    },

    async transactionCount(id: string): Promise<number> {
      const row = await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?", [id]);
      return row?.n ?? 0;
    },

    /** Deletes only an unused category. Used categories must be archived instead, so history is never lost. */
    async deleteIfUnused(id: string): Promise<void> {
      if ((await this.transactionCount(id)) > 0) {
        throw new ValidationError("id", "This category has expenses. Archive it instead of deleting.");
      }
      await db.run("DELETE FROM categories WHERE id = ?", [id]);
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
