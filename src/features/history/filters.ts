import { PaymentMethod, TransactionStatus } from "../../constants/categories";
import { TransactionFilter } from "../../repo/transactions";
import { addMonths, DateRange, monthOf, monthRange, yearRange } from "../../utils/date";

export type DatePreset = "all" | "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";
export type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface HistoryFilters {
  search: string;
  datePreset: DatePreset;
  customRange: DateRange | null;
  categoryIds: string[];
  merchantIds: string[];
  paymentMethods: PaymentMethod[];
  statuses: TransactionStatus[];
  sort: SortOption;
}

export const DEFAULT_FILTERS: HistoryFilters = {
  search: "",
  datePreset: "all",
  customRange: null,
  categoryIds: [],
  merchantIds: [],
  paymentMethods: [],
  statuses: [],
  sort: "date_desc",
};

export const SORT_LABELS: Record<SortOption, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  amount_desc: "Highest amount",
  amount_asc: "Lowest amount",
};

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  this_year: "This year",
  custom: "Custom range",
};

/** Resolves a preset into a concrete inclusive range, or undefined for all time. */
export function resolveDateRange(filters: HistoryFilters, today: string): DateRange | undefined {
  const now = monthOf(today);
  switch (filters.datePreset) {
    case "this_month":
      return monthRange(now.year, now.month);
    case "last_month": {
      const p = addMonths(now, -1);
      return monthRange(p.year, p.month);
    }
    case "last_3_months": {
      const first = addMonths(now, -2);
      return { start: monthRange(first.year, first.month).start, end: monthRange(now.year, now.month).end };
    }
    case "this_year":
      return yearRange(now.year);
    case "custom":
      return filters.customRange ?? undefined;
    default:
      return undefined;
  }
}

/** Converts UI filters into a repository query. */
export function toTransactionFilter(filters: HistoryFilters, today: string): TransactionFilter {
  return {
    search: filters.search.trim() || undefined,
    range: resolveDateRange(filters, today),
    categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
    merchantIds: filters.merchantIds.length ? filters.merchantIds : undefined,
    paymentMethods: filters.paymentMethods.length ? filters.paymentMethods : undefined,
    statuses: filters.statuses.length ? filters.statuses : undefined,
    sort: filters.sort,
  };
}

/** Number of active filters (search and sort not counted). */
export function activeFilterCount(f: HistoryFilters): number {
  return (
    (f.datePreset !== "all" ? 1 : 0) +
    (f.categoryIds.length ? 1 : 0) +
    (f.merchantIds.length ? 1 : 0) +
    (f.paymentMethods.length ? 1 : 0) +
    (f.statuses.length ? 1 : 0)
  );
}

export function hasAnyFilter(f: HistoryFilters): boolean {
  return activeFilterCount(f) > 0 || f.search.trim() !== "" || f.sort !== DEFAULT_FILTERS.sort;
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
