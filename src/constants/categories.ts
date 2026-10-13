/** Starter categories seeded by migration 1. IDs are fixed so they never change. */
export interface StarterCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { id: "cat_shopping", name: "Shopping", color: "#C2185B", icon: "bag-handle-outline" },
  { id: "cat_groceries", name: "Groceries", color: "#2E7D32", icon: "cart-outline" },
  { id: "cat_food", name: "Food", color: "#E65100", icon: "restaurant-outline" },
  { id: "cat_transport", name: "Transport", color: "#1565C0", icon: "car-outline" },
  { id: "cat_bills", name: "Bills & Utilities", color: "#6A1B9A", icon: "flash-outline" },
  { id: "cat_electronics", name: "Electronics", color: "#00838F", icon: "phone-portrait-outline" },
  { id: "cat_clothing", name: "Clothing", color: "#AD1457", icon: "shirt-outline" },
  { id: "cat_health", name: "Health & Fitness", color: "#C62828", icon: "fitness-outline" },
  { id: "cat_pets", name: "Pets", color: "#795548", icon: "paw-outline" },
  { id: "cat_home", name: "Home", color: "#5D4037", icon: "home-outline" },
  { id: "cat_gifts", name: "Gifts", color: "#D81B60", icon: "gift-outline" },
  { id: "cat_travel", name: "Travel", color: "#0277BD", icon: "airplane-outline" },
  { id: "cat_education", name: "Education", color: "#283593", icon: "school-outline" },
  { id: "cat_other", name: "Other", color: "#546E7A", icon: "ellipsis-horizontal-circle-outline" },
];

export const PAYMENT_METHODS = ["cash", "upi", "debit_card", "credit_card", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  debit_card: "Debit card",
  credit_card: "Credit card",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export const STATUSES = ["paid", "pending", "refunded"] as const;
export type TransactionStatus = (typeof STATUSES)[number];

/**
 * THE status rule, used by every total, chart and budget:
 * paid and pending count as spending; refunded never counts.
 */
export const COUNTED_STATUSES: readonly TransactionStatus[] = ["paid", "pending"];
export const COUNTED_STATUS_SQL = `status IN ('paid', 'pending')`;

export function countsAsSpending(status: TransactionStatus): boolean {
  return COUNTED_STATUSES.includes(status);
}
