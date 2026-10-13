import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { EmptyState } from "../src/components/EmptyState";
import { SnackbarProvider, useSnackbar } from "../src/components/Snackbar";
import { TransactionRow } from "../src/components/TransactionRow";
import { ValidationError } from "../src/db/types";
import { ExpenseForm } from "../src/features/expenses/ExpenseForm";
import { emptyFormValues } from "../src/features/expenses/form";
import { Category } from "../src/repo/categories";
import { TransactionWithDetails } from "../src/repo/transactions";

const cat = (id: string, name: string, isArchived = false): Category => ({
  id, name, color: "#2E7D32", icon: "cart-outline", isArchived, sortOrder: 0, createdAt: "x", updatedAt: "x",
});
const categories = [cat("cat_food", "Food"), cat("cat_travel", "Travel")];

const row = (overrides: Partial<TransactionWithDetails> = {}): TransactionWithDetails => ({
  id: "t1", amountPaise: 1245678999, description: "Laptop", date: "2026-10-13", time: null, categoryId: "cat_food",
  merchantId: null, paymentMethod: "upi", status: "paid", notes: "", createdAt: "x", updatedAt: "x",
  categoryName: "Food", categoryColor: "#2E7D32", categoryIcon: "cart-outline", categoryArchived: false, merchantName: null,
  ...overrides,
});

describe("ExpenseForm", () => {
  const setup = async (props: Partial<Parameters<typeof ExpenseForm>[0]> = {}) => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <ExpenseForm
        initialValues={emptyFormValues("2026-10-13")}
        categories={categories}
        recentMerchants={["Swiggy", "Uber"]}
        submitLabel="Save expense"
        onSubmit={onSubmit}
        {...props}
      />,
    );
    return { onSubmit };
  };

  it("shows inline errors on an empty save and keeps what was typed", async () => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByTestId("description-input"), "Dinner");
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(screen.getByText("Enter an amount.")).toBeTruthy();
    expect(screen.getByText("Pick a category.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("description-input").props.value).toBe("Dinner");
  });

  it("clears an error as soon as it is fixed after a failed save", async () => {
    await setup();
    await fireEvent.press(screen.getByTestId("save-button"));
    await fireEvent.changeText(screen.getByTestId("amount-input"), "250");
    expect(screen.queryByText("Enter an amount.")).toBeNull();
  });

  it("submits integer paise with the chosen options", async () => {
    const { onSubmit } = await setup();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "1,234.5");
    await fireEvent.press(screen.getByTestId("category-cat_travel"));
    await fireEvent.press(screen.getByTestId("status-pending"));
    await fireEvent.press(screen.getByText("Swiggy"));
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      amountPaise: 123450, categoryId: "cat_travel", status: "pending", merchantName: "Swiggy", date: "2026-10-13", time: null,
    });
  });

  it("maps a save error to its field and keeps the values", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new ValidationError("categoryId", "This category is archived. Pick another one."));
    await setup({ onSubmit, initialValues: { ...emptyFormValues("2026-10-13"), amount: "10", categoryId: "cat_food" } });
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(screen.getByText("This category is archived. Pick another one.")).toBeTruthy());
    expect(screen.getByTestId("amount-input").props.value).toBe("10");
  });

  it("shows a generic message for unexpected save failures", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("disk full"));
    await setup({ onSubmit, initialValues: { ...emptyFormValues("2026-10-13"), amount: "10", categoryId: "cat_food" } });
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(screen.getByText(/Could not save this expense/)).toBeTruthy());
  });

  it("shows the archived category of an expense being edited, and Delete only when editing", async () => {
    const onDelete = jest.fn();
    await setup({ categories: [...categories, cat("cat_pets", "Pets", true)], onDelete });
    expect(screen.getByText("Pets (archived)")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("delete-button"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("has no Delete button when adding", async () => {
    await setup();
    expect(screen.queryByTestId("delete-button")).toBeNull();
  });
});

describe("TransactionRow", () => {
  it("shows Indian formatted amount and no badge when paid", async () => {
    await render(<TransactionRow transaction={row()} onPress={jest.fn()} />);
    expect(screen.getByText("Rs 1,24,56,789.99")).toBeTruthy();
    expect(screen.queryByText("Pending")).toBeNull();
  });
  it("shows a Pending badge for pending rows and passes the id on press", async () => {
    const onPress = jest.fn();
    await render(<TransactionRow transaction={row({ status: "pending", id: "abc" })} onPress={onPress} />);
    expect(screen.getByText("Pending")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledWith("abc");
  });
  it("marks refunded rows", async () => {
    await render(<TransactionRow transaction={row({ status: "refunded" })} onPress={jest.fn()} />);
    expect(screen.getByText("Refunded")).toBeTruthy();
  });
});

describe("EmptyState and Snackbar", () => {
  it("empty state action works", async () => {
    const onAction = jest.fn();
    await render(<EmptyState icon="search-outline" title="No matching expenses" message="Try again" actionLabel="Clear filters" onAction={onAction} />);
    await fireEvent.press(screen.getByText("Clear filters"));
    expect(onAction).toHaveBeenCalled();
  });

  it("snackbar shows a message and runs Undo once, then hides", async () => {
    const undo = jest.fn();
    function Trigger() {
      const show = useSnackbar();
      return <Text onPress={() => show({ message: "Expense deleted", actionLabel: "Undo", onAction: undo })}>delete</Text>;
    }
    await render(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>,
    );
    await fireEvent.press(screen.getByText("delete"));
    expect(screen.getByText("Expense deleted")).toBeTruthy();
    await fireEvent.press(screen.getByText("Undo"));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Expense deleted")).toBeNull();
  });
});
