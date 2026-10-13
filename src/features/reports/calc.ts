import { PAYMENT_METHOD_LABELS, PaymentMethod } from "../../constants/categories";
import { Repositories } from "../../repo";
import { SpendingSummary } from "../../repo/transactions";
import { addDays, DateRange, formatDateLabel, monthLabel, parseDateString } from "../../utils/date";
import { categoryShares, CategoryShare } from "../dashboard/stats";

export type WeekStart = "monday" | "sunday";
export type Granularity = "day" | "week" | "month";

export interface TrendPoint {
  key: string;
  /** Short axis label, e.g. "5", "W 6 Oct", "Oct" */
  label: string;
  /** Full label for the text table, e.g. "6 Oct 2026 – 12 Oct 2026" */
  longLabel: string;
  totalPaise: number;
  /** True when the bucket is only partly inside the chosen range or reaches past today. */
  partial: boolean;
}

/** Number of calendar days in an inclusive range. */
export function daysInRange(range: DateRange): number {
  const a = parseDateString(range.start);
  const b = parseDateString(range.end);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000) + 1;
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(date: string): number {
  const { year, month, day } = parseDateString(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** First day of the week containing `date`. */
export function startOfWeek(date: string, weekStart: WeekStart): string {
  const dow = dayOfWeek(date);
  const back = weekStart === "monday" ? (dow + 6) % 7 : dow;
  return addDays(date, -back);
}

export function chooseGranularity(range: DateRange): Granularity {
  const days = daysInRange(range);
  if (days <= 31) return "day";
  if (days <= 184) return "week";
  return "month";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Builds a continuous trend series (zero-filled) from per-day totals.
 * Days after `today` are flagged partial so a half-finished period is never mistaken for a full one.
 */
export function buildTrend(
  range: DateRange,
  dayTotals: readonly { date: string; totalPaise: number }[],
  granularity: Granularity,
  weekStart: WeekStart,
  today: string,
  formatDate: (date: string) => string = formatDateLabel,
): TrendPoint[] {
  const byDay = new Map(dayTotals.map((d) => [d.date, d.totalPaise]));
  const points = new Map<string, TrendPoint>();
  const days = daysInRange(range);
  for (let i = 0; i < days; i++) {
    const date = addDays(range.start, i);
    let key: string;
    let label: string;
    let longLabel: string;
    let partial = false;
    if (granularity === "day") {
      key = date;
      label = String(parseDateString(date).day);
      longLabel = formatDate(date);
      partial = date > today;
    } else if (granularity === "week") {
      const ws = startOfWeek(date, weekStart);
      const we = addDays(ws, 6);
      key = ws;
      const { day, month } = parseDateString(ws);
      label = `${day} ${MONTHS[month - 1]}`;
      longLabel = `${formatDate(ws)} – ${formatDate(we)}`;
      partial = ws < range.start || we > range.end || we > today;
    } else {
      key = date.slice(0, 7);
      const { year, month } = parseDateString(date);
      label = MONTHS[month - 1];
      longLabel = monthLabel({ year, month });
      const first = `${key}-01`;
      const last = addDays(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`, -1);
      partial = first < range.start || last > range.end || last > today;
    }
    const p = points.get(key) ?? { key, label, longLabel, totalPaise: 0, partial };
    p.totalPaise += byDay.get(date) ?? 0;
    p.partial = p.partial || partial;
    points.set(key, p);
  }
  return [...points.values()];
}

export interface PeriodInfo {
  days: number;
  /** Days of the range up to and including today (0 if the range is in the future). */
  elapsedDays: number;
  state: "complete" | "in_progress" | "future";
  note: string;
}

export function periodInfo(range: DateRange, today: string): PeriodInfo {
  const days = daysInRange(range);
  if (today < range.start) return { days, elapsedDays: 0, state: "future", note: "This period hasn't started yet." };
  if (today >= range.end) return { days, elapsedDays: days, state: "complete", note: `Complete period of ${days} ${days === 1 ? "day" : "days"}.` };
  const elapsed = daysInRange({ start: range.start, end: today });
  return { days, elapsedDays: elapsed, state: "in_progress", note: `In progress: ${elapsed} of ${days} days so far.` };
}

export interface ReportData {
  range: DateRange;
  info: PeriodInfo;
  summary: SpendingSummary;
  /** Rounded paise per elapsed day; null for a future period. */
  averagePerDayPaise: number | null;
  categories: CategoryShare[];
  merchants: { id: string; name: string; totalPaise: number; count: number; percent: number }[];
  paymentMethods: { method: PaymentMethod; label: string; totalPaise: number; count: number; percent: number }[];
  /** Spending with no merchant recorded (so merchant percentages add up). */
  noMerchantPaise: number;
  granularity: Granularity;
  trend: TrendPoint[];
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part * 1000) / whole) / 10);

/** All numbers for a report period, from saved transactions with the shared status rule. */
export async function loadReport(
  repos: Repositories,
  range: DateRange,
  today: string,
  weekStart: WeekStart,
  granularity?: Granularity,
  formatDate: (date: string) => string = formatDateLabel,
): Promise<ReportData> {
  const [summary, byCat, byMerchant, byMethod, byDay] = await Promise.all([
    repos.transactions.summary({ range }),
    repos.transactions.totalsByCategory(range),
    repos.transactions.totalsByMerchant(range, 1000),
    repos.transactions.totalsByPaymentMethod(range),
    repos.transactions.totalsByDay(range),
  ]);
  const info = periodInfo(range, today);
  const g = granularity ?? chooseGranularity(range);
  const merchantTotal = byMerchant.reduce((s, m) => s + m.totalPaise, 0);
  return {
    range,
    info,
    summary,
    averagePerDayPaise: info.elapsedDays === 0 ? null : Math.round(summary.totalPaise / info.elapsedDays),
    categories: categoryShares(byCat),
    merchants: byMerchant.map((m) => ({ id: m.merchantId, name: m.name, totalPaise: m.totalPaise, count: m.count, percent: pct(m.totalPaise, summary.totalPaise) })),
    noMerchantPaise: summary.totalPaise - merchantTotal,
    paymentMethods: byMethod.map((p) => ({ method: p.paymentMethod, label: PAYMENT_METHOD_LABELS[p.paymentMethod], totalPaise: p.totalPaise, count: p.count, percent: pct(p.totalPaise, summary.totalPaise) })),
    granularity: g,
    trend: buildTrend(range, byDay, g, weekStart, today, formatDate),
  };
}
