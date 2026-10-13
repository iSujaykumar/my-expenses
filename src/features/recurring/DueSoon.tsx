import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { useSnackbar } from "../../components/Snackbar";
import { useRepositories } from "../../db/DatabaseProvider";
import { DueItem } from "../../repo/recurring";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { useFormatDate } from "../../state/AppSettings";
import { useTheme } from "../../theme/useTheme";
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
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>Due soon</Text>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push("/settings/recurring")}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Manage</Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: type.caption, marginBottom: spacing.sm }}>Nothing is recorded automatically. Tap Record when you have paid.</Text>
      {shown.map((item) => {
        const key = `${item.template.id}|${item.dueDate}`;
        const busy = busyKey === key;
        return (
          <View key={key} style={{ paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1 }}>{item.template.description}</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{formatPaise(item.template.amountPaise)}</Text>
            </View>
            <Text style={{ color: item.overdue ? colors.warning : colors.textMuted, fontSize: type.small }}>
              {item.dueDate === today ? "Due today" : item.overdue ? `Was due ${formatDate(item.dueDate)}` : `Due ${formatDate(item.dueDate)}`} · {item.template.categoryName}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Record ${item.template.description} ${formatPaise(item.template.amountPaise)} for ${formatDate(item.dueDate)}`}
                accessibilityState={{ disabled: !!busyKey }}
                disabled={!!busyKey}
                onPress={() => act(item, "record")}
                style={{ minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.primary, opacity: busyKey ? 0.6 : 1 }}
              >
                <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{busy ? "Saving…" : "Record"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Skip ${item.template.description} for ${formatDate(item.dueDate)}`}
                disabled={!!busyKey}
                onPress={() => act(item, "skip")}
                style={{ minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>Skip</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {items.length > shown.length ? <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>+ {items.length - shown.length} more due</Text> : null}
    </View>
  );
}
