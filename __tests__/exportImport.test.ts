import { buildBackup, parseAndValidateBackup, readAllData, validateBackup } from "../src/data/backup";
import { CSV_COLUMNS, escapeCsvCell, parseCsv, transactionsToCsv } from "../src/data/csv";
import { applyImport, planImport } from "../src/data/importBackup";
import { resetAllData } from "../src/data/reset";
import { SqlDatabase } from "../src/db/types";
import { createRepositories, Repositories } from "../src/repo";
import { createMigratedDatabase } from "../test-utils/nodeDb";

async function seeded(): Promise<{ db: SqlDatabase; repos: Repositories }> {
  const { db } = await createMigratedDatabase();
  const repos = createRepositories(db);
  const m = await repos.merchants.getOrCreate("Café \"Blue\", Ltd");
  const kitty = await repos.categories.create({ name: "Kitty", color: "#123456", icon: "paw-outline" });
  await repos.transactions.create({ amountPaise: 70350, description: 'Lunch, "team"\nsecond line', date: "2026-10-05", time: "13:30", categoryId: "cat_food", merchantId: m.id, paymentMethod: "upi", status: "paid", notes: "=SUM(A1)" });
  await repos.transactions.create({ amountPaise: 1, description: " spaced ", date: "2028-02-29", categoryId: kitty.id, paymentMethod: "cash", status: "refunded" });
  await repos.transactions.create({ amountPaise: 1245678999, description: "₹ unicode ✓", date: "2026-12-31", categoryId: "cat_travel", paymentMethod: "credit_card", status: "pending" });
  await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: 5000000 });
  await repos.budgets.upsert({ scope: "category", categoryId: kitty.id, monthlyAmountPaise: 100000, enabled: false });
  await repos.categories.setArchived("cat_pets", true);
  await repos.settings.set("theme", "dark");
  await repos.settings.set("week_start", "sunday");
  return { db, repos };
}

describe("CSV export", () => {
  it("escapes commas, quotes, newlines, edge spaces and formula starts", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("x\ny")).toBe('"x\ny"');
    expect(escapeCsvCell(" pad ")).toBe('" pad "');
    expect(escapeCsvCell("=1+1", true)).toBe("'=1+1");
    expect(escapeCsvCell("-5", true)).toBe("'-5");
    expect(escapeCsvCell("-5", false)).toBe("-5");
  });

  it("round-trips: every row parses back to the same values", async () => {
    const { repos } = await seeded();
    const rows = await repos.transactions.list({ sort: "date_asc" });
    const csv = transactionsToCsv(rows);
    const parsed = parseCsv(csv);
    expect(parsed[0]).toEqual([...CSV_COLUMNS]);
    expect(parsed).toHaveLength(rows.length + 1);
    const byId = new Map(parsed.slice(1).map((r) => [r[0], Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, r[i]]))]));
    for (const t of rows) {
      const r = byId.get(t.id)!;
      expect(r.date).toBe(t.date);
      expect(r.time).toBe(t.time ?? "");
      expect(Number(r.amount_paise)).toBe(t.amountPaise);
      expect(r.amount_rupees).toMatch(/^\d+\.\d{2}$/);
      expect(Math.round(Number(r.amount_rupees) * 100)).toBe(t.amountPaise);
      expect(r.description.replace(/^'/, "")).toBe(t.description);
      expect(r.category).toBe(t.categoryName);
      expect(r.merchant).toBe(t.merchantName ?? "");
      expect(r.status).toBe(t.status);
      expect(r.counts_as_spending).toBe(t.status === "refunded" ? "no" : "yes");
      expect(r.notes.replace(/^'/, "")).toBe(t.notes);
    }
    expect(byId.get(rows.find((t) => t.amountPaise === 1245678999)!.id)!.amount_rupees).toBe("12456789.99");
    expect(byId.get(rows.find((t) => t.amountPaise === 1)!.id)!.amount_rupees).toBe("0.01");
  });

  it("empty export is just the header", () => {
    expect(transactionsToCsv([])).toBe(`${CSV_COLUMNS.join(",")}\r\n`);
  });
});

