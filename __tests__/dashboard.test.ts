import { loadDashboard } from "../src/features/dashboard/loadDashboard";
import { averagePerDay, categoryShares, chartSlices } from "../src/features/dashboard/stats";
import { createRepositories, Repositories } from "../src/repo";
import { budgetLevel } from "../src/repo/budgets";
import { TransactionInput } from "../src/repo/transactions";
import { createMigratedDatabase } from "../test-utils/nodeDb";

let repos: Repositories;
beforeEach(async () => {
  repos = createRepositories((await createMigratedDatabase()).db);
});
const tx = (o: Partial<TransactionInput> = {}): TransactionInput => ({
  amountPaise: 10000, date: "2026-10-05", categoryId: "cat_food", paymentMethod: "upi", status: "paid", ...o,
});
const OCT = { year: 2026, month: 10 };

describe("averagePerDay", () => {
  it("current month divides by days elapsed (including today)", () => {
    expect(averagePerDay(OCT, 130000, "2026-10-13")).toEqual({ averagePaise: 10000, days: 13, basis: "elapsed", label: "Average per day (13 days so far)" });
    expect(averagePerDay(OCT, 500, "2026-10-01").label).toBe("Average per day (1 day so far)");
  });
  it("past months divide by days in month, incl. leap February", () => {
    expect(averagePerDay({ year: 2026, month: 9 }, 300000, "2026-10-13")).toMatchObject({ averagePaise: 10000, days: 30, basis: "full_month", label: "Average per day (all 30 days)" });
    expect(averagePerDay({ year: 2028, month: 2 }, 2900, "2028-03-01")).toMatchObject({ averagePaise: 100, days: 29 });
    expect(averagePerDay({ year: 2025, month: 12 }, 3100, "2026-01-01")).toMatchObject({ days: 31, basis: "full_month" });
  });
  it("future months have no average", () => {
    expect(averagePerDay({ year: 2026, month: 11 }, 0, "2026-10-13")).toEqual({ averagePaise: null, days: 0, basis: "future", label: "Month hasn't started yet" });
    expect(averagePerDay({ year: 2027, month: 1 }, 0, "2026-12-31").basis).toBe("future");
  });
  it("empty month averages to zero", () => {
    expect(averagePerDay(OCT, 0, "2026-10-13").averagePaise).toBe(0);
  });
  it("returns integer paise", () => {
    expect(Number.isInteger(averagePerDay(OCT, 100, "2026-10-03").averagePaise)).toBe(true);
  });
});

describe("budget thresholds", () => {
  it("ok below 80%, warning at 80%, over at 100%", () => {
    expect(budgetLevel(7999, 10000)).toBe("ok");
    expect(budgetLevel(8000, 10000)).toBe("warning");
    expect(budgetLevel(9999, 10000)).toBe("warning");
    expect(budgetLevel(10000, 10000)).toBe("over");
    expect(budgetLevel(25000, 10000)).toBe("over");
    expect(budgetLevel(0, 10000)).toBe("ok");
    expect(budgetLevel(80, 101)).toBe("ok"); // 79.2%
  });
  it("progress uses status rules (refunded excluded, pending included) and levels", async () => {
    await repos.transactions.create(tx({ amountPaise: 6000 }));
    await repos.transactions.create(tx({ amountPaise: 2000, status: "pending" }));
    await repos.transactions.create(tx({ amountPaise: 50000, status: "refunded" }));
    await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 10000 });
    const [p] = await repos.budgets.progress(OCT);
    expect(p).toMatchObject({ spentPaise: 8000, remainingPaise: 2000, percentUsed: 80, level: "warning", overBudget: false });
    await repos.transactions.create(tx({ amountPaise: 2000 }));
    const [q] = await repos.budgets.progress(OCT);
    expect(q).toMatchObject({ spentPaise: 10000, remainingPaise: 0, percentUsed: 100, level: "over" });
  });
  it("enable/disable", async () => {
    const b = await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 10000 });
    await repos.budgets.setEnabled(b.id, false);
    expect(await repos.budgets.progress(OCT)).toHaveLength(0);
    await repos.budgets.setEnabled(b.id, true);
    expect(await repos.budgets.progress(OCT)).toHaveLength(1);
  });
});

describe("category shares and chart slices", () => {
  const t = (id: string, total: number) => ({ categoryId: id, name: id, color: "#000000", icon: "x", isArchived: false, totalPaise: total, count: 1 });
  it("computes percentages to one decimal", () => {
    expect(categoryShares([t("a", 2), t("b", 1)]).map((s) => s.percent)).toEqual([66.7, 33.3]);
    expect(categoryShares([])).toEqual([]);
  });
  it("merges small categories beyond the limit", () => {
    const shares = categoryShares([t("a", 50), t("b", 20), t("c", 20), t("d", 10)]);
    const slices = chartSlices(shares, 2);
    expect(slices.map((s) => [s.label, s.value, s.percent])).toEqual([["a", 50, 50], ["b", 20, 20], ["2 more", 30, 30]]);
  });
});

