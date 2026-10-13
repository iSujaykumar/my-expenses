import { createRepositories, Repositories } from "../src/repo";
import { TransactionInput } from "../src/repo/transactions";
import { monthRange } from "../src/utils/date";
import { createMigratedDatabase } from "../test-utils/nodeDb";

const OCT = monthRange(2026, 10);

let repos: Repositories;
beforeEach(async () => {
  repos = createRepositories((await createMigratedDatabase()).db);
});

const tx = (overrides: Partial<TransactionInput> = {}): TransactionInput => ({
  amountPaise: 10000,
  description: "Lunch",
  date: "2026-10-05",
  categoryId: "cat_food",
  paymentMethod: "upi",
  status: "paid",
  ...overrides,
});

describe("transactions CRUD", () => {
  it("creates with id + timestamps and reads back with category details", async () => {
    const t = await repos.transactions.create(tx({ time: "13:30", notes: "  team  " }));
    expect(t.id).toMatch(/^txn_/);
    expect(t.createdAt).toBe(t.updatedAt);
    expect(t.amountPaise).toBe(10000);
    expect(t.notes).toBe("team");
    expect(t.time).toBe("13:30");
    expect(t.categoryName).toBe("Food");
    expect(t.merchantName).toBeNull();
  });

  it("generates unique ids", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add((await repos.transactions.create(tx())).id);
    expect(ids.size).toBe(50);
  });

  it("updates fields and bumps updated_at, keeping created_at", async () => {
    const t = await repos.transactions.create(tx());
    await new Promise((r) => setTimeout(r, 5));
    const u = await repos.transactions.update(t.id, { amountPaise: 25050, status: "pending" });
    expect(u.amountPaise).toBe(25050);
    expect(u.status).toBe("pending");
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.updatedAt > t.updatedAt).toBe(true);
  });

  it("deletes", async () => {
    const t = await repos.transactions.create(tx());
    expect(await repos.transactions.delete(t.id)).toBe(true);
    expect(await repos.transactions.getById(t.id)).toBeNull();
    expect(await repos.transactions.delete(t.id)).toBe(false);
  });

  it("validates input with clear messages", async () => {
    await expect(repos.transactions.create(tx({ amountPaise: 0 }))).rejects.toMatchObject({ field: "amountPaise" });
    await expect(repos.transactions.create(tx({ amountPaise: 12.5 }))).rejects.toMatchObject({ field: "amountPaise" });
    await expect(repos.transactions.create(tx({ date: "2026-02-29" }))).rejects.toMatchObject({ field: "date" });
    await expect(repos.transactions.create(tx({ time: "25:00" }))).rejects.toMatchObject({ field: "time" });
    await expect(repos.transactions.create(tx({ categoryId: "nope" }))).rejects.toMatchObject({ field: "categoryId" });
    await expect(repos.transactions.create(tx({ merchantId: "nope" }))).rejects.toMatchObject({ field: "merchantId" });
    await expect(repos.transactions.create(tx({ paymentMethod: "cheque" as never }))).rejects.toMatchObject({ field: "paymentMethod" });
    await expect(repos.transactions.create(tx({ status: "lost" as never }))).rejects.toMatchObject({ field: "status" });
    await expect(repos.transactions.update("missing", {})).rejects.toMatchObject({ field: "id" });
  });

  it("stores Feb 29 in a leap year and dates exactly as given", async () => {
    const t = await repos.transactions.create(tx({ date: "2028-02-29" }));
    expect(t.date).toBe("2028-02-29");
  });
});

