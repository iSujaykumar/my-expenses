import { emptyFormValues, formValuesFromTransaction, isFormDirty, validateExpenseForm } from "../src/features/expenses/form";

const base = { ...emptyFormValues("2026-10-13"), amount: "703.50", categoryId: "cat_food" };

describe("validateExpenseForm", () => {
  it("returns a clean expense in integer paise", () => {
    const r = validateExpenseForm({ ...base, description: "  Lunch ", merchantName: "  Big   Bazaar ", time: "13:05", notes: " x " });
    expect(r).toEqual({
      ok: true,
      value: {
        amountPaise: 70350, description: "Lunch", date: "2026-10-13", time: "13:05", categoryId: "cat_food",
        merchantName: "Big Bazaar", paymentMethod: "upi", status: "paid", notes: "x",
      },
    });
  });
  it("reports every problem at once with readable messages", () => {
    const r = validateExpenseForm({ ...emptyFormValues("2026-02-29"), time: "25:00" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.amount).toBe("Enter an amount.");
    expect(r.errors.date).toBe("Pick a valid date.");
    expect(r.errors.time).toMatch(/HH:MM/);
    expect(r.errors.categoryId).toBe("Pick a category.");
  });
  it("rejects zero, negative and 3-decimal amounts", () => {
    for (const amount of ["0", "-1", "1.234", "abc"]) {
      const r = validateExpenseForm({ ...base, amount });
      expect(r.ok).toBe(false);
    }
  });
  it("time is optional and stored as null when empty", () => {
    const r = validateExpenseForm({ ...base, time: "  " });
    expect(r.ok && r.value.time).toBeNull();
  });
  it("limits long text", () => {
    const r = validateExpenseForm({ ...base, description: "x".repeat(201), notes: "y".repeat(1001), merchantName: "z".repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["description", "merchantName", "notes"]);
  });
});

describe("form helpers", () => {
  it("round-trips a saved transaction into editable values", () => {
    const v = formValuesFromTransaction({
      amountPaise: 1245678999, description: "TV", date: "2026-10-01", time: null, categoryId: "cat_electronics",
      merchantName: null, paymentMethod: "credit_card", status: "pending", notes: "",
    });
    expect(v.amount).toBe("12456789.99");
    expect(v.time).toBe("");
    expect(v.merchantName).toBe("");
    const r = validateExpenseForm(v);
    expect(r.ok && r.value.amountPaise).toBe(1245678999);
  });
  it("detects unsaved changes", () => {
    expect(isFormDirty(base, { ...base })).toBe(false);
    expect(isFormDirty(base, { ...base, notes: "a" })).toBe(true);
  });
});
