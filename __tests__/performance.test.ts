/**
 * Performance check with generated data in a throw-away in-memory database
 * (never the user's database). Measures History's query + grouping work.
 */
import { STARTER_CATEGORIES } from "../src/constants/categories";
import { DEFAULT_FILTERS, toTransactionFilter } from "../src/features/history/filters";
import { groupByDate } from "../src/features/history/grouping";
import { createRepositories } from "../src/repo";
import { MAX_LIST_LIMIT } from "../src/repo/transactions";
import { addDays } from "../src/utils/date";
import { createMigratedDatabase } from "../test-utils/nodeDb";

const ROWS = 6000;

it(`loads, filters, totals and groups ${ROWS} expenses quickly`, async () => {
  const { db, raw } = await createMigratedDatabase();
  const repos = createRepositories(db);
  const statuses = ["paid", "paid", "paid", "pending", "refunded"];
  const methods = ["cash", "upi", "debit_card", "credit_card", "bank_transfer", "other"];
  const insert = raw.prepare(
    `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, '', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  let expectedTotal = 0;
  raw.transaction(() => {
    for (let i = 0; i < ROWS; i++) {
      const amount = 100 + ((i * 7919) % 500000);
      const status = statuses[i % statuses.length];
      if (status !== "refunded") expectedTotal += amount;
      insert.run(`gen_${i}`, amount, `Generated ${i}`, addDays("2026-10-13", -(i % 730)), STARTER_CATEGORIES[i % 14].id, methods[i % 6], status);
    }
  })();

  const t0 = performance.now();
  const query = toTransactionFilter(DEFAULT_FILTERS, "2026-10-13");
  const rows = await repos.transactions.list({ ...query, limit: MAX_LIST_LIMIT });
  const summary = await repos.transactions.summary(query);
  const t1 = performance.now();
  const items = groupByDate(rows, "2026-10-13");
  const t2 = performance.now();
  const searched = await repos.transactions.list({ search: "Generated 59", limit: MAX_LIST_LIMIT });
  const filtered = await repos.transactions.summary({ statuses: ["pending"], categoryIds: ["cat_food", "cat_travel"] });
  const t3 = performance.now();

  expect(rows).toHaveLength(ROWS);
  expect(summary.totalPaise).toBe(expectedTotal);
  expect(items.filter((i) => i.type === "header")).toHaveLength(730);
  expect(items.filter((i) => i.type === "header").reduce((s, h) => s + (h.type === "header" ? h.dayTotalPaise : 0), 0)).toBe(expectedTotal);
  expect(searched.length).toBeGreaterThan(0);
  expect(filtered.count).toBeGreaterThanOrEqual(0);

  // Generous limits so slow CI machines pass; typical numbers are far lower.
  expect(t1 - t0).toBeLessThan(2000);
  expect(t2 - t1).toBeLessThan(500);
  expect(t3 - t2).toBeLessThan(1000);
  process.stdout.write(
    `\n[perf] ${ROWS} rows: list+summary ${(t1 - t0).toFixed(1)} ms, grouping ${(t2 - t1).toFixed(1)} ms, search+filtered summary ${(t3 - t2).toFixed(1)} ms\n`,
  );
});