describe("status rules (paid + pending count, refunded never)", () => {
  beforeEach(async () => {
    await repos.transactions.create(tx({ amountPaise: 10000, status: "paid" }));
    await repos.transactions.create(tx({ amountPaise: 5050, status: "pending", categoryId: "cat_transport" }));
    await repos.transactions.create(tx({ amountPaise: 99999, status: "refunded" }));
  });

  it("summary and total", async () => {
    const s = await repos.transactions.summary({ range: OCT });
    expect(s.totalPaise).toBe(15050);
    expect(s.count).toBe(2);
    expect(s.paidPaise).toBe(10000);
    expect(s.pendingPaise).toBe(5050);
    expect(s.pendingCount).toBe(1);
    expect(s.refundedPaise).toBe(99999);
    expect(s.refundedCount).toBe(1);
    expect(await repos.transactions.totalSpending(OCT)).toBe(15050);
  });

  it("by category / month / day / payment method / budget all exclude refunded", async () => {
    const byCat = await repos.transactions.totalsByCategory(OCT);
    expect(byCat.map((c) => [c.name, c.totalPaise])).toEqual([["Food", 10000], ["Transport", 5050]]);
    const months = await repos.transactions.totalsByMonth({ year: 2026, month: 10 }, 3);
    expect(months).toEqual([
      { month: "2026-08", totalPaise: 0, count: 0 },
      { month: "2026-09", totalPaise: 0, count: 0 },
      { month: "2026-10", totalPaise: 15050, count: 2 },
    ]);
    expect(await repos.transactions.totalsByDay(OCT)).toEqual([{ date: "2026-10-05", totalPaise: 15050 }]);
    expect(await repos.transactions.totalsByPaymentMethod(OCT)).toEqual([{ paymentMethod: "upi", totalPaise: 15050, count: 2 }]);
    await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 20000 });
    const [p] = await repos.budgets.progress({ year: 2026, month: 10 });
    expect(p.spentPaise).toBe(15050);
    expect(p.remainingPaise).toBe(4950);
    expect(p.percentUsed).toBe(75);
    expect(p.overBudget).toBe(false);
  });

  it("refunded rows are still listed (visible) but not counted", async () => {
    expect(await repos.transactions.count({ range: OCT })).toBe(3);
    const refunded = await repos.transactions.list({ statuses: ["refunded"] });
    expect(refunded).toHaveLength(1);
  });

  it("changing paid -> refunded removes it from totals", async () => {
    const [paid] = await repos.transactions.list({ statuses: ["paid"] });
    await repos.transactions.update(paid.id, { status: "refunded" });
    expect(await repos.transactions.totalSpending(OCT)).toBe(5050);
  });
});

describe("month and year boundaries in aggregation", () => {
  it("Dec 31 and Jan 1 land in different months and years", async () => {
    await repos.transactions.create(tx({ date: "2026-12-31", amountPaise: 100 }));
    await repos.transactions.create(tx({ date: "2027-01-01", amountPaise: 200 }));
    expect(await repos.transactions.totalSpending(monthRange(2026, 12))).toBe(100);
    expect(await repos.transactions.totalSpending(monthRange(2027, 1))).toBe(200);
    const m = await repos.transactions.totalsByMonth({ year: 2027, month: 1 }, 2);
    expect(m.map((x) => [x.month, x.totalPaise])).toEqual([["2026-12", 100], ["2027-01", 200]]);
  });
  it("Feb 29 counts in February of a leap year", async () => {
    await repos.transactions.create(tx({ date: "2028-02-29", amountPaise: 300 }));
    await repos.transactions.create(tx({ date: "2028-03-01", amountPaise: 400 }));
    expect(await repos.transactions.totalSpending(monthRange(2028, 2))).toBe(300);
  });
  it("sums many small amounts exactly (no float drift)", async () => {
    for (let i = 0; i < 10; i++) await repos.transactions.create(tx({ amountPaise: 10 })); // 10 x Rs 0.10
    expect(await repos.transactions.totalSpending(OCT)).toBe(100); // exactly Rs 1.00
  });
});

