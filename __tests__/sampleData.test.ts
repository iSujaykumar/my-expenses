import { loadSampleData, removeSampleData, SAMPLE_ITEMS, SAMPLE_ID_PREFIX, sampleCount, sampleTotalPaise } from "../src/data/sampleData";
import { createRepositories } from "../src/repo";
import { createMigratedDatabase } from "../test-utils/nodeDb";

/** The user's list, verbatim. Expected count/total are computed from THIS text, independently of the app's list. */
const USER_LIST =
  '8-in-1 hub 703; Laptop cover + keyboard cover 274; AirTag 283; Gloves 329; Grocery 321; Tissue 196 and 99; Black jacket 263; Masala dabba 129; Sipper 99; Screen guard 260; Gym bag 197; Luffy sticker 117; Blue jacket + green kurta 768; Knee caps 199; Gym underwear 546; Comfort 247; Amazon Now: 153, 207, 503, 659, 674, 2223, 408, 364; Blue jeans 443; Cat shoes 289; Cat bed 404; Charger 649; Shoes for grandfather 1024; Bra 221 and 1243; Laptop sleeve 1001; Screen cleaning + stand 1525; Bed cover 741; Broadband 470; Airtel recharge 548 (the extra "8788" in my note is unclear - do not guess its meaning, flag it); Flipkart 2200.';

function amountsFromUserList(text: string): number[] {
  const out: number[] = [];
  for (const raw of text.replace(/\(.*?\)/g, "").replace(/\.$/, "").split(";")) {
    const entry = raw.replace(/^\s*8-in-1/, "");
    const tail = entry.includes(":") ? entry.split(":")[1] : entry.match(/(\d+(?:\s*(?:,|and)\s*\d+)*)\s*$/)![1];
    out.push(...tail.split(/,|and/).map((s) => Number(s.trim())));
  }
  return out;
}

const dates = (d = "2026-10-01") => Object.fromEntries(SAMPLE_ITEMS.map((i) => [i.key, d]));

describe("sample data", () => {
  it("count and total match the user's list (computed, not hard-coded)", () => {
    const expected = amountsFromUserList(USER_LIST);
    expect(sampleCount()).toBe(expected.length);
    expect(sampleTotalPaise()).toBe(expected.reduce((s, n) => s + n, 0) * 100);
    expect(SAMPLE_ITEMS.map((i) => i.rupees).sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
  });
  it("splits two-amount entries and Amazon Now into separate entries, and flags uncertain ones", () => {
    expect(SAMPLE_ITEMS.filter((i) => i.description === "Tissue").map((i) => i.rupees)).toEqual([196, 99]);
    expect(SAMPLE_ITEMS.filter((i) => i.description === "Bra").map((i) => i.rupees)).toEqual([221, 1243]);
    expect(SAMPLE_ITEMS.filter((i) => i.merchant === "Amazon Now")).toHaveLength(8);
    for (const d of ["Airtel recharge", "Comfort", "Flipkart order", "Amazon Now order"]) expect(SAMPLE_ITEMS.find((i) => i.description === d)?.flag).toBeTruthy();
    expect(SAMPLE_ITEMS.find((i) => i.description === "Airtel recharge")!.flag).toMatch(/8788/);
    expect(SAMPLE_ITEMS.find((i) => i.description === "Airtel recharge")!.rupees).toBe(548);
  });
  it("loads with chosen dates, twice adds nothing, and removal deletes exactly the samples", async () => {
    const { db } = await createMigratedDatabase();
    const repos = createRepositories(db);
    const mine = await repos.transactions.create({ amountPaise: 5000, date: "2026-10-02", categoryId: "cat_food", paymentMethod: "cash", status: "paid", description: "My lunch" });
    const d = dates();
    d["05"] = "2026-09-15"; // individually edited date
    expect(await loadSampleData(db, d)).toEqual({ inserted: sampleCount(), skipped: 0 });
    expect(await loadSampleData(db, d)).toEqual({ inserted: 0, skipped: sampleCount() });
    const all = await repos.transactions.list({ limit: 1000 });
    expect(all).toHaveLength(sampleCount() + 1);
    const sampleTotal = all.filter((t) => t.id.startsWith(SAMPLE_ID_PREFIX)).reduce((s, t) => s + t.amountPaise, 0);
    expect(sampleTotal).toBe(sampleTotalPaise());
    expect(all.find((t) => t.id === `${SAMPLE_ID_PREFIX}05`)?.date).toBe("2026-09-15");
    expect(all.find((t) => t.description === "Airtel recharge")?.notes).toMatch(/8788/);
    expect(await removeSampleData(db)).toBe(sampleCount());
    const left = await repos.transactions.list();
    expect(left.map((t) => t.id)).toEqual([mine.id]);
    expect((await repos.merchants.list()).length).toBe(0);
  });
  it("rejects a missing date and inserts nothing", async () => {
    const { db } = await createMigratedDatabase();
    const d = dates();
    delete d["10"];
    await expect(loadSampleData(db, d)).rejects.toThrow(/date/);
    expect(await createRepositories(db).transactions.count()).toBe(0);
  });
});
