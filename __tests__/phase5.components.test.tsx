import { fireEvent, render, screen } from "@testing-library/react-native";

import { BackupData } from "../src/data/backup";
import { ImportPlan } from "../src/data/importBackup";
import { ImportPreview } from "../src/features/data/ImportPreview";
import { isResetConfirmed, ResetScreen } from "../src/features/data/ResetScreen";
import { resolveDark } from "../src/theme/useTheme";
import { formatDisplayDate } from "../src/utils/date";

jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: { cache: "cache" } }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn(), isAvailableAsync: jest.fn(async () => true) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
const mockResetDb = { db: {} };
jest.mock("../src/db/DatabaseProvider", () => ({ useRepositories: () => mockResetDb }));
const mockReset = jest.fn(async () => {});
jest.mock("../src/data/reset", () => ({ ...jest.requireActual("../src/data/reset"), resetAllData: () => mockReset() }));

describe("theme preference", () => {
  it("system follows the phone, explicit choices win", () => {
    expect(resolveDark("system", "dark")).toBe(true);
    expect(resolveDark("system", "light")).toBe(false);
    expect(resolveDark("system", null)).toBe(false);
    expect(resolveDark("dark", "light")).toBe(true);
    expect(resolveDark("light", "dark")).toBe(false);
  });
});

describe("date format setting", () => {
  it("formats in all three styles", () => {
    expect(formatDisplayDate("2026-03-05", "DD MMM YYYY")).toBe("5 Mar 2026");
    expect(formatDisplayDate("2026-03-05", "DD/MM/YYYY")).toBe("05/03/2026");
    expect(formatDisplayDate("2026-03-05", "YYYY-MM-DD")).toBe("2026-03-05");
  });
});

describe("Reset all data", () => {
  it("only exact DELETE confirms", () => {
    expect(isResetConfirmed("DELETE")).toBe(true);
    expect(isResetConfirmed(" DELETE ")).toBe(true);
    expect(isResetConfirmed("delete")).toBe(false);
    expect(isResetConfirmed("DELET")).toBe(false);
    expect(isResetConfirmed("")).toBe(false);
  });
  it("button stays disabled until DELETE is typed", async () => {
    await render(<ResetScreen />);
    await fireEvent.press(screen.getByTestId("reset-button"));
    expect(mockReset).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId("reset-input"), "delete");
    await fireEvent.press(screen.getByTestId("reset-button"));
    expect(mockReset).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId("reset-input"), "DELETE");
    await fireEvent.press(screen.getByTestId("reset-button"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

describe("ImportPreview", () => {
  const counts = (n: number, d: number, i: number) => ({ new: n, duplicate: d, invalid: i });
  const plan: ImportPlan = {
    mode: "merge",
    counts: { categories: counts(1, 9, 0), merchants: counts(0, 2, 0), transactions: counts(5, 3, 1), budgets: counts(0, 0, 0), settings: counts(0, 3, 0) },
    invalid: [{ table: "transactions", index: 4, id: "x", reason: "amount_paise must be a positive whole number" }],
    toInsert: { categories: [], merchants: [], transactions: [], budgets: [], settings: [] } as unknown as BackupData,
    blockedReason: null,
  };
  it("shows new / duplicate / invalid counts and reasons", async () => {
    await render(<ImportPreview plan={plan} />);
    expect(screen.getByLabelText("Expenses: 5 new, 3 already here, 1 invalid")).toBeTruthy();
    expect(screen.getByText("1 invalid record will NOT be imported:")).toBeTruthy();
    expect(screen.getByText(/amount_paise must be a positive whole number/)).toBeTruthy();
  });
  it("shows why Replace is blocked", async () => {
    await render(<ImportPreview plan={{ ...plan, mode: "replace", blockedReason: "Replace is not allowed" }} />);
    expect(screen.getByText("Replace is not allowed")).toBeTruthy();
  });
});