describe("search and filter", () => {
  beforeEach(async () => {
    const swiggy = await repos.merchants.getOrCreate("Swiggy");
    const uber = await repos.merchants.getOrCreate("Uber");
    await repos.transactions.create(tx({ description: "Biryani", merchantId: swiggy.id, amountPaise: 45000, date: "2026-10-01" }));
    await repos.transactions.create(tx({ description: "Office ride", merchantId: uber.id, categoryId: "cat_transport", paymentMethod: "credit_card", amountPaise: 23000, date: "2026-10-10" }));
    await repos.transactions.create(tx({ description: "100% cotton shirt", categoryId: "cat_clothing", paymentMethod: "cash", amountPaise: 120000, date: "2026-09-20", notes: "gift for dad" }));
  });

  it("searches description, notes and merchant, case-insensitively", async () => {
    expect((await repos.transactions.list({ search: "biryani" })).map((t) => t.description)).toEqual(["Biryani"]);
    expect((await repos.transactions.list({ search: "UBER" })).map((t) => t.description)).toEqual(["Office ride"]);
    expect((await repos.transactions.list({ search: "dad" })).map((t) => t.description)).toEqual(["100% cotton shirt"]);
  });
  it("treats % and _ literally", async () => {
    expect(await repos.transactions.list({ search: "100%" })).toHaveLength(1);
    expect(await repos.transactions.list({ search: "%" })).toHaveLength(1);
    expect(await repos.transactions.list({ search: "_" })).toHaveLength(0);
  });
  it("filters by range, category, payment method, amount and sorts", async () => {
    expect(await repos.transactions.list({ range: OCT })).toHaveLength(2);
    expect(await repos.transactions.list({ categoryIds: ["cat_transport", "cat_clothing"] })).toHaveLength(2);
    expect(await repos.transactions.list({ paymentMethods: ["cash"] })).toHaveLength(1);
    expect(await repos.transactions.list({ minPaise: 23000, maxPaise: 45000 })).toHaveLength(2);
    expect((await repos.transactions.list({ sort: "amount_desc" })).map((t) => t.amountPaise)).toEqual([120000, 45000, 23000]);
    expect((await repos.transactions.list({ sort: "date_desc" })).map((t) => t.date)).toEqual(["2026-10-10", "2026-10-01", "2026-09-20"]);
    expect(await repos.transactions.list({ limit: 1, offset: 1, sort: "date_asc" })).toHaveLength(1);
    expect(await repos.transactions.count({ range: OCT, search: "ride" })).toBe(1);
    const top = await repos.transactions.totalsByMerchant(OCT);
    expect(top.map((m) => m.name)).toEqual(["Swiggy", "Uber"]);
  });
});

describe("categories: archiving and renaming never change history", () => {
  it("archived category keeps its transactions and totals", async () => {
    const t = await repos.transactions.create(tx({ categoryId: "cat_pets", amountPaise: 70350 }));
    await repos.categories.setArchived("cat_pets", true);

    expect((await repos.categories.list()).some((c) => c.id === "cat_pets")).toBe(false);
    expect((await repos.categories.list({ includeArchived: true })).some((c) => c.id === "cat_pets")).toBe(true);

    const after = await repos.transactions.getById(t.id);
    expect(after?.categoryId).toBe("cat_pets");
    expect(after?.amountPaise).toBe(70350);
    expect(after?.categoryArchived).toBe(true);
    expect(after?.updatedAt).toBe(t.updatedAt);
    const byCat = await repos.transactions.totalsByCategory(OCT);
    expect(byCat).toEqual([expect.objectContaining({ categoryId: "cat_pets", totalPaise: 70350, isArchived: true })]);
    expect(await repos.transactions.totalSpending(OCT)).toBe(70350);
  });

  it("new expenses cannot use an archived category, but existing ones can still be edited", async () => {
    const t = await repos.transactions.create(tx({ categoryId: "cat_pets" }));
    await repos.categories.setArchived("cat_pets", true);
    await expect(repos.transactions.create(tx({ categoryId: "cat_pets" }))).rejects.toMatchObject({ field: "categoryId" });
    await expect(repos.transactions.update(t.id, { amountPaise: 500 })).resolves.toMatchObject({ amountPaise: 500, categoryId: "cat_pets" });
    await repos.categories.setArchived("cat_pets", false);
    await expect(repos.transactions.create(tx({ categoryId: "cat_pets" }))).resolves.toBeTruthy();
  });

  it("rename keeps the same id; history follows the new name with identical amounts", async () => {
    const t = await repos.transactions.create(tx({ categoryId: "cat_food", amountPaise: 1234 }));
    await repos.categories.update("cat_food", { name: "Eating out" });
    const after = await repos.transactions.getById(t.id);
    expect(after?.categoryId).toBe("cat_food");
    expect(after?.categoryName).toBe("Eating out");
    expect(after?.amountPaise).toBe(1234);
    expect(await repos.transactions.totalSpending(OCT)).toBe(1234);
  });

  it("used categories cannot be deleted; unused custom ones can", async () => {
    await repos.transactions.create(tx({ categoryId: "cat_food" }));
    await expect(repos.categories.deleteIfUnused("cat_food")).rejects.toMatchObject({ field: "id" });
    const c = await repos.categories.create({ name: "Kitty", color: "#123456", icon: "paw-outline" });
    await repos.categories.deleteIfUnused(c.id);
    expect(await repos.categories.getById(c.id)).toBeNull();
  });

  it("validates names and colours, rejects duplicates", async () => {
    await expect(repos.categories.create({ name: "  ", color: "#123456", icon: "x" })).rejects.toMatchObject({ field: "name" });
    await expect(repos.categories.create({ name: "food", color: "#123456", icon: "x" })).rejects.toMatchObject({ field: "name" });
    await expect(repos.categories.create({ name: "New", color: "red", icon: "x" })).rejects.toMatchObject({ field: "color" });
    await expect(repos.categories.update("cat_food", { name: "Groceries" })).rejects.toMatchObject({ field: "name" });
  });
});