describe("loadDashboard", () => {
  it("empty database: zeros, first-run flag", async () => {
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.totalEver).toBe(0);
    expect(d.summary.totalPaise).toBe(0);
    expect(d.categories).toEqual([]);
    expect(d.recent).toEqual([]);
    expect(d.average.averagePaise).toBe(0);
    expect(d.comparison.label).toBe("Same as Sep 2026");
  });

  it("totals, year total, comparison and breakdown follow status rules", async () => {
    await repos.transactions.create(tx({ amountPaise: 30000, date: "2026-10-02" }));
    await repos.transactions.create(tx({ amountPaise: 10000, date: "2026-10-03", status: "pending", categoryId: "cat_travel" }));
    await repos.transactions.create(tx({ amountPaise: 99900, date: "2026-10-04", status: "refunded" }));
    await repos.transactions.create(tx({ amountPaise: 20000, date: "2026-09-10" }));
    await repos.transactions.create(tx({ amountPaise: 5000, date: "2025-12-31" }));
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.summary.totalPaise).toBe(40000);
    expect(d.summary.count).toBe(2);
    expect(d.yearTotalPaise).toBe(60000);
    expect(d.comparison.label).toBe("Up 100.0% vs Sep 2026");
    expect(d.categories.map((c) => [c.name, c.totalPaise, c.percent])).toEqual([["Food", 30000, 75], ["Travel", 10000, 25]]);
    expect(d.recent).toHaveLength(3); // refunded still listed in recent
    expect(d.average).toMatchObject({ averagePaise: 3077, days: 13 });
    expect(d.totalEver).toBe(5);
  });

  it("an empty month shows zeros even when other months have data", async () => {
    await repos.transactions.create(tx({ date: "2026-09-10" }));
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.summary.totalPaise).toBe(0);
    expect(d.comparison.label).toBe("Down 100.0% vs Sep 2026");
    expect(d.totalEver).toBe(1);
  });

  it("archived categories still appear in the breakdown with their history", async () => {
    await repos.transactions.create(tx({ categoryId: "cat_pets", amountPaise: 4200 }));
    await repos.categories.setArchived("cat_pets", true);
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.categories).toEqual([expect.objectContaining({ categoryId: "cat_pets", isArchived: true, totalPaise: 4200, percent: 100 })]);
  });

  it("budgets carry category names; overall first", async () => {
    await repos.budgets.upsert({ scope: "category", categoryId: "cat_food", monthlyAmountPaise: 100 });
    await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 1000 });
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.budgets.map((b) => b.categoryName)).toEqual([null, "Food"]);
  });
});

describe("category reassignment", () => {
  it("moves all expenses, preserves overall totals and amounts, then allows delete", async () => {
    await repos.transactions.create(tx({ categoryId: "cat_pets", amountPaise: 1111 }));
    await repos.transactions.create(tx({ categoryId: "cat_pets", amountPaise: 2222, status: "refunded" }));
    await repos.transactions.create(tx({ categoryId: "cat_food", amountPaise: 3333 }));
    const before = await repos.transactions.summary({});
    const moved = await repos.categories.reassignTransactions("cat_pets", "cat_food");
    expect(moved).toBe(2);
    const after = await repos.transactions.summary({});
    expect(after).toEqual(before);
    const d = await loadDashboard(repos, OCT, "2026-10-13");
    expect(d.categories.map((c) => [c.categoryId, c.totalPaise])).toEqual([["cat_food", 4444]]);
    expect(await repos.categories.transactionCount("cat_pets")).toBe(0);
    await repos.categories.deleteIfUnused("cat_pets");
    expect(await repos.categories.getById("cat_pets")).toBeNull();
  });

  it("moves the category budget when the target has none", async () => {
    await repos.budgets.upsert({ scope: "category", categoryId: "cat_pets", monthlyAmountPaise: 500 });
    await repos.categories.reassignTransactions("cat_pets", "cat_home");
    expect((await repos.budgets.list())[0].categoryId).toBe("cat_home");
  });

  it("rejects same, missing or archived targets", async () => {
    await expect(repos.categories.reassignTransactions("cat_food", "cat_food")).rejects.toMatchObject({ field: "toId" });
    await expect(repos.categories.reassignTransactions("cat_food", "nope")).rejects.toMatchObject({ field: "toId" });
    await repos.categories.setArchived("cat_home", true);
    await expect(repos.categories.reassignTransactions("cat_food", "cat_home")).rejects.toMatchObject({ field: "toId" });
  });
});
