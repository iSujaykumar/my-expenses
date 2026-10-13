import { configureConnection, getSchemaVersion, initDatabase, migrate, MIGRATIONS } from "../src/db/migrations";
import { createRepositories } from "../src/repo";
import { occurrenceTransactionId } from "../src/repo/recurring";
import { monthlyDueDate, occurrencesBetween } from "../src/features/recurring/schedule";
import { resetAllData } from "../src/data/reset";
import { createMigratedDatabase, createNodeDatabase } from "../test-utils/nodeDb";

describe("schedule", () => {
  it("monthly on the 31st clamps to each month's last day, incl. leap Feb 29", () => {
    expect(occurrencesBetween({ frequency: "monthly", startDate: "2028-01-31", dayOfMonth: 31 }, "2028-01-01", "2028-05-31")).toEqual([
      "2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31",
    ]);
    expect(monthlyDueDate(2027, 2, 31)).toBe("2027-02-28");
    expect(monthlyDueDate(2027, 2, 29)).toBe("2027-02-28");
    expect(monthlyDueDate(2028, 2, 29)).toBe("2028-02-29");
    expect(monthlyDueDate(2028, 6, 15)).toBe("2028-06-15");
  });
  it("monthly never starts before the start date", () => {
    expect(occurrencesBetween({ frequency: "monthly", startDate: "2026-10-20", dayOfMonth: 5 }, "2026-10-01", "2026-12-31")).toEqual(["2026-11-05", "2026-12-05"]);
  });
  it("weekly repeats on the start weekday, across month and year ends", () => {
    expect(occurrencesBetween({ frequency: "weekly", startDate: "2026-12-17", dayOfMonth: null }, "2026-12-20", "2027-01-10")).toEqual(["2026-12-24", "2026-12-31", "2027-01-07"]);
    expect(occurrencesBetween({ frequency: "weekly", startDate: "2026-12-17", dayOfMonth: null }, "2026-01-01", "2026-12-17")).toEqual(["2026-12-17"]);
  });
});

describe("migration v1 → v2", () => {
  it("upgrades an existing v1 database without losing data", async () => {
    const { db } = createNodeDatabase();
    await configureConnection(db);
    await migrate(db, MIGRATIONS.slice(0, 1));
    expect(await getSchemaVersion(db)).toBe(1);
    const now = "2026-01-01T00:00:00.000Z";
    await db.run("INSERT INTO transactions (id, amount_paise, description, date, category_id, payment_method, status, created_at, updated_at) VALUES ('t1', 12345, 'Old', '2026-01-05', 'cat_food', 'upi', 'paid', ?, ?)", [now, now]);
    expect(await initDatabase(db)).toBe(2);
    const repos = createRepositories(db);
    expect((await repos.transactions.getById("t1"))?.amountPaise).toBe(12345);
    expect(await repos.recurring.list()).toEqual([]);
  });
});

describe("recurring templates", () => {
  const base = { description: "Rent", amountPaise: 1500000, categoryId: "cat_bills", paymentMethod: "bank_transfer" as const, frequency: "monthly" as const, startDate: "2026-09-30", dayOfMonth: 31 };

  it("create, edit, pause, delete", async () => {
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).recurring;
    const t = await r.create(base);
    expect(t.dayOfMonth).toBe(31);
    const u = await r.update(t.id, { ...base, amountPaise: 1600000 });
    expect(u.amountPaise).toBe(1600000);
    await r.setPaused(t.id, true);
    expect(await r.due("2026-10-31")).toEqual([]);
    await r.setPaused(t.id, false);
    expect((await r.due("2026-10-31")).map((d) => d.dueDate)).toEqual(["2026-09-30", "2026-10-31"]);
    expect(await r.delete(t.id)).toBe(true);
    expect(await r.list()).toEqual([]);
  });

  it("rejects invalid input", async () => {
    const { db } = await createMigratedDatabase();
    const r = createRepositories(db).recurring;
    await expect(r.create({ ...base, amountPaise: 0 })).rejects.toThrow(/above/);
    await expect(r.create({ ...base, description: " " })).rejects.toThrow(/name/);
    await expect(r.create({ ...base, dayOfMonth: 32 })).rejects.toThrow(/1 to 31/);
    await expect(r.create({ ...base, startDate: "2026-02-30" })).rejects.toThrow(/date/);
  });

  it("due soon shows next 7 days + missed ones; confirm records exactly one expense (idempotent, even when called twice at once)", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    const t = await repos.recurring.create({ ...base, startDate: "2026-10-31" });
    expect(await repos.recurring.due("2026-10-20")).toEqual([]); // 11 days away: not yet
    const due = await repos.recurring.due("2026-10-25");
    expect(due.map((d) => [d.dueDate, d.overdue])).toEqual([["2026-10-31", false]]);
    expect(await repos.recurring.confirm(t.id, "2026-10-31")).toBe("recorded");
    expect(await repos.recurring.confirm(t.id, "2026-10-31")).toBe("already");
    const settled = await Promise.allSettled([repos.recurring.confirm(t.id, "2026-10-31"), repos.recurring.confirm(t.id, "2026-10-31")]);
    expect(settled.every((s) => s.status === "rejected" || s.value === "already")).toBe(true);
    expect(await repos.transactions.count()).toBe(1);
    const tx = await repos.transactions.getById(occurrenceTransactionId(t.id, "2026-10-31"));
    expect(tx).toMatchObject({ amountPaise: 1500000, date: "2026-10-31", status: "paid", categoryId: "cat_bills" });
    expect(await repos.recurring.due("2026-10-31")).toEqual([]);
    // Next month (30 Nov) appears later; deleting the recorded expense does not bring the old one back.
    await repos.transactions.delete(tx!.id);
    expect((await repos.recurring.due("2026-11-25")).map((d) => d.dueDate)).toEqual(["2026-11-30"]);
  });

  it("skip hides an occurrence without recording; template delete keeps recorded expenses", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    const t = await repos.recurring.create({ ...base, frequency: "weekly", startDate: "2026-10-12", dayOfMonth: null });
    await repos.recurring.skip(t.id, "2026-10-12");
    await repos.recurring.confirm(t.id, "2026-10-19");
    expect((await repos.recurring.due("2026-10-19")).map((d) => d.dueDate)).toEqual(["2026-10-26"]);
    await repos.recurring.delete(t.id);
    expect(await repos.transactions.count()).toBe(1);
  });

  it("reset all data also removes templates", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    const t = await repos.recurring.create(base);
    await repos.recurring.confirm(t.id, "2026-09-30");
    await resetAllData(db);
    expect(await repos.recurring.list()).toEqual([]);
    expect(await repos.transactions.count()).toBe(0);
  });
});
