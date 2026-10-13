import { useLocalSearchParams } from "expo-router";

import { ExpenseEditorScreen } from "../../src/features/expenses/ExpenseEditorScreen";

export default function EditExpenseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExpenseEditorScreen id={typeof id === "string" ? id : undefined} />;
}
