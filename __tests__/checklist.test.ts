/**
 * Phase 6 final checklist, as automated tests against real SQLite (better-sqlite3).
 * Each describe() maps to one checklist item in the README / final report.
 */
import fs from "fs";
import os from "os";
import path from "path";

import { buildBackup, parseAndValidateBackup } from "../src/data/backup";
import { parseCsv, transactionsToCsv } from "../src/data/csv";
import { applyImport, planImport } from "../src/data/importBackup";
import { initDatabase } from "../src/db/migrations";
import { createRepositories } from "../src/repo";
import { monthRange } from "../src/utils/date";
import { parseRupeesToPaise, MAX_AMOUNT_PAISE } from "../src/utils/money";
import { createMigratedDatabase, createNodeDatabase } from "../test-utils/nodeDb";

const oct = monthRange(2026, 10);
const tx = (o: Partial<Parameters<ReturnType<typeof createRepositories>["transactions"]["create"]>[0]> = {}) => ({
  amountPaise: 10000, date: "2026-10-05", categoryId: "cat_food", paymentMethod: "upi" as const, status: "paid" as const, ...o,
});

describe("CHECK 1: add/edit/delete updates totals", () => {
  it("totals follow every change", async () => {
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).transactions;
    const a = await r.create(tx({ amountPaise: 25050 }));
    expect(await r.totalSpending(oct)).toBe(25050);
    await r.update(a.id, { amountPaise: 30000 });
    expect(await r.totalSpending(oct)).toBe(30000);
    await r.update(a.id, { date: "2026-11-01" });
    expect(await r.totalSpending(oct)).toBe(0);
    await r.delete(a.id);
    expect(await r.totalSpending(monthRange(2026, 11))).toBe(0);
  });
});

describe("CHECK 2: zero / invalid / huge amounts", () => {
  it("parser and repository reject them", async () => {
    for (const bad of ["0", "0.00", "-5", "abc", "1.234", "", "1e5"]) expect(parseRupeesToPaise(bad).ok).toBe(false);
    expect(parseRupeesToPaise("99999999999").ok).toBe(false);
    expect(parseRupeesToPaise("1,00,000.50")).toEqual({ ok: true, paise: 10000050 });
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).transactions;
    await expect(r.create(tx({ amountPaise: 0 }))).rejects.toThrow();
    await expect(r.create(tx({ amountPaise: 1.5 }))).rejects.toThrow();
    await expect(r.create(tx({ amountPaise: MAX_AMOUNT_PAISE + 1 }))).rejects.toThrow();
    await r.create(tx({ amountPaise: MAX_AMOUNT_PAISE }));
    expect(await r.totalSpending(oct)).toBe(MAX_AMOUNT_PAISE);
  });
});

describe("CHECK 3: month and leap-day boundaries", () => {
  it("month edges and 29 Feb", async () => {
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).transactions;
    await r.create(tx({ date: "2028-02-29", amountPaise: 100 }));
    await r.create(tx({ date: "2028-03-01", amountPaise: 200 }));
    await r.create(tx({ date: "2028-01-31", amountPaise: 400 }));
    expect(monthRange(2028, 2)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthRange(2027, 2).end).toBe("2027-02-28");
    expect(await r.totalSpending(monthRange(2028, 2))).toBe(100);
    expect(await r.totalSpending(monthRange(2028, 3))).toBe(200);
    expect(await r.totalSpending(monthRange(2028, 1))).toBe(400);
    await expect(r.create(tx({ date: "2027-02-29" }))).rejects.toThrow();
  });
});

describe("CHECK 4: refund and pending rules", () => {
  it("paid + pending count, refunded never does", async () => {
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).transactions;
    await r.create(tx({ amountPaise: 1000, status: "paid" }));
    await r.create(tx({ amountPaise: 2000, status: "pending" }));
    await r.create(tx({ amountPaise: 4000, status: "refunded" }));
    const s = await r.summary({ range: oct });
    expect(s).toMatchObject({ totalPaise: 3000, pendingPaise: 2000, refundedPaise: 4000, count: 2 });
    expect(await r.totalSpending(oct)).toBe(3000);
  });
});

describe("CHECK 5: category archive", () => {
  it("archived categories hide from pickers but keep history and totals", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    await repos.transactions.create(tx({ categoryId: "cat_pets", amountPaise: 700 }));
    await repos.categories.setArchived("cat_pets", true);
    expect((await repos.categories.list()).some((c) => c.id === "cat_pets")).toBe(false);
    expect((await repos.categories.list({ includeArchived: true })).some((c) => c.id === "cat_pets")).toBe(true);
    expect(await repos.transactions.totalSpending(oct)).toBe(700);
    expect((await repos.transactions.list())[0].categoryArchived).toBe(true);
  });
});

