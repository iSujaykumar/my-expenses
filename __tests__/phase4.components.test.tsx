import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { BudgetBar } from "../src/components/BudgetBar";
import { snackbarBottomOffset } from "../src/components/Snackbar";
import { ValidationError } from "../src/db/types";
import { BudgetEditorRow } from "../src/features/budgets/BudgetEditorRow";
import { CategoryForm, validateCategoryName } from "../src/features/categories/CategoryForm";
import { CategoryBreakdown } from "../src/features/dashboard/CategoryBreakdown";
import { categoryShares } from "../src/features/dashboard/stats";

describe("BudgetBar", () => {
  it("ok state shows remaining", async () => {
    await render(<BudgetBar title="Overall" spentPaise={5000} budgetPaise={10000} percentUsed={50} level="ok" />);
    expect(screen.getByText("50% used")).toBeTruthy();
    expect(screen.getByText("Rs 50.00 left")).toBeTruthy();
    expect(screen.getByText("Rs 50.00 of Rs 100.00")).toBeTruthy();
  });
  it("warning at 80% is calm", async () => {
    await render(<BudgetBar title="Food" spentPaise={8000} budgetPaise={10000} percentUsed={80} level="warning" />);
    expect(screen.getByText("Nearly there · Rs 20.00 left")).toBeTruthy();
  });
  it("exactly 100% and over", async () => {
    await render(<BudgetBar title="Food" spentPaise={10000} budgetPaise={10000} percentUsed={100} level="over" />);
    expect(screen.getByText("Budget fully used")).toBeTruthy();
    await render(<BudgetBar title="Food" spentPaise={12550} budgetPaise={10000} percentUsed={125} level="over" />);
    expect(screen.getByText("Over by Rs 25.50")).toBeTruthy();
  });
});

describe("CategoryBreakdown text alternative", () => {
  it("lists every category with amount and percent, marking archived ones", async () => {
    const shares = categoryShares([
      { categoryId: "a", name: "Food", color: "#111111", icon: "x", isArchived: false, totalPaise: 30000, count: 2 },
      { categoryId: "b", name: "Pets", color: "#222222", icon: "x", isArchived: true, totalPaise: 10000, count: 1 },
    ]);
    await render(<CategoryBreakdown shares={shares} totalPaise={40000} />);
    expect(screen.getByText("Rs 300.00")).toBeTruthy();
    expect(screen.getByText("75.0%")).toBeTruthy();
    expect(screen.getByText("25.0%")).toBeTruthy();
    expect(screen.getByText(" (archived)")).toBeTruthy();
    expect(screen.getByLabelText("Pets (archived): Rs 100.00, 25%")).toBeTruthy();
  });
});

describe("CategoryForm", () => {
  const initial = { name: "", color: "#2E7D32", icon: "cart-outline" };
  it("validates names", () => {
    expect(validateCategoryName("  ")).toBe("Enter a name.");
    expect(validateCategoryName("x".repeat(41))).toMatch(/40/);
    expect(validateCategoryName(" Coffee ")).toBeNull();
  });
  it("blocks an empty name inline", async () => {
    const onSubmit = jest.fn();
    await render(<CategoryForm initial={initial} submitLabel="Create category" onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByTestId("category-save"));
    expect(screen.getByText("Enter a name.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it("shows a duplicate-name error from the database and keeps the text", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new ValidationError("name", "A category with this name already exists."));
    await render(<CategoryForm initial={initial} submitLabel="Create category" onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByTestId("category-name-input"), "Food");
    await fireEvent.press(screen.getByTestId("category-save"));
    await waitFor(() => expect(screen.getByText("A category with this name already exists.")).toBeTruthy());
    expect(screen.getByTestId("category-name-input").props.value).toBe("Food");
  });
  it("submits trimmed name with chosen colour", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<CategoryForm initial={initial} submitLabel="Create category" onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByTestId("category-name-input"), "  Coffee ");
    await fireEvent.press(screen.getByLabelText("Colour #1565C0"));
    await fireEvent.press(screen.getByTestId("category-save"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Coffee", color: "#1565C0", icon: "cart-outline" }));
  });
});

describe("BudgetEditorRow", () => {
  it("rejects invalid amounts and saves integer paise", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(<BudgetEditorRow testID="b" title="Overall" amountPaise={null} enabled onSave={onSave} />);
    await fireEvent.changeText(screen.getByTestId("b-amount"), "0");
    await fireEvent.press(screen.getByTestId("b-save"));
    expect(screen.getByText("Amount must be more than zero.")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("b-amount"), "15,000.50");
    await fireEvent.press(screen.getByTestId("b-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1500050));
  });
});

describe("snackbar position", () => {
  it("uses safe-area insets instead of a fixed offset", () => {
    expect(snackbarBottomOffset(0, false)).toBe(84);
    expect(snackbarBottomOffset(24, false)).toBe(108);
    expect(snackbarBottomOffset(24, true)).toBe(24 + 8 + 56 + 72);
  });
});