describe("JSON backup round trip", () => {
  it("export -> validate -> replace into a fresh database gives identical data", async () => {
    const { db } = await seeded();
    const backup = await buildBackup(db, "1.0.3", new Date("2026-10-13T10:00:00Z"));
    expect(backup).toMatchObject({ format: "meow-backup", format_version: 1, app_version: "1.0.3", schema_version: 1, exported_at: "2026-10-13T10:00:00.000Z" });
    const text = JSON.stringify(backup);

    const v = parseAndValidateBackup(text);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.invalid).toEqual([]);

    const { db: fresh } = await createMigratedDatabase();
    const plan = await planImport(fresh, v.valid, v.invalid, "replace");
    expect(plan.blockedReason).toBeNull();
    await applyImport(fresh, plan);
    expect(await readAllData(fresh)).toEqual(await readAllData(db));
  });

  it("merge into an empty-ish database adds everything new and links by name", async () => {
    const { db } = await seeded();
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup(db, "1.0.3"))));
    if (!v.ok) throw new Error("invalid");
    const { db: fresh } = await createMigratedDatabase();
    const plan = await planImport(fresh, v.valid, v.invalid, "merge");
    expect(plan.counts.transactions).toEqual({ new: 3, duplicate: 0, invalid: 0 });
    expect(plan.counts.categories).toEqual({ new: 1, duplicate: 14, invalid: 0 }); // starter ones already exist
    await applyImport(fresh, plan);
    const repos = createRepositories(fresh);
    expect((await repos.transactions.summary({})).totalPaise).toBe(70350 + 1245678999);
    expect((await repos.settings.getAll()).theme).toBe("system"); // merge keeps phone settings
  });

  it("importing the same backup twice changes nothing the second time (duplicates by ID)", async () => {
    const { db } = await seeded();
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup(db, "1.0.3"))));
    if (!v.ok) throw new Error("invalid");
    const before = await readAllData(db);
    const plan = await planImport(db, v.valid, v.invalid, "merge");
    expect(plan.counts.transactions).toEqual({ new: 0, duplicate: 3, invalid: 0 });
    expect(plan.counts.merchants).toEqual({ new: 0, duplicate: 1, invalid: 0 });
    expect(plan.counts.budgets).toEqual({ new: 0, duplicate: 2, invalid: 0 });
    await applyImport(db, plan);
    expect(await readAllData(db)).toEqual(before);
  });

  it("merchants and categories with a different ID but the same name are linked, not duplicated", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    await repos.merchants.getOrCreate("Swiggy");
    const ts = "2026-10-01T00:00:00.000Z";
    const file = {
      format: "meow-backup", format_version: 1, app_version: "x", schema_version: 1, exported_at: ts,
      data: {
        categories: [{ id: "other_food", name: "FOOD", color: "#000000", icon: "x", is_archived: 0, sort_order: 0, created_at: ts, updated_at: ts }],
        merchants: [{ id: "other_swiggy", name: "swiggy", created_at: ts, updated_at: ts }],
        transactions: [{ id: "t1", amount_paise: 500, description: "", date: "2026-10-01", time: null, category_id: "other_food", merchant_id: "other_swiggy", payment_method: "upi", status: "paid", notes: "", created_at: ts, updated_at: ts }],
        budgets: [], settings: [],
      },
    };
    const v = validateBackup(file);
    if (!v.ok) throw new Error(v.fileError);
    await applyImport(db, await planImport(db, v.valid, v.invalid, "merge"));
    const t = await repos.transactions.getById("t1");
    expect(t?.categoryId).toBe("cat_food");
    expect(t?.merchantName).toBe("Swiggy");
    expect(await repos.merchants.list()).toHaveLength(1);
  });
});

