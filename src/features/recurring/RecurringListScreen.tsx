import { useRouter } from "expo-router";
import { ComponentProps, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CategoryIcon } from "../../components/CategoryIcon";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { RecurringTemplate } from "../../repo/recurring";
import { useFormatDate } from "../../state/AppSettings";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { FONT_FAMILY, MONEY } from "../../theme/tokens";
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

  const smallButton = (label: string, icon: ComponentProps<typeof Ionicons>["name"], onPress: () => void, color = colors.primary, a11y?: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ minHeight: 44, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}
    >
      <Ionicons name={icon} size={16} color={color} style={{ marginRight: spacing.xs }} />
      <Text style={{ fontFamily: FONT_FAMILY, color, fontWeight: "600", fontSize: type.small }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recurring expenses" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, lineHeight: 19, marginBottom: spacing.lg, paddingHorizontal: spacing.xs }}>
          Templates for things you pay every week or month (rent, gym, phone). When one is due, it appears in &quot;Due soon&quot; on Home and you tap Record. Meow does not send notifications and never records anything by itself.
        </Text>
        <Button icon="add" label="Add recurring expense" onPress={() => router.push({ pathname: "/recurring/[id]", params: { id: "new" } })} style={{ marginBottom: spacing.lg }} />
        {items && items.length === 0 ? <EmptyState icon="repeat-outline" title="No recurring expenses" message="Add one for bills you pay regularly." /> : null}
        {items?.map((t) => (
          <Card key={t.id} padded={false} style={{ marginBottom: spacing.md, opacity: t.isPaused ? 0.72 : 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg }}>
              <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} size={42} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, fontWeight: "700", fontSize: type.body }}>
                  {t.description}
                  {t.isPaused ? " (paused)" : ""}
                </Text>
                <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, marginTop: 2 }}>{describeSchedule(t, formatDate)}</Text>
                <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small }}>{t.categoryName}</Text>
              </View>
              <Text style={{ ...MONEY, color: colors.text, fontWeight: "700", fontSize: type.body, marginLeft: spacing.sm }}>{formatPaise(t.amountPaise)}</Text>
            </View>
            <View style={{ flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
              {smallButton("Edit", "create-outline", () => router.push({ pathname: "/recurring/[id]", params: { id: t.id } }), colors.primary, `Edit ${t.description}`)}
              {smallButton(t.isPaused ? "Resume" : "Pause", t.isPaused ? "play-outline" : "pause-outline", () => void togglePause(t), colors.primary, `${t.isPaused ? "Resume" : "Pause"} ${t.description}`)}
              {smallButton("Delete", "trash-outline", () => remove(t), colors.danger, `Delete ${t.description}`)}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
