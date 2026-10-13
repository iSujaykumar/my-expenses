import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryPickerModal } from "../../components/CategoryPickerModal";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { Category } from "../../repo/categories";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { categoryIcons, categoryPalette } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { CategoryForm } from "./CategoryForm";

type MoveMode = "move" | "move_then_archive" | "move_then_delete";

export function CategoryEditorScreen({ id }: { id?: string }) {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const dataVersion = useDataVersion();
  const { colors, spacing, radii, type } = useTheme();
  const [category, setCategory] = useState<Category | null | undefined>(id ? undefined : null);
  const [count, setCount] = useState(0);
  const [targets, setTargets] = useState<Category[]>([]);
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([repos.categories.getById(id), repos.categories.transactionCount(id), repos.categories.list()])
      .then(([c, n, active]) => {
        if (cancelled) return;
        setCategory(c);
        setCount(n);
        setTargets(active.filter((a) => a.id !== id));
      })
      .catch(() => !cancelled && setCategory(null));
    return () => {
      cancelled = true;
    };
  }, [id, repos, dataVersion]);

  const done = (message: string) => {
    notifyDataChanged();
    showSnackbar({ message });
  };

  const save = async (v: { name: string; color: string; icon: string }) => {
    if (id) {
      await repos.categories.update(id, v);
      done("Category saved");
    } else {
      await repos.categories.create(v);
      done("Category created");
    }
    router.back();
  };

  const archive = async (archived: boolean) => {
    if (!category) return;
    await repos.categories.setArchived(category.id, archived);
    done(archived ? `“${category.name}” archived` : `“${category.name}” is active again`);
  };

  const askArchive = () => {
    if (!category) return;
    if (category.isArchived) return void archive(false);
    const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [{ text: "Cancel", style: "cancel" }];
    if (count > 0) buttons.push({ text: "Move expenses first", onPress: () => setMoveMode("move_then_archive") });
    buttons.push({ text: "Archive", onPress: () => void archive(true) });
    Alert.alert(
      `Archive “${category.name}”?`,
      count > 0
        ? `It will be hidden when adding expenses. Its ${count} ${count === 1 ? "expense stays" : "expenses stay"} in history and totals. You can also move them to another category first.`
        : "It will be hidden when adding expenses. You can unarchive it later.",
      buttons,
    );
  };

  const askDelete = () => {
    if (!category) return;
    if (count > 0) {
      Alert.alert(
        `“${category.name}” has ${count} ${count === 1 ? "expense" : "expenses"}`,
        "To delete it, first move its expenses to another category. Nothing is lost: amounts and dates stay the same.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Move and delete", style: "destructive", onPress: () => setMoveMode("move_then_delete") },
        ],
      );
      return;
    }
    Alert.alert(`Delete “${category.name}”?`, "It has no expenses. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await repos.categories.deleteIfUnused(category.id);
            done("Category deleted");
            router.back();
          } catch {
            Alert.alert("Could not delete", "Please try again.");
          }
        },
      },
    ]);
  };

  const confirmMove = (target: Category) => {
    if (!category || !moveMode) return;
    const mode = moveMode;
    setMoveMode(null);
    const after = mode === "move_then_archive" ? ` Then “${category.name}” will be archived.` : mode === "move_then_delete" ? ` Then “${category.name}” will be deleted.` : "";
    Alert.alert(
      "Move expenses?",
      `Move ${count} ${count === 1 ? "expense" : "expenses"} from “${category.name}” to “${target.name}”? Amounts and dates stay the same; overall totals don't change.${after}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move",
          style: mode === "move_then_delete" ? "destructive" : "default",
          onPress: async () => {
            try {
              const moved = await repos.categories.reassignTransactions(category.id, target.id);
              if (mode === "move_then_archive") await repos.categories.setArchived(category.id, true);
              if (mode === "move_then_delete") await repos.categories.deleteIfUnused(category.id);
              done(`Moved ${moved} ${moved === 1 ? "expense" : "expenses"} to “${target.name}”`);
              if (mode === "move_then_delete") router.back();
            } catch {
              Alert.alert("Could not move expenses", "Nothing was changed. Please try again.");
            }
          },
        },
      ],
    );
  };

  const button = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: danger ? colors.danger : colors.border, alignItems: "center", justifyContent: "center", marginTop: spacing.sm, backgroundColor: colors.surface }}
    >
      <Text style={{ color: danger ? colors.danger : colors.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={id ? "Edit category" : "New category"} onBack={() => router.back()} />
      {category === undefined ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />
      ) : id && !category ? (
        <EmptyState icon="alert-circle-outline" title="Category not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      ) : (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
            {category?.isArchived ? (
              <Text style={{ color: colors.warning, backgroundColor: colors.warningSurface, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.lg }}>
                This category is archived. It is hidden when adding expenses but kept in history.
              </Text>
            ) : null}
            <CategoryForm
              key={category?.id ?? "new"}
              initial={category ? { name: category.name, color: category.color, icon: category.icon } : { name: "", color: categoryPalette[0], icon: categoryIcons[0] }}
              submitLabel={id ? "Save changes" : "Create category"}
              onSubmit={save}
            />
            {category ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={{ color: colors.textMuted, fontSize: type.small, marginBottom: spacing.xs }}>
                  {count} {count === 1 ? "expense uses" : "expenses use"} this category. Renaming or recolouring keeps all of them.
                </Text>
                {count > 0 ? button("Move expenses to another category", () => setMoveMode("move")) : null}
                {button(category.isArchived ? "Unarchive" : "Archive", askArchive)}
                {button("Delete category", askDelete, true)}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <CategoryPickerModal
        visible={moveMode !== null}
        title="Move expenses to…"
        message={category ? `Pick where the ${count} ${count === 1 ? "expense" : "expenses"} from “${category.name}” should go.` : undefined}
        categories={targets}
        onPick={confirmMove}
        onClose={() => setMoveMode(null)}
      />
    </View>
  );
}
