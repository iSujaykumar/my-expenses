import { Repositories } from "../../repo";
import { BudgetProgress } from "../../repo/budgets";
import { SpendingSummary, TransactionWithDetails } from "../../repo/transactions";
import { compareWithPreviousMonth, monthRange, MonthComparison, previousMonth, YearMonth, yearRange } from "../../utils/date";
import { averagePerDay, AveragePerDay, categoryShares, CategoryShare } from "./stats";

export interface DashboardData {
  month: YearMonth;
  summary: SpendingSummary;
  yearTotalPaise: number;
  average: AveragePerDay;
  comparison: MonthComparison;
  categories: CategoryShare[];
  recent: TransactionWithDetails[];
  budgets: (BudgetProgress & { categoryName: string | null; categoryColor: string | null })[];
  /** Expenses ever recorded (for the first-run empty state). */
  totalEver: number;
}

/** Everything the dashboard shows, computed from saved transactions with the shared status rule. */
export async function loadDashboard(repos: Repositories, month: YearMonth, today: string): Promise<DashboardData> {
  const range = monthRange(month.year, month.month);
  const prev = previousMonth(month);
  const [summary, yearTotalPaise, prevTotal, byCategory, recent, progress, totalEver, cats] = await Promise.all([
    repos.transactions.summary({ range }),
    repos.transactions.totalSpending(yearRange(month.year)),
    repos.transactions.totalSpending(monthRange(prev.year, prev.month)),
    repos.transactions.totalsByCategory(range),
    repos.transactions.list({ range, limit: 5, sort: "date_desc" }),
    repos.budgets.progress(month),
    repos.transactions.count(),
    repos.categories.list({ includeArchived: true }),
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  return {
    month,
    summary,
    yearTotalPaise,
    average: averagePerDay(month, summary.totalPaise, today),
    comparison: compareWithPreviousMonth(month, summary.totalPaise, prevTotal),
    categories: categoryShares(byCategory),
    recent,
    budgets: progress
      .map((p) => {
        const c = p.budget.categoryId ? catById.get(p.budget.categoryId) : undefined;
        return { ...p, categoryName: c?.name ?? null, categoryColor: c?.color ?? null };
      })
      .sort((a, b) => (a.budget.scope === b.budget.scope ? (a.categoryName ?? "").localeCompare(b.categoryName ?? "") : a.budget.scope === "overall" ? -1 : 1)),
    totalEver,
  };
}