describe("validation failures (nothing written)", () => {
  const ts = "2026-10-01T00:00:00.000Z";
  const good = () => ({
    format: "meow-backup", format_version: 1, app_version: "1", schema_version: 1, exported_at: ts,
    data: {
      categories: [{ id: "c1", name: "A", color: "#000000", icon: "x", is_archived: 0, sort_order: 0, created_at: ts, updated_at: ts }],
      merchants: [] as unknown[],
      transactions: [{ id: "t1", amount_paise: 100, description: "", date: "2026-10-01", time: null, category_id: "c1", merchant_id: null, payment_method: "upi", status: "paid", notes: "", created_at: ts, updated_at: ts }] as Record<string, unknown>[],
      budgets: [] as unknown[],
      settings: [{ key: "theme", value: "dark", created_at: ts, updated_at: ts }] as Record<string, unknown>[],
    },
  });

  it("rejects non-JSON, wrong format, newer or missing format_version, missing lists", () => {
    expect(parseAndValidateBackup("not json")).toEqual({ ok: false, fileError: "This file is not valid JSON." });
    expect(validateBackup([])).toMatchObject({ ok: false });
    expect(validateBackup({ ...good(), format: "other" })).toMatchObject({ ok: false, fileError: "This file is not a Meow backup." });
    expect(validateBackup({ ...good(), format_version: 2 })).toMatchObject({ ok: false, fileError: expect.stringMatching(/newer version/) });
    expect(validateBackup({ ...good(), format_version: "1" })).toMatchObject({ ok: false });
    expect(validateBackup({ ...good(), exported_at: "yesterday" })).toMatchObject({ ok: false });
    const f = good() as unknown as { data: Record<string, unknown> };
    delete f.data.budgets;
    expect(validateBackup(f)).toMatchObject({ ok: false, fileError: 'The backup is missing the "budgets" list.' });
  });

  it.each([
    ["float paise", { amount_paise: 10.5 }, /whole number/],
    ["zero paise", { amount_paise: 0 }, /whole number/],
    ["string paise", { amount_paise: "100" }, /whole number/],
    ["bad date", { date: "2026-02-30" }, /date/],
    ["bad time", { time: "25:00" }, /time/],
    ["unknown status", { status: "lost" }, /status/],
    ["unknown method", { payment_method: "cheque" }, /payment_method/],
    ["missing category", { category_id: "nope" }, /category_id/],
    ["missing merchant", { merchant_id: "nope" }, /merchant_id/],
    ["bad timestamp", { created_at: "x" }, /created_at/],
    ["missing id", { id: "" }, /id/],
  ])("marks a transaction invalid: %s", (_name, patch, reason) => {
    const f = good();
    f.data.transactions[0] = { ...f.data.transactions[0], ...patch };
    const v = validateBackup(f);
    if (!v.ok) throw new Error("file rejected");
    expect(v.valid.transactions).toHaveLength(0);
    expect(v.invalid).toEqual([expect.objectContaining({ table: "transactions", reason: expect.stringMatching(reason) })]);
  });

  it("catches duplicate IDs, cascades invalid categories, bad settings and budgets", () => {
    const f = good();
    f.data.transactions.push({ ...f.data.transactions[0] });
    f.data.categories[0] = { ...f.data.categories[0], color: "red" };
    f.data.settings[0] = { ...f.data.settings[0], value: "neon" };
    f.data.budgets.push({ id: "b1", scope: "overall", category_id: "c1", monthly_amount_paise: 100, enabled: 1, created_at: ts, updated_at: ts });
    const v = validateBackup(f);
    if (!v.ok) throw new Error("file rejected");
    const reasons = v.invalid.map((i) => `${i.table}:${i.reason}`);
    expect(reasons).toEqual(expect.arrayContaining([
      "categories:invalid color",
      "transactions:category_id does not match a valid category in the file",
      "transactions:duplicate id in the file",
      "budgets:overall budget must not have a category_id",
      "settings:invalid value",
    ]));
  });

  it("replace is blocked when anything is invalid, and the database is untouched", async () => {
    const { db } = await seeded();
    const before = await readAllData(db);
    const f = good();
    f.data.transactions[0].amount_paise = -1;
    const v = validateBackup(f);
    if (!v.ok) throw new Error("file rejected");
    const plan = await planImport(db, v.valid, v.invalid, "replace");
    expect(plan.blockedReason).toMatch(/Replace is disabled/);
    await expect(applyImport(db, plan)).rejects.toThrow();
    expect(await readAllData(db)).toEqual(before);
  });
});

describe("atomicity", () => {
  it("a replace that fails half-way rolls back completely", async () => {
    const { db } = await seeded();
    const before = await readAllData(db);
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup(db, "1"))));
    if (!v.ok) throw new Error("invalid");
    const plan = await planImport(db, v.valid, v.invalid, "replace");
    // Sabotage the last insert (bypassing validation) so the DB rejects it after earlier writes succeeded.
    plan.toInsert.budgets = [...plan.toInsert.budgets, { ...plan.toInsert.budgets[0], id: "dup-overall-budget" }];
    await expect(applyImport(db, plan)).rejects.toBeTruthy();
    expect(await readAllData(db)).toEqual(before);
  });

  it("reset all data removes everything and restores starter categories + defaults", async () => {
    const { db } = await seeded();
    await resetAllData(db);
    const d = await readAllData(db);
    expect(d.transactions).toEqual([]);
    expect(d.merchants).toEqual([]);
    expect(d.budgets).toEqual([]);
    expect(d.categories).toHaveLength(14);
    expect(d.settings.map((s) => [s.key, s.value])).toEqual([["date_format", "DD MMM YYYY"], ["theme", "system"], ["week_start", "monday"]]);
  });
});
