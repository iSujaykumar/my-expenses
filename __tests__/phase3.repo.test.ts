import { createRepositories, Repositories } from "../src/repo";
import { createMigratedDatabase } from "../test-utils/nodeDb";

let repos: Repositories;
beforeEach(async () => {
  repos = createRepositories((await createMigratedDatabase()).db);
});

const base = { amountPaise: 1000, description: "x", date: "2026-10-05", categoryId: "cat_food", paymentMethod: "upi" as const, status: "paid" as const };

it("restore puts back the exact deleted record (same id, created_at, updated_at, fields)", async () => {
  const m = await repos.merchants.getOrCreate("Swiggy");
  const created = await repos.transactions.create({ ...base, time: "09:30", merchantId: m.id, notes: "n", status: "pending" });
  const before = await repos.transactions.getById(created.id);
  await repos.transactions.delete(created.id);
  expect(await repos.transactions.getById(created.id)).toBeNull();
  const restored = await repos.transactions.restore(before!);
  expect(restored).toEqual(before);
  expect(await repos.transactions.totalSpending({ start: "2026-10-01", end: "2026-10-31" })).toBe(1000);
});

it("restore into an archived category still works (history is kept)", async () => {
  const t = await repos.transactions.create(base);
  await repos.transactions.delete(t.id);
  await repos.categories.setArchived("cat_food", true);
  await expect(repos.transactions.restore(t)).resolves.toMatchObject({ id: t.id, categoryArchived: true });
});

it("recent merchants are ordered by last use", async () => {
  const a = await repos.merchants.getOrCreate("Alpha");
  const b = await repos.merchants.getOrCreate("Beta");
  await repos.merchants.getOrCreate("Unused");
  await repos.transactions.create({ ...base, merchantId: a.id, date: "2026-10-01" });
  await repos.transactions.create({ ...base, merchantId: b.id, date: "2026-10-09" });
  expect((await repos.merchants.recent(3)).map((m) => m.name)).toEqual(["Beta", "Alpha", "Unused"]);
});

it("filters by several merchants at once", async () => {
  const a = await repos.merchants.getOrCreate("Alpha");
  const b = await repos.merchants.getOrCreate("Beta");
  const c = await repos.merchants.getOrCreate("Gamma");
  for (const m of [a, b, c]) await repos.transactions.create({ ...base, merchantId: m.id });
  await repos.transactions.create(base);
  expect(await repos.transactions.list({ merchantIds: [a.id, c.id] })).toHaveLength(2);
  expect((await repos.transactions.summary({ merchantIds: [a.id, c.id] })).totalPaise).toBe(2000);
});
