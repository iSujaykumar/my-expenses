import { COUNTED_STATUS_SQL } from "../constants/categories";
import { SqlDatabase, ValidationError } from "../db/types";
import { monthRange, YearMonth } from "../utils/date";
import { newId, nowIso } from "../utils/id";
import { isValidPaise } from "../utils/money";

export interface Budget {
  id: string;
  scope: "overall" | "category";
  categoryId: string | null;
  monthlyAmountPaise: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BudgetRow {
  id: string;
  scope: "overall" | "category";
  category_id: string | null;
  monthly_amount_paise: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

const toBudget = (r: BudgetRow): Budget => ({
  id: r.id,
  scope: r.scope,
  categoryId: r.category_id,
  monthlyAmountPaise: r.monthly_amount_paise,
  enabled: r.enabled === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface BudgetProgress {
  budget: Budget;
  spentPaise: number;
  remainingPaise: number;
  /** Whole percent used, may exceed 100. */
  percentUsed: number;
  overBudget: boolean;
  /** ok < 80%, warning 80-99%, over >= 100% */
  level: BudgetLevel;
}

export type BudgetLevel = "ok" | "warning" | "over";
export const BUDGET_WARNING_PERCENT = 80;

/** Threshold rule, computed with integers only: warning at >= 80% used, over at >= 100%. */
export function budgetLevel(spentPaise: number, budgetPaise: number): BudgetLevel {
  if (spentPaise >= budgetPaise) return "over";
  if (spentPaise * 100 >= budgetPaise * BUDGET_WARNING_PERCENT) return "warning";
  return "ok";
}

export function createBudgetRepository(db: SqlDatabase) {
  const repo = {
    async list(): Promise<Budget[]> {
      return (await db.all<BudgetRow>("SELECT * FROM budgets ORDER BY scope DESC, created_at")).map(toBudget);
    },

    /** Creates or replaces the monthly budget for overall spending or one category. */
    async upsert(input: { scope: "overall" | "category"; categoryId?: string | null; monthlyAmountPaise: number; enabled?: boolean }): Promise<Budget> {
      if (!isValidPaise(input.monthlyAmountPaise)) throw new ValidationError("monthlyAmountPaise", "Budget must be more than zero.");
      const categoryId = input.scope === "category" ? input.categoryId ?? null : null;
      if (input.scope === "category") {
        if (!categoryId) throw new ValidationError("categoryId", "Pick a category.");
        const c = await db.first<{ id: string }>("SELECT id FROM categories WHERE id = ?", [categoryId]);
        if (!c) throw new ValidationError("categoryId", "Category not found.");
      }
      const existing = await db.first<BudgetRow>(
        input.scope === "overall" ? "SELECT * FROM budgets WHERE scope = 'overall'" : "SELECT * FROM budgets WHERE scope = 'category' AND category_id = ?",
        input.scope === "overall" ? [] : [categoryId],
      );
      const now = nowIso();
      const enabled = input.enabled === false ? 0 : 1;
      if (existing) {
        await db.run("UPDATE budgets SET monthly_amount_paise = ?, enabled = ?, updated_at = ? WHERE id = ?", [
          input.monthlyAmountPaise, enabled, now, existing.id,
        ]);
        return toBudget((await db.first<BudgetRow>("SELECT * FROM budgets WHERE id = ?", [existing.id])) as BudgetRow);
      }
      const id = newId("bud_");
      await db.run(
        `INSERT INTO budgets (id, scope, category_id, monthly_amount_paise, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.scope, categoryId, input.monthlyAmountPaise, enabled, now, now],
      );
      return toBudget((await db.first<BudgetRow>("SELECT * FROM budgets WHERE id = ?", [id])) as BudgetRow);
    },

    async setEnabled(id: string, enabled: boolean): Promise<void> {
      const r = await db.run("UPDATE budgets SET enabled = ?, updated_at = ? WHERE id = ?", [enabled ? 1 : 0, nowIso(), id]);
      if (r.changes === 0) throw new ValidationError("id", "Budget not found.");
    },

    async delete(id: string): Promise<boolean> {
      return (await db.run("DELETE FROM budgets WHERE id = ?", [id])).changes > 0;
    },

    /** Progress of every enabled budget for a month, using the same status rule as all totals. */
    async progress(month: YearMonth): Promise<BudgetProgress[]> {
      const range = monthRange(month.year, month.month);
      const budgets = (await repo.list()).filter((b) => b.enabled);
      const result: BudgetProgress[] = [];
      for (const budget of budgets) {
        const row = await db.first<{ total: number | null }>(
          `SELECT SUM(amount_paise) AS total FROM transactions
           WHERE date BETWEEN ? AND ? AND ${COUNTED_STATUS_SQL}${budget.scope === "category" ? " AND category_id = ?" : ""}`,
          budget.scope === "category" ? [range.start, range.end, budget.categoryId] : [range.start, range.end],
        );
        const spentPaise = row?.total ?? 0;
        result.push({
          budget,
          spentPaise,
          remainingPaise: budget.monthlyAmountPaise - spentPaise,
          percentUsed: Math.floor((spentPaise * 100) / budget.monthlyAmountPaise),
          overBudget: spentPaise > budget.monthlyAmountPaise,
          level: budgetLevel(spentPaise, budget.monthlyAmountPaise),
        });
      }
      return result;
    },
  };
  return repo;
}

export type BudgetRepository = ReturnType<typeof createBudgetRepository>;