describe("merchants, budgets, settings", () => {
  it("getOrCreate is case-insensitive and trims", async () => {
    const a = await repos.merchants.getOrCreate("  Big   Bazaar ");
    const b = await repos.merchants.getOrCreate("big bazaar");
    expect(a.id).toBe(b.id);
    expect(a.name).toBe("Big Bazaar");
    expect((await repos.merchants.search("bi")).map((m) => m.name)).toEqual(["Big Bazaar"]);
    await expect(repos.merchants.getOrCreate(" ")).rejects.toMatchObject({ field: "merchant" });
  });

  it("budgets: one overall + one per category, upsert replaces, category budget counts only its category", async () => {
    await repos.transactions.create(tx({ categoryId: "cat_food", amountPaise: 30000 }));
    await repos.transactions.create(tx({ categoryId: "cat_food", amountPaise: 9999, status: "refunded" }));
    await repos.transactions.create(tx({ categoryId: "cat_travel", amountPaise: 50000 }));
    await repos.budgets.upsert({ scope: "category", categoryId: "cat_food", monthlyAmountPaise: 20000 });
    const again = await repos.budgets.upsert({ scope: "category", categoryId: "cat_food", monthlyAmountPaise: 25000 });
    expect(again.monthlyAmountPaise).toBe(25000);
    expect(await repos.budgets.list()).toHaveLength(1);
    const [p] = await repos.budgets.progress({ year: 2026, month: 10 });
    expect(p.spentPaise).toBe(30000);
    expect(p.overBudget).toBe(true);
    expect(p.percentUsed).toBe(120);
    await repos.budgets.upsert({ scope: "category", categoryId: "cat_food", monthlyAmountPaise: 25000, enabled: false });
    expect(await repos.budgets.progress({ year: 2026, month: 10 })).toHaveLength(0);
    await expect(repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 0 })).rejects.toMatchObject({ field: "monthlyAmountPaise" });
    await expect(repos.budgets.upsert({ scope: "category", monthlyAmountPaise: 100 })).rejects.toMatchObject({ field: "categoryId" });
  });

  it("settings have defaults, persist valid values and reject invalid ones", async () => {
    expect(await repos.settings.getAll()).toEqual({ theme: "system", week_start: "monday", date_format: "DD MMM YYYY" });
    await repos.settings.set("theme", "dark");
    await repos.settings.set("week_start", "sunday");
    expect(await repos.settings.getAll()).toMatchObject({ theme: "dark", week_start: "sunday" });
    await expect(repos.settings.set("theme", "neon" as never)).rejects.toMatchObject({ field: "theme" });
  });
});
