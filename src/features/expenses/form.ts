import { PAYMENT_METHODS, PaymentMethod, STATUSES, TransactionStatus } from "../../constants/categories";
import { TransactionInput } from "../../repo/transactions";
import { isValidDateString, isValidTimeString } from "../../utils/date";
import { paiseToInputString, parseRupeesToPaise } from "../../utils/money";

/** Raw, as-typed form values. Kept as strings so nothing the user typed is lost on a failed save. */
export interface ExpenseFormValues {
  amount: string;
  description: string;
  date: string;
  time: string;
  categoryId: string;
  merchantName: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes: string;
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export function emptyFormValues(today: string): ExpenseFormValues {
  return {
    amount: "",
    description: "",
    date: today,
    time: "",
    categoryId: "",
    merchantName: "",
    paymentMethod: "upi",
    status: "paid",
    notes: "",
  };
}

export function formValuesFromTransaction(t: {
  amountPaise: number; description: string; date: string; time: string | null; categoryId: string;
  merchantName: string | null; paymentMethod: PaymentMethod; status: TransactionStatus; notes: string;
}): ExpenseFormValues {
  return {
    amount: paiseToInputString(t.amountPaise),
    description: t.description,
    date: t.date,
    time: t.time ?? "",
    categoryId: t.categoryId,
    merchantName: t.merchantName ?? "",
    paymentMethod: t.paymentMethod,
    status: t.status,
    notes: t.notes,
  };
}

export type ValidatedExpense = Omit<TransactionInput, "merchantId"> & { merchantName: string };

/** Validates the form. Returns either field errors or a clean expense ready to save. */
export function validateExpenseForm(
  values: ExpenseFormValues,
): { ok: true; value: ValidatedExpense } | { ok: false; errors: ExpenseFormErrors } {
  const errors: ExpenseFormErrors = {};
  const amount = parseRupeesToPaise(values.amount);
  if (!amount.ok) errors.amount = amount.error;
  if (!isValidDateString(values.date)) errors.date = "Pick a valid date.";
  const time = values.time.trim();
  if (time && !isValidTimeString(time)) errors.time = "Time must be HH:MM (24-hour), e.g. 18:30.";
  if (!values.categoryId) errors.categoryId = "Pick a category.";
  if (!PAYMENT_METHODS.includes(values.paymentMethod)) errors.paymentMethod = "Pick a payment method.";
  if (!STATUSES.includes(values.status)) errors.status = "Pick a status.";
  if (values.description.trim().length > 200) errors.description = "Keep the description under 200 characters.";
  if (values.merchantName.trim().length > 80) errors.merchantName = "Keep the merchant name under 80 characters.";
  if (values.notes.trim().length > 1000) errors.notes = "Keep notes under 1000 characters.";
  if (Object.keys(errors).length > 0 || !amount.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      amountPaise: amount.paise,
      description: values.description.trim(),
      date: values.date,
      time: time || null,
      categoryId: values.categoryId,
      merchantName: values.merchantName.trim().replace(/\s+/g, " "),
      paymentMethod: values.paymentMethod,
      status: values.status,
      notes: values.notes.trim(),
    },
  };
}

/** True when the user changed anything (used to confirm discarding on back). */
export function isFormDirty(initial: ExpenseFormValues, current: ExpenseFormValues): boolean {
  return (Object.keys(initial) as (keyof ExpenseFormValues)[]).some((k) => initial[k] !== current[k]);
}
