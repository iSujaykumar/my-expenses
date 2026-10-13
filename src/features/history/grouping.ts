import { countsAsSpending, TransactionStatus } from "../../constants/categories";
import { formatDateLabel, addDays } from "../../utils/date";

export interface GroupableTransaction {
  id: string;
  date: string;
  amountPaise: number;
  status: TransactionStatus;
}

export type HistoryItem<T extends GroupableTransaction> =
  | { type: "header"; key: string; date: string; label: string; dayTotalPaise: number; count: number }
  | { type: "row"; key: string; transaction: T };

/** "Today", "Yesterday" or "13 Oct 2026". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatDateLabel(date);
}

/**
 * Turns a date-sorted list into a flat list of [header, rows..., header, rows...] for a virtualized list.
 * Day totals follow the status rule (refunded excluded). Works for any sort: when sorted by amount,
 * rows are still grouped by consecutive dates, so callers should group only date sorts.
 */
export function groupByDate<T extends GroupableTransaction>(rows: readonly T[], today: string): HistoryItem<T>[] {
  const items: HistoryItem<T>[] = [];
  let header: Extract<HistoryItem<T>, { type: "header" }> | null = null;
  for (const t of rows) {
    if (!header || header.date !== t.date) {
      header = { type: "header", key: `h_${t.date}_${items.length}`, date: t.date, label: dayLabel(t.date, today), dayTotalPaise: 0, count: 0 };
      items.push(header);
    }
    header.count += 1;
    if (countsAsSpending(t.status)) header.dayTotalPaise += t.amountPaise;
    items.push({ type: "row", key: t.id, transaction: t });
  }
  return items;
}

/** Flat rows without headers (used for amount sorts). */
export function ungrouped<T extends GroupableTransaction>(rows: readonly T[]): HistoryItem<T>[] {
  return rows.map((t) => ({ type: "row" as const, key: t.id, transaction: t }));
}

/** Indices of header items (for sticky headers). */
export function headerIndices<T extends GroupableTransaction>(items: readonly HistoryItem<T>[]): number[] {
  const out: number[] = [];
  items.forEach((it, i) => {
    if (it.type === "header") out.push(i);
  });
  return out;
}
