import { addDays, daysInMonth, parseDateString, toDateString } from "../../utils/date";

export type Frequency = "weekly" | "monthly";

export interface ScheduleSpec {
  frequency: Frequency;
  /** First occurrence (YYYY-MM-DD). Weekly repeats on this weekday. */
  startDate: string;
  /** Monthly only: 1-31. Months without that day use their last day (31 → 30 Apr, 28/29 Feb). */
  dayOfMonth: number | null;
}

/** Due date of a monthly template in a given month, clamped to the month's last day. */
export function monthlyDueDate(year: number, month: number, dayOfMonth: number): string {
  return toDateString(year, month, Math.min(dayOfMonth, daysInMonth(year, month)));
}

/** All due dates in [from, to] (inclusive), never before startDate. Capped at `max` dates. */
export function occurrencesBetween(spec: ScheduleSpec, from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  const lower = from > spec.startDate ? from : spec.startDate;
  if (lower > to) return out;
  if (spec.frequency === "weekly") {
    // Jump to the first weekly date >= lower.
    const start = parseDateString(spec.startDate);
    const low = parseDateString(lower);
    const diff = Math.round((Date.UTC(low.year, low.month - 1, low.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000);
    let d = addDays(spec.startDate, Math.ceil(diff / 7) * 7);
    while (d <= to && out.length < max) {
      out.push(d);
      d = addDays(d, 7);
    }
    return out;
  }
  const dom = spec.dayOfMonth ?? parseDateString(spec.startDate).day;
  let { year, month } = parseDateString(lower);
  for (;;) {
    const d = monthlyDueDate(year, month, dom);
    if (d > to || out.length >= max) break;
    if (d >= lower) out.push(d);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** How far ahead "Due soon" looks, and how far back unhandled ones stay visible. */
export const DUE_SOON_DAYS_AHEAD = 7;
export const OVERDUE_DAYS_BACK = 60;

export function dueWindow(today: string): { from: string; to: string } {
  return { from: addDays(today, -OVERDUE_DAYS_BACK), to: addDays(today, DUE_SOON_DAYS_AHEAD) };
}
