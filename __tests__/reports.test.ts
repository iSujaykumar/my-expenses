import { buildTrend, chooseGranularity, daysInRange, dayOfWeek, loadReport, periodInfo, startOfWeek } from "../src/features/reports/calc";
import { createRepositories, Repositories } from "../src/repo";
import { TransactionInput } from "../src/repo/transactions";
import { monthRange, yearRange } from "../src/utils/date";
import { createMigratedDatabase } from "../test-utils/nodeDb";

let repos: Repositories;
beforeEach(async () => {
  repos = createRepositories((await createMigratedDatabase()).db);
});
const tx = (o: Partial<TransactionInput> = {}): TransactionInput => ({ amountPaise: 1000, date: "2026-10-05", categoryId: "cat_food", paymentMethod: "upi", status: "paid", ...o });

describe("calendar helpers", () => {
  it("counts days and weekdays", () => {
    expect(daysInRange(monthRange(2028, 2))).toBe(29);
    expect(daysInRange(yearRange(2026))).toBe(365);
    expect(dayOfWeek("2026-10-13")).toBe(2); // Tuesday
  });
  it("week start follows the setting", () => {
    expect(startOfWeek("2026-10-13", "monday")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-13", "sunday")).toBe("2026-10-11");
    expect(startOfWeek("2026-10-11", "monday")).toBe("2026-10-05"); // Sunday belongs to previous Monday week
    expect(startOfWeek("2026-10-11", "sunday")).toBe("2026-10-11");
    expect(startOfWeek("2027-01-01", "monday")).toBe("2026-12-28"); // across the year boundary
  });
  it("chooses granularity by range length", () => {
    expect(chooseGranularity(monthRange(2026, 10))).toBe("day");
    expect(chooseGranularity({ start: "2026-08-01", end: "2026-10-31" })).toBe("week");
    expect(chooseGranularity(yearRange(2026))).toBe("month");
  });
  it("period info: complete, in progress (partial), future", () => {
    expect(periodInfo(monthRange(2026, 9), "2026-10-13")).toMatchObject({ state: "complete", elapsedDays: 30 });
    expect(periodInfo(monthRange(2026, 10), "2026-10-13")).toMatchObject({ state: "in_progress", elapsedDays: 13, note: "In progress: 13 of 31 days so far." });
    expect(periodInfo(monthRange(2026, 11), "2026-10-13")).toMatchObject({ state: "future", elapsedDays: 0 });
  });
});

describe("trend series", () => {
  const range = { start: "2026-10-01", end: "2026-10-14" };
  const days = [{ date: "2026-10-01", totalPaise: 100 }, { date: "2026-10-11", totalPaise: 50 }, { date: "2026-10-12", totalPaise: 25 }];
  it("daily: zero-filled, future days flagged partial", () => {
    const t = buildTrend(range, days, "day", "monday", "2026-10-13");
    expect(t).toHaveLength(14);
    expect(t[0]).toMatchObject({ key: "2026-10-01", label: "1", totalPaise: 100, partial: false });
    expect(t[1].totalPaise).toBe(0);
    expect(t[13]).toMatchObject({ key: "2026-10-14", partial: true });
  });
  it("weekly buckets move with the week start setting", () => {
    const mon = buildTrend(range, days, "week", "monday", "2026-10-31");
    expect(mon.map((p) => [p.key, p.totalPaise])).toEqual([["2026-09-28", 100], ["2026-10-05", 50], ["2026-10-12", 25]]);
    const sun = buildTrend(range, days, "week", "sunday", "2026-10-31");
    expect(sun.map((p) => [p.key, p.totalPaise])).toEqual([["2026-09-27", 100], ["2026-10-04", 0], ["2026-10-11", 75]]);
    expect(mon[0].partial).toBe(true); // starts before the range
    expect(mon[1].partial).toBe(false);
  });
  it("monthly buckets across a year, partial current month", () => {
    const t = buildTrend(yearRange(2026), [{ date: "2026-02-28", totalPaise: 7 }], "month", "monday", "2026-10-13");
    expect(t).toHaveLength(12);
    expect(t[1]).toMatchObject({ key: "2026-02", label: "Feb", totalPaise: 7, partial: false });
    expect(t[9]).toMatchObject({ key: "2026-10", partial: true });
    expect(t.reduce((s, p) => s + p.totalPaise, 0)).toBe(7);
  });
});

describe("loadReport", () => {
  it("empty month: all zeros, no NaN", async () => {
    const r = await loadReport(repos, monthRange(2026, 9), "2026-10-13", "monday");
    expect(r.summary.totalPaise).toBe(0);
    expect(r.averagePerDayPaise).toBe(0);
    expect(r.categories).toEqual([]);
    expect(r.merchants).toEqual([]);
    expect(r.paymentMethods).toEqual([]);
    expect(r.trend).toHaveLength(30);
    expect(r.trend.every((p) => p.totalPaise === 0)).toBe(true);
  });

  it("partial month averages over elapsed days; future period has no average", async () => {
    await repos.transactions.create(tx({ amountPaise: 1300, date: "2026-10-02" }));
    const r = await loadReport(repos, monthRange(2026, 10), "2026-10-13", "monday");
    expect(r.info.state).toBe("in_progress");
    expect(r.averagePerDayPaise).toBe(100);
    const f = await loadReport(repos, monthRange(2026, 12), "2026-10-13", "monday");
    expect(f.averagePerDayPaise).toBeNull();
  });

  it("breakdowns apply status rules and percentages add up with 'no merchant'", async () => {
    const m = await repos.merchants.getOrCreate("Swiggy");
    await repos.transactions.create(tx({ amountPaise: 3000, merchantId: m.id, paymentMethod: "upi" }));
    await repos.transactions.create(tx({ amountPaise: 1000, status: "pending", paymentMethod: "cash", categoryId: "cat_travel" }));
    await repos.transactions.create(tx({ amountPaise: 9999, status: "refunded", merchantId: m.id, paymentMethod: "credit_card" }));
    const r = await loadReport(repos, monthRange(2026, 10), "2026-10-31", "monday");
    expect(r.summary.totalPaise).toBe(4000);
    expect(r.categories.map((c) => [c.name, c.percent])).toEqual([["Food", 75], ["Travel", 25]]);
    expect(r.merchants).toEqual([{ id: m.id, name: "Swiggy", totalPaise: 3000, count: 1, percent: 75 }]);
    expect(r.noMerchantPaise).toBe(1000);
    expect(r.paymentMethods.map((p) => [p.label, p.totalPaise, p.percent])).toEqual([["UPI", 3000, 75], ["Cash", 1000, 25]]);
    expect(r.trend.reduce((s, p) => s + p.totalPaise, 0)).toBe(4000);
  });

  it("custom range across a year boundary uses weekly trend and week start", async () => {
    await repos.transactions.create(tx({ date: "2026-12-31", amountPaise: 100 }));
    await repos.transactions.create(tx({ date: "2027-01-03", amountPaise: 200 })); // Sunday
    const range = { start: "2026-11-15", end: "2027-01-31" };
    const mon = await loadReport(repos, range, "2027-02-01", "monday");
    expect(mon.granularity).toBe("week");
    expect(mon.trend.find((p) => p.key === "2026-12-28")?.totalPaise).toBe(300);
    const sun = await loadReport(repos, range, "2027-02-01", "sunday");
    expect(sun.trend.find((p) => p.key === "2026-12-27")?.totalPaise).toBe(100);
    expect(sun.trend.find((p) => p.key === "2027-01-03")?.totalPaise).toBe(200);
  });
});
