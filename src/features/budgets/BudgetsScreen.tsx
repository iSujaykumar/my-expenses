import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { SectionHeader } from "../../components/SectionHeader";
import { CategoryPickerModal } from "../../components/CategoryPickerModal";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { Budget } from "../../repo/budgets";
import { Category } from "../../repo/categories";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { BudgetEditorRow } from "./BudgetEditorRow";

export function BudgetsScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const dataVersion = useDataVersion();
  const { colors, spacing, type } = useTheme();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState<Category | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([repos.budgets.list(), repos.categories.list({ includeArchived: true })])
      .then(([b, c]) => {
        if (!cancelled) {
          setBudgets(b);
          setCategories(c);
        }
      })
      .catch(() => !cancelled && setBudgets([]));
    return () => {
      cancelled = true;
    };
  }, [repos, dataVersion]);

  const changed = (message: string) => {
    notifyDataChanged();
    showSnackbar({ message });
  };
  const catById = new Map(categories.map((c) => [c.id, c]));
  const overall = budgets?.find((b) => b.scope === "overall") ?? null;
  const perCategory = (budgets ?? []).filter((b) => b.scope === "category");
  const available = categories.filter((c) => !c.isArchived && !perCategory.some((b) => b.categoryId === c.id));

  const remove = (b: Budget, title: string) =>
    Alert.alert(`Remove the ${title} budget?`, "Your expenses are not affected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await repos.budgets.delete(b.id);
          changed("Budget removed");
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Budgets" onBack={() => router.back()} />
      {!budgets ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
            <Text style={{ color: colors.textMuted, fontSize: type.small, lineHeight: 19, marginBottom: spacing.lg, paddingHorizontal: spacing.xs }}>
              Monthly limits are optional. Paid and pending expenses count; refunded ones don&apos;t. You&apos;ll see a gentle warning at 80% and a clear note at 100%.
            </Text>
            <BudgetEditorRow
              key={overall ? `${overall.id}-${overall.updatedAt}` : "overall-new"}
              testID="budget-overall"
              title="Overall"
              amountPaise={overall?.monthlyAmountPaise ?? null}
              enabled={overall?.enabled ?? true}
              onSave={async (paise) => {
                await repos.budgets.upsert({ scope: "overall", monthlyAmountPaise: paise, enabled: overall?.enabled ?? true });
                changed("Overall budget saved");
              }}
              onToggle={overall ? async (v) => { await repos.budgets.setEnabled(overall.id, v); changed(v ? "Budget turned on" : "Budget turned off"); } : undefined}
              onRemove={overall ? () => remove(overall, "overall") : undefined}
            />

            <SectionHeader title="Category budgets" variant="group" style={{ marginTop: spacing.lg }} />
            {perCategory.length === 0 && !newCategory ? (
              <Text style={{ color: colors.textMuted, marginBottom: spacing.md, paddingHorizontal: spacing.xs }}>None yet.</Text>
            ) : null}
            {perCategory.map((b) => {
              const c = b.categoryId ? catById.get(b.categoryId) : undefined;
              const title = c ? `${c.name}${c.isArchived ? " (archived)" : ""}` : "Category";
              return (
                <BudgetEditorRow
                  key={`${b.id}-${b.updatedAt}`}
                  title={title}
                  color={c?.color}
                  icon={c?.icon}
                  amountPaise={b.monthlyAmountPaise}
                  enabled={b.enabled}
                  onSave={async (paise) => {
                    await repos.budgets.upsert({ scope: "category", categoryId: b.categoryId, monthlyAmountPaise: paise, enabled: b.enabled });
                    changed(`${c?.name ?? "Category"} budget saved`);
                  }}
                  onToggle={async (v) => {
                    await repos.budgets.setEnabled(b.id, v);
                    changed(v ? "Budget turned on" : "Budget turned off");
                  }}
                  onRemove={() => remove(b, c?.name ?? "category")}
                />
              );
            })}
            {newCategory ? (
              <BudgetEditorRow
                key={`new-${newCategory.id}`}
                title={newCategory.name}
                color={newCategory.color}
                icon={newCategory.icon}
                amountPaise={null}
                enabled
                onSave={async (paise) => {
                  await repos.budgets.upsert({ scope: "category", categoryId: newCategory.id, monthlyAmountPaise: paise });
                  setNewCategory(null);
                  changed(`${newCategory.name} budget saved`);
                }}
                onRemove={() => setNewCategory(null)}
              />
            ) : null}
            {available.length > 0 && !newCategory ? (
              <Button variant="secondary" icon="add" label="Add a category budget" onPress={() => setPicking(true)} />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <CategoryPickerModal
        visible={picking}
        title="Budget for which category?"
        categories={available}
        onPick={(c) => {
          setPicking(false);
          setNewCategory(c);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}
