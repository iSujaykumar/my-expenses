import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";

import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { Category } from "../../repo/categories";
import { Transaction } from "../../repo/transactions";
import { notifyDataChanged } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { todayLocal } from "../../utils/date";
import { hapticWarning } from "../../utils/haptics";
import { ExpenseForm } from "./ExpenseForm";
import { emptyFormValues, ExpenseFormValues, formValuesFromTransaction, isFormDirty, ValidatedExpense } from "./form";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; initial: ExpenseFormValues; categories: Category[]; merchants: string[]; existing: Transaction | null };

/** Add (no id) or edit (id) an expense. */
export function ExpenseEditorScreen({ id }: { id?: string }) {
  const repos = useRepositories();
  const router = useRouter();
  const navigation = useNavigation();
  const showSnackbar = useSnackbar();
  const { colors } = useTheme();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const current = useRef<ExpenseFormValues | null>(null);
  const allowLeave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [active, merchants] = await Promise.all([repos.categories.list(), repos.merchants.recent(12)]);
      let existing: Transaction | null = null;
      let categories = active;
      let initial = emptyFormValues(todayLocal());
      if (id) {
        const t = await repos.transactions.getById(id);
        if (!t) {
          if (!cancelled) setState({ kind: "missing" });
          return;
        }
        existing = t;
        initial = formValuesFromTransaction(t);
        if (!active.some((c) => c.id === t.categoryId)) {
          const own = await repos.categories.getById(t.categoryId);
          if (own) categories = [...active, own];
        }
      }
      current.current = initial;
      if (!cancelled) setState({ kind: "ready", initial, categories, merchants: merchants.map((m) => m.name), existing });
    })().catch(() => {
      if (!cancelled) setState({ kind: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [id, repos]);

  // Confirm before throwing away unsaved changes (header back, Android back button, gestures).
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (allowLeave.current || state.kind !== "ready" || !current.current || !isFormDirty(state.initial, current.current)) return;
      e.preventDefault();
      Alert.alert("Discard changes?", "You have unsaved changes to this expense.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, state]);

  const leave = () => {
    allowLeave.current = true;
    router.back();
  };

  const save = async (v: ValidatedExpense) => {
    const merchantId = v.merchantName ? (await repos.merchants.getOrCreate(v.merchantName)).id : null;
    const input = {
      amountPaise: v.amountPaise,
      description: v.description,
      date: v.date,
      time: v.time,
      categoryId: v.categoryId,
      merchantId,
      paymentMethod: v.paymentMethod,
      status: v.status,
      notes: v.notes,
    };
    if (id) await repos.transactions.update(id, input);
    else await repos.transactions.create(input);
    notifyDataChanged();
    leave();
    showSnackbar({ message: id ? "Expense updated" : "Expense added" });
  };

  const confirmDelete = () => {
    if (state.kind !== "ready" || !state.existing) return;
    const record = state.existing;
    Alert.alert("Delete this expense?", "It will be removed from your history and totals.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const full = await repos.transactions.getById(record.id);
            if (!full) return leave();
            await repos.transactions.delete(record.id);
            hapticWarning();
            notifyDataChanged();
            leave();
            showSnackbar({
              message: "Expense deleted",
              actionLabel: "Undo",
              onAction: () => {
                repos.transactions
                  .restore(full)
                  .then(() => {
                    notifyDataChanged();
                    showSnackbar({ message: "Expense restored" });
                  })
                  .catch(() => showSnackbar({ message: "Could not restore the expense." }));
              },
            });
          } catch {
            Alert.alert("Could not delete", "Please try again.");
          }
        },
      },
    ]);
  };

  const title = id ? "Edit expense" : "Add expense";
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      {state.kind === "loading" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : state.kind === "missing" || state.kind === "error" ? (
        <EmptyState
          icon="alert-circle-outline"
          title={state.kind === "missing" ? "Expense not found" : "Could not load"}
          message={state.kind === "missing" ? "It may have been deleted." : "Please go back and try again."}
          actionLabel="Go back"
          onAction={leave}
        />
      ) : (
        <ExpenseForm
          initialValues={state.initial}
          categories={state.categories}
          recentMerchants={state.merchants}
          submitLabel={id ? "Save changes" : "Save expense"}
          onSubmit={save}
          onDelete={id ? confirmDelete : undefined}
          onValuesChange={(v) => {
            current.current = v;
          }}
        />
      )}
    </View>
  );
}
