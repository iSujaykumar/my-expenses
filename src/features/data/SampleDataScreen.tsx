import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { STARTER_CATEGORIES } from "../../constants/categories";
import { existingSampleIds, loadSampleData, removeSampleData, SAMPLE_ITEMS, sampleCount, sampleId, sampleTotalPaise } from "../../data/sampleData";
import { useRepositories } from "../../db/DatabaseProvider";
import { useFormatDate } from "../../state/AppSettings";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
import { MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { parseDateString, toDateString, todayLocal } from "../../utils/date";
import { formatPaise } from "../../utils/money";

const categoryName = (id: string) => STARTER_CATEGORIES.find((c) => c.id === id)?.name ?? "Other";

function openDatePicker(current: string, onPick: (d: string) => void) {
  const { year, month, day } = parseDateString(current);
  DateTimePickerAndroid.open({
    value: new Date(year, month - 1, day),
    mode: "date",
    maximumDate: new Date(),
    onChange: (ev, d) => {
      if (ev.type === "set" && d) onPick(toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    },
  });
}

export function SampleDataScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const formatDate = useFormatDate();
  const dataVersion = useDataVersion();
  const { colors, spacing, radii, type } = useTheme();
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(SAMPLE_ITEMS.map((i) => [i.key, todayLocal()])));
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    existingSampleIds(repos.db)
      .then((s) => !cancelled && setLoaded(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repos, dataVersion]);

  const pending = SAMPLE_ITEMS.filter((i) => !loaded.has(sampleId(i.key)));
  const count = sampleCount(pending);
  const total = sampleTotalPaise(pending);
  const flagged = pending.filter((i) => i.flag).length;
  const distinctDates = new Set(pending.map((i) => dates[i.key])).size;

  const setAll = () => openDatePicker(todayLocal(), (d) => setDates(Object.fromEntries(SAMPLE_ITEMS.map((i) => [i.key, d]))));

  const load = () =>
    Alert.alert(
      "Add sample expenses?",
      `${count} expenses totalling ${formatPaise(total)} will be added${distinctDates === 1 ? `, all dated ${formatDate(pending[0] ? dates[pending[0].key] : todayLocal())}` : ` across ${distinctDates} dates`}. They are marked "Sample data" in notes and can be removed together later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: async () => {
            setBusy(true);
            try {
              const r = await loadSampleData(repos.db, dates);
              notifyDataChanged();
              showSnackbar({ message: `Added ${r.inserted} sample expenses` });
            } catch {
              Alert.alert("Not added", "Nothing was changed. Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  const remove = () =>
    Alert.alert("Remove sample expenses?", `Deletes the ${loaded.size} sample expenses only. Your own expenses are not touched.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            const n = await removeSampleData(repos.db);
            notifyDataChanged();
            showSnackbar({ message: `Removed ${n} sample expenses` });
          } catch {
            Alert.alert("Not removed", "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const button = (label: string, onPress: () => void, variant: "primary" | "outline" | "danger", disabled = false, icon?: React.ComponentProps<typeof Ionicons>["name"]) => (
    <Button label={label} icon={icon} variant={variant === "outline" ? "secondary" : variant} onPress={onPress} disabled={disabled || busy} style={{ marginTop: spacing.sm }} />
  );
  const items = SAMPLE_ITEMS.filter((i) => !loaded.has(sampleId(i.key)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Sample expenses" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        <Text style={{ color: colors.textMuted, fontSize: type.small, lineHeight: 19, paddingHorizontal: spacing.xs }}>
          Your own list of past purchases. Nothing is added until you tap &quot;Add&quot; and confirm. The real dates are unknown, so every date starts as today: set one date for all, or tap a date to change it. You can also edit each expense afterwards.
        </Text>
        {loaded.size > 0 ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.textMuted }}>{loaded.size} sample expenses are already in the app.</Text>
            {button(`Remove ${loaded.size} sample expenses`, remove, "danger", false, "trash-outline")}
          </Card>
        ) : null}
        {count === 0 ? (
          <Text style={{ color: colors.textMuted, marginTop: spacing.lg, textAlign: "center" }}>All sample expenses are already added.</Text>
        ) : (
          <>
            <View accessible style={{ marginTop: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.primarySoft }}>
              <Text style={{ ...MONEY, color: colors.onPrimarySoft, fontWeight: "800", fontSize: type.title }}>
                {count} expenses · {formatPaise(total)}
              </Text>
              <Text style={{ color: colors.onPrimarySoft, fontSize: type.small, marginTop: 2, opacity: 0.85 }}>Count and total are worked out from the list below.</Text>
              {flagged ? <Text style={{ color: colors.warning, fontSize: type.small, marginTop: spacing.xs, fontWeight: "600" }}>{flagged} items are flagged ⚑ as uncertain. Check them after adding.</Text> : null}
            </View>
            {button("Set one date for all…", setAll, "outline", false, "calendar-outline")}
            <Card padded={false} style={{ marginTop: spacing.md }}>
              {items.map((i, idx) => (
                <View key={i.key} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingTop: spacing.xs }}>
                    <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1 }}>
                      {i.flag ? "⚑ " : ""}
                      {i.description}
                    </Text>
                    <Text style={{ ...MONEY, color: colors.text, fontWeight: "700" }}>{formatPaise(i.rupees * 100)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textMuted, fontSize: type.small }}>
                      {categoryName(i.categoryId)}
                      {i.merchant ? ` · ${i.merchant}` : ""}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Date for ${i.description} ${formatPaise(i.rupees * 100)}: ${formatDate(dates[i.key])}. Change`}
                      onPress={() => openDatePicker(dates[i.key], (d) => setDates((s) => ({ ...s, [i.key]: d })))}
                      style={{ minHeight: 44, flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons name="calendar-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: type.small }}>{formatDate(dates[i.key])}</Text>
                    </Pressable>
                  </View>
                  {i.flag ? <Text style={{ color: colors.warning, fontSize: type.caption, paddingBottom: spacing.xs }}>{i.flag}</Text> : null}
                </View>
              ))}
            </Card>
            {button(`Add ${count} sample expenses`, load, "primary", false, "add-circle-outline")}
          </>
        )}
      </ScrollView>
    </View>
  );
}