describe("CHECK 6: search, filters, sorting", () => {
  it("works together", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    const m = await repos.merchants.getOrCreate("Big Bazaar");
    await repos.transactions.create(tx({ description: "Milk", amountPaise: 6000, date: "2026-10-03", categoryId: "cat_groceries", merchantId: m.id }));
    await repos.transactions.create(tx({ description: "Cab", amountPaise: 25000, date: "2026-10-04", categoryId: "cat_transport", paymentMethod: "cash" }));
    await repos.transactions.create(tx({ description: "Bread", amountPaise: 4000, date: "2026-10-06", categoryId: "cat_groceries", status: "pending", notes: "milk run" }));
    const r = repos.transactions;
    expect((await r.list({ search: "milk" })).map((t) => t.description).sort()).toEqual(["Bread", "Milk"]);
    expect((await r.list({ search: "bazaar" })).map((t) => t.description)).toEqual(["Milk"]);
    expect((await r.list({ categoryIds: ["cat_groceries"], statuses: ["pending"] })).map((t) => t.description)).toEqual(["Bread"]);
    expect((await r.list({ paymentMethods: ["cash"] })).map((t) => t.description)).toEqual(["Cab"]);
    expect((await r.list({ minPaise: 5000, maxPaise: 10000 })).map((t) => t.description)).toEqual(["Milk"]);
    expect((await r.list({ sort: "amount_desc" })).map((t) => t.amountPaise)).toEqual([25000, 6000, 4000]);
    expect((await r.list({ sort: "date_asc" })).map((t) => t.date)).toEqual(["2026-10-03", "2026-10-04", "2026-10-06"]);
    expect((await r.list({ sort: "date_desc" }))[0].date).toBe("2026-10-06");
  });
});

describe("CHECK 7: budgets below / near / over", () => {
  it("levels at 50%, 80%, 100%, 125%", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 10000 });
    const level = async () => (await repos.budgets.progress({ year: 2026, month: 10 }))[0];
    const t = await repos.transactions.create(tx({ amountPaise: 5000 }));
    expect((await level()).level).toBe("ok");
    await repos.transactions.update(t.id, { amountPaise: 8000 });
    expect((await level()).level).toBe("warning");
    await repos.transactions.update(t.id, { amountPaise: 10000 });
    expect((await level()).level).toBe("over");
    await repos.transactions.update(t.id, { amountPaise: 12500 });
    expect(await level()).toMatchObject({ level: "over", overBudget: true });
    await repos.transactions.create(tx({ amountPaise: 99999, status: "refunded" }));
    expect((await level()).spentPaise).toBe(12500);
  });
});

describe("CHECK 8: CSV and JSON export and import", () => {
  it("CSV round trip keeps every value; JSON backup restores into a fresh database", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    await repos.transactions.create(tx({ description: 'Tea, "special"\nline 2', amountPaise: 12345, notes: "=SUM(A1)" }));
    const list = await repos.transactions.list();
    const rows = parseCsv(transactionsToCsv(list));
    expect(rows[1][rows[0].indexOf("amount_rupees")]).toBe("123.45");
    expect(rows[1][rows[0].indexOf("amount_paise")]).toBe("12345");
    expect(rows[1][rows[0].indexOf("description")]).toBe('Tea, "special"\nline 2');
    expect(rows[1][rows[0].indexOf("notes")]).toBe("'=SUM(A1)");

    const json = JSON.stringify(await buildBackup(db, "1.1.0", new Date("2026-10-13T00:00:00Z")));
    const v = parseAndValidateBackup(json);
    if (!v.ok) throw new Error(v.fileError);
    const fresh = await createMigratedDatabase();
    await applyImport(fresh.db, await planImport(fresh.db, v.valid, v.invalid, "replace"));
    expect(await createRepositories(fresh.db).transactions.list()).toEqual(list.map((t) => expect.objectContaining({ id: t.id, amountPaise: t.amountPaise, description: t.description })));
    const again = await planImport(fresh.db, v.valid, v.invalid, "merge");
    expect(again.counts.transactions).toEqual({ new: 0, duplicate: 1, invalid: 0 });
  });
});

describe("CHECK 9: data persists after restart", () => {
  it("file-backed database keeps data after close and reopen", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meow-"));
    const file = path.join(dir, "meow.db");
    try {
      const first = createNodeDatabase(file);
      await initDatabase(first.db);
      const repos = createRepositories(first.db);
      await repos.transactions.create(tx({ amountPaise: 4242, description: "Persist me" }));
      await repos.settings.set("theme", "dark");
      const t = await repos.recurring.create({ description: "Gym", amountPaise: 99900, categoryId: "cat_health", paymentMethod: "upi", frequency: "monthly", startDate: "2026-10-01" });
      first.raw.close();

      const second = createNodeDatabase(file);
      expect(await initDatabase(second.db)).toBe(2);
      const r2 = createRepositories(second.db);
      expect((await r2.transactions.list()).map((x) => [x.description, x.amountPaise])).toEqual([["Persist me", 4242]]);
      expect((await r2.settings.getAll()).theme).toBe("dark");
      expect((await r2.recurring.getById(t.id))?.description).toBe("Gym");
      second.raw.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
