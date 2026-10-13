import {
  addDays, addMonths, compareWithPreviousMonth, daysInMonth, formatDateLabel, isLeapYear, isValidDateString,
  isValidTimeString, monthLabel, monthOf, monthRange, nextMonth, previousMonth, todayLocal, yearRange,
} from "../src/utils/date";

describe("leap years and month lengths", () => {
  it("knows leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
  it("Feb 29 exists only in leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(isValidDateString("2024-02-29")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(monthRange(2024, 2)).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("month boundaries", () => {
    expect(monthRange(2026, 4)).toEqual({ start: "2026-04-01", end: "2026-04-30" });
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
  });
});

describe("year boundary", () => {
  it("Dec 31 -> Jan 1", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
    expect(previousMonth({ year: 2027, month: 1 })).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2026, month: 10 }, -22)).toEqual({ year: 2024, month: 12 });
    expect(yearRange(2026)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("validation and labels", () => {
  it("rejects malformed dates and times", () => {
    for (const bad of ["2026-13-01", "2026-00-10", "2026-04-31", "26-01-01", "2026/01/01", "2026-1-1", ""]) {
      expect(isValidDateString(bad)).toBe(false);
    }
    expect(isValidTimeString("09:05")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);
    expect(isValidTimeString("24:00")).toBe(false);
    expect(isValidTimeString("9:05")).toBe(false);
  });
  it("labels", () => {
    expect(monthLabel({ year: 2026, month: 10 })).toBe("Oct 2026");
    expect(formatDateLabel("2026-10-03")).toBe("3 Oct 2026");
    expect(monthOf("2026-10-13")).toEqual({ year: 2026, month: 10 });
  });
  it("todayLocal uses the local calendar date, not UTC", () => {
    const d = new Date(2026, 11, 31, 23, 59); // local 31 Dec, 23:59
    expect(todayLocal(d)).toBe("2026-12-31");
  });
});

describe("month-over-month comparison", () => {
  const oct = { year: 2026, month: 10 };
  it("up", () => {
    const c = compareWithPreviousMonth(oct, 125000, 100000);
    expect(c.direction).toBe("up");
    expect(c.differencePaise).toBe(25000);
    expect(c.percentChange).toBe(25);
    expect(c.label).toBe("Up 25.0% vs Sep 2026");
  });
  it("down", () => {
    const c = compareWithPreviousMonth(oct, 66667, 100000);
    expect(c.direction).toBe("down");
    expect(c.label).toBe("Down 33.3% vs Sep 2026");
  });
  it("same and no previous data", () => {
    expect(compareWithPreviousMonth(oct, 5000, 5000).label).toBe("Same as Sep 2026");
    const none = compareWithPreviousMonth(oct, 5000, 0);
    expect(none.percentChange).toBeNull();
    expect(none.label).toBe("No spending in Sep 2026 to compare");
    expect(compareWithPreviousMonth(oct, 0, 0).label).toBe("Same as Sep 2026");
  });
  it("January compares with December of the previous year", () => {
    expect(compareWithPreviousMonth({ year: 2027, month: 1 }, 200, 100).label).toBe("Up 100.0% vs Dec 2026");
  });
});
