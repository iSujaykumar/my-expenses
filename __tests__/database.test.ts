import { STARTER_CATEGORIES } from "../src/constants/categories";
import { getSchemaVersion, initDatabase, LATEST_VERSION, migrate, Migration } from "../src/db/migrations";
import { DatabaseError } from "../src/db/types";
import { createMigratedDatabase, createNodeDatabase } from "../test-utils/nodeDb";

describe("migrations", () => {
  it("creates the schema, sets user_version and seeds starter categories + settings (no transactions)", async () => {
    const { db } = await createMigratedDatabase();
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(["budgets", "categories", "merchants", "recurring_occurrences", "recurring_templates", "settings", "transactions"]);
    const cats = await db.all<{ name: string }>("SELECT name FROM categories ORDER BY sort_order");
    expect(cats.map((c) => c.name)).toEqual(STARTER_CATEGORIES.map((c) => c.name));
    expect(cats).toHaveLength(14);
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM transactions"))?.n).toBe(0);
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM settings"))?.n).toBe(3);
  });

  it("is idempotent: running again changes nothing", async () => {
    const { db } = await createMigratedDatabase();
    await initDatabase(db);
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM categories"))?.n).toBe(14);
  });

  it("applies only newer migrations and rolls back a failing one", async () => {
    const { db } = createNodeDatabase();
    const migrations: Migration[] = [
      { version: 1, description: "a", up: async (d) => d.exec("CREATE TABLE a (x INTEGER)") },
      { version: 2, description: "b", up: async (d) => { await d.exec("CREATE TABLE b (x INTEGER)"); await d.exec("THIS IS NOT SQL"); } },
    ];
    await expect(migrate(db, migrations)).rejects.toMatchObject({ code: "MIGRATION_FAILED" });
    expect(await getSchemaVersion(db)).toBe(1);
    expect(await db.first("SELECT name FROM sqlite_master WHERE name = 'b'")).toBeNull();
    // fix migration 2 and retry: only v2 runs
    migrations[1] = { version: 2, description: "b", up: async (d) => d.exec("CREATE TABLE b (x INTEGER)") };
    expect(await migrate(db, migrations)).toBe(2);
  });

  it("refuses a database newer than the app", async () => {
    const { db } = createNodeDatabase();
    await db.exec("PRAGMA user_version = 99");
    await expect(initDatabase(db)).rejects.toBeInstanceOf(DatabaseError);
    await expect(initDatabase(db)).rejects.toMatchObject({ code: "DB_TOO_NEW" });
  });

  it("enforces integer positive paise, date format, enums and foreign keys at the SQL level", async () => {
    const { db } = await createMigratedDatabase();
    const insert = (amount: unknown, date = "2026-10-13", status = "paid", category = "cat_food") =>
      db.run(
        `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, '', ?, NULL, ?, NULL, 'cash', ?, '', 'x', 'x')`,
        [`t${Math.random()}`, amount as number, date, category, status],
      );
    // better-sqlite3 errors come from another JS realm, so match on the message.
    const sqlError = { message: expect.stringMatching(/constraint failed/) };
    await expect(insert(100)).resolves.toBeTruthy();
    await expect(insert(10.5)).rejects.toMatchObject(sqlError);
    await expect(insert(0)).rejects.toMatchObject(sqlError);
    await expect(insert(-5)).rejects.toMatchObject(sqlError);
    await expect(insert(100, "13/10/2026")).rejects.toMatchObject(sqlError);
    await expect(insert(100, "2026-10-13", "lost")).rejects.toMatchObject(sqlError);
    await expect(insert(100, "2026-10-13", "paid", "cat_missing")).rejects.toMatchObject(sqlError);
  });
});
