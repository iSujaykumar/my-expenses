import { activeFilterCount, DEFAULT_FILTERS, hasAnyFilter, resolveDateRange, toggleValue, toTransactionFilter } from "../src/features/history/filters";
import { dayLabel, groupByDate, headerIndices, ungrouped } from "../src/features/history/grouping";

const t = (id: string, date: string, amountPaise: number, status: "paid" | "pending" | "refunded" = "paid") => ({ id, date, amountPaise, status });

describe("groupByDate", () => {
  it("creates one header per day with day totals that exclude refunded", () => {
    const items = groupByDate(
      [t("a", "2026-10-13", 100), t("b", "2026-10-13", 50, "pending"), t("c", "2026-10-13", 999, "refunded"), t("d", "2026-10-12", 7)],
      "2026-10-13",
    );
    expect(items.map((i) => i.type)).toEqual(["header", "row", "row", "row", "header", "row"]);
    const [h1, , , , h2] = items;
    expect(h1).toMatchObject({ label: "Today", dayTotalPaise: 150, count: 3 });
    expect(h2).toMatchObject({ label: "Yesterday", dayTotalPaise: 7, count: 1 });
    expect(headerIndices(items)).toEqual([0, 4]);
  });
  it("labels other days with the date, across year boundaries", () => {
    expect(dayLabel("2026-12-31", "2027-01-01")).toBe("Yesterday");
    expect(dayLabel("2026-12-30", "2027-01-01")).toBe("30 Dec 2026");
  });
  it("empty in, empty out; ungrouped has no headers", () => {
    expect(groupByDate([], "2026-10-13")).toEqual([]);
    expect(ungrouped([t("a", "2026-10-13", 1)]).map((i) => i.type)).toEqual(["row"]);
  });
});

describe("filters", () => {
  const today = "2026-01-15";
  it("resolves date presets, including across the year boundary", () => {
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "all" }, today)).toBeUndefined();
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "this_month" }, today)).toEqual({ start: "2026-01-01", end: "2026-01-31" });
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "last_month" }, today)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "last_3_months" }, today)).toEqual({ start: "2025-11-01", end: "2026-01-31" });
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "this_year" }, today)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(resolveDateRange({ ...DEFAULT_FILTERS, datePreset: "custom", customRange: { start: "2026-01-02", end: "2026-01-03" } }, today)).toEqual({ start: "2026-01-02", end: "2026-01-03" });
  });
  it("builds a repository query and counts active filters", () => {
    const f = { ...DEFAULT_FILTERS, search: "  swiggy ", categoryIds: ["cat_food"], statuses: ["pending" as const], sort: "amount_desc" as const };
    expect(toTransactionFilter(f, today)).toEqual({
      search: "swiggy", range: undefined, categoryIds: ["cat_food"], merchantIds: undefined, paymentMethods: undefined, statuses: ["pending"], sort: "amount_desc",
    });
    expect(activeFilterCount(f)).toBe(2);
    expect(hasAnyFilter(DEFAULT_FILTERS)).toBe(false);
    expect(hasAnyFilter({ ...DEFAULT_FILTERS, sort: "date_asc" })).toBe(true);
    expect(hasAnyFilter({ ...DEFAULT_FILTERS, search: "x" })).toBe(true);
  });
  it("toggles values", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });
});
