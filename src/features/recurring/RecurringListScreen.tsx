import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "../../components/CategoryIcon";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { RecurringTemplate } from "../../repo/recurring";
import { useFormatDate } from "../../state/AppSettings";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { formatPaise } from "../../utils/money";

export function describeSchedule(t: Pick<RecurringTemplate, "frequency" | "dayOfMonth" | "startDate">, formatDate: (d: string) => string): string {
  if (t.frequency === "weekly") {
    const wd = new Date(`${t.startDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
    return `Every week on ${wd}, from ${formatDate(t.startDate)}`;
  }
  const d = t.dayOfMonth ?? 1;
  const suffix = d >= 29 ? " (or the month's last day)" : "";
  return `Every month on day ${d}${suffix}, from ${formatDate(t.startDate)}`;
}

export function RecurringListScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const formatDate = useFormatDate();
  const dataVersion = useDataVersion();
  const { colors, spacing, radii, type } = useTheme();
  const [items, setItems] = useState<RecurringTemplate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    repos.recurring
      .list()
      .then((l) => !cancelled && setItems(l))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [repos, dataVersion]);

  const togglePause = async (t: RecurringTemplate) => {
    await repos.recurring.setPaused(t.id, !t.isPaused);
    notifyDataChanged();
    showSnackbar({ message: t.isPaused ? `${t.description} resumed` : `${t.description} paused` });
  };
  const remove = (t: RecurringTemplate) =>
    Alert.alert("Delete recurring expense?", `"${t.description}" will stop appearing in Due soon. Expenses already recorded from it are kept.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await repos.recurring.delete(t.id);
          notifyDataChanged();
          showSnackbar({ message: "Recurring expense deleted" });
        },
      },
    ]);

  const smallButton = (label: string, onPress: () => void, color = colors.primary, a11y?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} hitSlop={6} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm }}>
      <Text style={{ color, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recurring expenses" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        <Text style={{ color: colors.textMuted, fontSize: type.small, marginBottom: spacing.md }}>
          Templates for things you pay every week or month (rent, gym, phone). When one is due, it appears in &quot;Due soon&quot; on Home and you tap Record. Meow does not send notifications and never records anything by itself.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/recurring/[id]", params: { id: "new" } })}
          style={{ height: 48, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Add recurring expense</Text>
        </Pressable>
        {items && items.length === 0 ? <EmptyState icon="repeat-outline" title="No recurring expenses" message="Add one for bills you pay regularly." /> : null}
        {items?.map((t) => (
          <View key={t.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm, opacity: t.isPaused ? 0.7 : 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{t.description}{t.isPaused ? " (paused)" : ""}</Text>
                <Text style={{ color: colors.textMuted, fontSize: type.small }}>{describeSchedule(t, formatDate)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: type.small }}>{t.categoryName}</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{formatPaise(t.amountPaise)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {smallButton("Edit", () => router.push({ pathname: "/recurring/[id]", params: { id: t.id } }), colors.primary, `Edit ${t.description}`)}
              {smallButton(t.isPaused ? "Resume" : "Pause", () => void togglePause(t), colors.primary, `${t.isPaused ? "Resume" : "Pause"} ${t.description}`)}
              {smallButton("Delete", () => remove(t), colors.danger, `Delete ${t.description}`)}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
