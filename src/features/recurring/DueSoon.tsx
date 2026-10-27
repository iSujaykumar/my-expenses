import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../../components/Card";
import { CategoryIcon } from "../../components/CategoryIcon";
import { SectionHeader } from "../../components/SectionHeader";
import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { DueItem } from "../../repo/recurring";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { useFormatDate } from "../../state/AppSettings";
import { MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { hapticSuccess } from "../../utils/haptics";
import { formatPaise } from "../../utils/money";

/** "Due soon" card on Home: recurring expenses due in the next 7 days (or missed in the last 60). Nothing is recorded until you tap Record. */
export function DueSoon({ today }: { today: string }) {
  const repos = useRepositories();
  const router = useRouter();
  const showSnackbar = useSnackbar();
  const formatDate = useFormatDate();
  const dataVersion = useDataVersion();
  const { colors, spacing, radii, type } = useTheme();
  const [items, setItems] = useState<DueItem[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repos.recurring
      .due(today)
      .then((d) => !cancelled && setItems(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repos, today, dataVersion]);

  if (!items.length) return null;

  const act = async (item: DueItem, action: "record" | "skip") => {
    const key = `${item.template.id}|${item.dueDate}`;
    if (busyKey) return; // ignore double taps while one is saving
    setBusyKey(key);
    try {
      if (action === "record") {
        const r = await repos.recurring.confirm(item.template.id, item.dueDate);
        if (r === "recorded") hapticSuccess();
        showSnackbar({ message: r === "recorded" ? `Recorded ${item.template.description}` : "Already recorded" });
      } else {
        await repos.recurring.skip(item.template.id, item.dueDate);
        showSnackbar({ message: `Skipped ${item.template.description} for ${formatDate(item.dueDate)}` });
      }
      notifyDataChanged();
    } catch {
      Alert.alert("Not saved", "Please try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const shown = items.slice(0, 6);
  return (
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}>
      <SectionHeader title="Due soon" actionLabel="Manage" actionAccessibilityLabel="Manage recurring expenses" onAction={() => router.push("/settings/recurring")} />
      <Card padded={false}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs }}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
          <Text style={{ color: colors.textMuted, fontSize: type.caption, flex: 1 }}>Nothing is recorded automatically. Tap Record when you have paid.</Text>
        </View>
        {shown.map((item, i) => {
          const key = `${item.template.id}|${item.dueDate}`;
          const busy = busyKey === key;
          return (
            <View key={key} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CategoryIcon icon={item.template.categoryIcon} color={item.template.categoryColor} size={40} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: type.body, fontWeight: "600" }}>{item.template.description}</Text>
                  <Text style={{ color: item.overdue ? colors.warning : colors.textMuted, fontSize: type.small, marginTop: 2, fontWeight: item.overdue ? "500" : "400" }}>
                    {item.dueDate === today ? "Due today" : item.overdue ? `Was due ${formatDate(item.dueDate)}` : `Due ${formatDate(item.dueDate)}`} · {item.template.categoryName}
                  </Text>
                </View>
                <Text style={{ ...MONEY, color: colors.text, fontSize: type.body, fontWeight: "600", marginLeft: spacing.sm }}>{formatPaise(item.template.amountPaise)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginLeft: 40 + spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Record ${item.template.description} ${formatPaise(item.template.amountPaise)} for ${formatDate(item.dueDate)}`}
                  accessibilityState={{ disabled: !!busyKey }}
                  disabled={!!busyKey}
                  onPress={() => act(item, "record")}
                  style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", borderRadius: radii.pill, backgroundColor: colors.primary, opacity: busyKey ? 0.6 : pressed ? 0.86 : 1 })}
                >
                  <Ionicons name="checkmark" size={16} color={colors.onPrimary} style={{ marginRight: spacing.xs }} />
                  <Text style={{ color: colors.onPrimary, fontWeight: "600", fontSize: type.small }}>{busy ? "Saving…" : "Record"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Skip ${item.template.description} for ${formatDate(item.dueDate)}`}
                  disabled={!!busyKey}
                  onPress={() => act(item, "skip")}
                  style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.pill, backgroundColor: pressed ? colors.border : colors.surfaceAlt })}
                >
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: type.small }}>Skip</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {items.length > shown.length ? (
          <Text style={{ color: colors.textMuted, fontSize: type.small, paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>+ {items.length - shown.length} more due</Text>
        ) : null}
      </Card>
    </View>
  );
}
