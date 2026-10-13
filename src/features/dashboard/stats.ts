import { CategoryTotal } from "../../repo/transactions";
import { daysInMonth, monthOf, YearMonth } from "../../utils/date";

export interface AveragePerDay {
  /** Rounded paise per day; null for a month that hasn't started. */
  averagePaise: number | null;
  days: number;
  basis: "elapsed" | "full_month" | "future";
  /** e.g. "Average per day (13 days so far)" */
  label: string;
}

/**
 * Average spending per day for a month.
 * - current month: divide by days elapsed including today
 * - past month: divide by days in that month
 * - future month: no average
 */
export function averagePerDay(month: YearMonth, totalPaise: number, today: string): AveragePerDay {
  const now = monthOf(today);
  const cmp = month.year * 12 + month.month - (now.year * 12 + now.month);
  if (cmp > 0) return { averagePaise: null, days: 0, basis: "future", label: "Month hasn't started yet" };
  if (cmp === 0) {
    const days = Number(today.slice(8, 10));
    return {
      averagePaise: Math.round(totalPaise / days),
      days,
      basis: "elapsed",
      label: `Average per day (${days} ${days === 1 ? "day" : "days"} so far)`,
    };
  }
  const days = daysInMonth(month.year, month.month);
  return { averagePaise: Math.round(totalPaise / days), days, basis: "full_month", label: `Average per day (all ${days} days)` };
}

export interface CategoryShare extends CategoryTotal {
  /** Share of the month's spending, one decimal, e.g. 42.5 */
  percent: number;
}

/** Adds percentages to category totals (already sorted largest first). */
export function categoryShares(totals: readonly CategoryTotal[]): CategoryShare[] {
  const sum = totals.reduce((s, t) => s + t.totalPaise, 0);
  return totals.map((t) => ({ ...t, percent: sum === 0 ? 0 : Math.round((t.totalPaise * 1000) / sum) / 10 }));
}

/** First n categories; the rest merged into "Other categories" so the chart stays readable. */
export function chartSlices(shares: readonly CategoryShare[], max = 6, otherColor = "#9E9E9E"): { key: string; label: string; value: number; color: string; percent: number }[] {
  const head = shares.slice(0, max).map((s) => ({ key: s.categoryId, label: s.name, value: s.totalPaise, color: s.color, percent: s.percent }));
  const rest = shares.slice(max);
  if (rest.length) {
    head.push({
      key: "__other",
      label: `${rest.length} more`,
      value: rest.reduce((a, r) => a + r.totalPaise, 0),
      color: otherColor,
      percent: Math.round(rest.reduce((a, r) => a + r.percent, 0) * 10) / 10,
    });
  }
  return head;
}
