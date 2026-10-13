/**
 * Calendar-date helpers. Expense dates are plain "YYYY-MM-DD" strings, so
 * time zones can never move them. All arithmetic uses UTC internally.
 */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DateRange {
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /** Inclusive end, YYYY-MM-DD. */
  end: string;
}

export interface YearMonth {
  year: number;
  /** 1-12 */
  month: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) throw new RangeError("month must be 1-12");
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function toDateString(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Strict validation of a real calendar date string (rejects 2025-02-29, 2026-13-01 ...). */
export function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (year < 1900 || year > 2999 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function parseDateString(value: string): { year: number; month: number; day: number } {
  if (!isValidDateString(value)) throw new RangeError("Invalid date");
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Valid "HH:MM" 24-hour time. */
export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** The device's local calendar date as YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Adds (or subtracts) whole days to a date string. */
export function addDays(date: string, days: number): string {
  const { year, month, day } = parseDateString(date);
  const t = new Date(Date.UTC(year, month - 1, day + days));
  return toDateString(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function monthOf(date: string): YearMonth {
  const { year, month } = parseDateString(date);
  return { year, month };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const previousMonth = (ym: YearMonth) => addMonths(ym, -1);
export const nextMonth = (ym: YearMonth) => addMonths(ym, 1);

export function monthRange(year: number, month: number): DateRange {
  return { start: toDateString(year, month, 1), end: toDateString(year, month, daysInMonth(year, month)) };
}

export function yearRange(year: number): DateRange {
  return { start: toDateString(year, 1, 1), end: toDateString(year, 12, 31) };
}

/** "YYYY-MM" key used by monthly aggregations. */
export function monthKey(ym: YearMonth): string {
  return `${ym.year}-${pad2(ym.month)}`;
}

/** "Oct 2026" */
export function monthLabel(ym: YearMonth): string {
  return `${MONTH_SHORT[ym.month - 1]} ${ym.year}`;
}

/** "13 Oct 2026" */
export function formatDateLabel(date: string): string {
  const { year, month, day } = parseDateString(date);
  return `${day} ${MONTH_SHORT[month - 1]} ${year}`;
}

export interface MonthComparison {
  current: YearMonth;
  previous: YearMonth;
  currentPaise: number;
  previousPaise: number;
  /** current - previous, in paise */
  differencePaise: number;
  direction: "up" | "down" | "same";
  /** Percent change rounded to 1 decimal; null when previous month is 0. */
  percentChange: number | null;
  /** e.g. "Up 25.0% vs Sep 2026", "Same as Sep 2026", "No spending in Sep 2026 to compare" */
  label: string;
}

/** Compares a month's spending with the month before it. */
export function compareWithPreviousMonth(current: YearMonth, currentPaise: number, previousPaise: number): MonthComparison {
  const previous = previousMonth(current);
  const differencePaise = currentPaise - previousPaise;
  const direction = differencePaise > 0 ? "up" : differencePaise < 0 ? "down" : "same";
  const prevLabel = monthLabel(previous);
  let percentChange: number | null = null;
  let label: string;
  if (previousPaise === 0) {
    label = currentPaise === 0 ? `Same as ${prevLabel}` : `No spending in ${prevLabel} to compare`;
  } else {
    percentChange = Math.round((Math.abs(differencePaise) * 1000) / previousPaise) / 10;
    label =
      direction === "same"
        ? `Same as ${prevLabel}`
        : `${direction === "up" ? "Up" : "Down"} ${percentChange.toFixed(1)}% vs ${prevLabel}`;
  }
  return { current, previous, currentPaise, previousPaise, differencePaise, direction, percentChange, label };
}
