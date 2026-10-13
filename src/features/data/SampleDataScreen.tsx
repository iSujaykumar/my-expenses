import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { STARTER_CATEGORIES } from "../../constants/categories";
import { existingSampleIds, loadSampleData, removeSampleData, SAMPLE_ITEMS, sampleCount, sampleId, sampleTotalPaise } from "../../data/sampleData";
import { useRepositories } from "../../db/DatabaseProvider";
import { useFormatDate } from "../../state/AppSettings";
import { notifyDataChanged, useDataVersion } from "../../state/dataEvents";
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

  const button = (label: string, onPress: () => void, variant: "primary" | "outline" | "danger", disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{ minHeight: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center", marginTop: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: variant === "primary" ? colors.primary : colors.surface, borderWidth: variant === "primary" ? 0 : 1, borderColor: variant === "danger" ? colors.danger : colors.primary, opacity: disabled || busy ? 0.5 : 1 }}
    >
      <Text style={{ color: variant === "primary" ? colors.onPrimary : variant === "danger" ? colors.danger : colors.primary, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Sample expenses" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        <Text style={{ color: colors.text, fontSize: type.body }}>
          Your own list of past purchases. Nothing is added until you tap &quot;Add&quot; and confirm. The real dates are unknown, so every date starts as today: set one date for all, or tap a date to change it. You can also edit each expense afterwards.
        </Text>
        {loaded.size > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textMuted }}>{loaded.size} sample expenses are already in the app.</Text>
            {button(`Remove ${loaded.size} sample expenses`, remove, "danger")}
          </View>
        ) : null}
        {count === 0 ? (
          <Text style={{ color: colors.textMuted, marginTop: spacing.lg }}>All sample expenses are already added.</Text>
        ) : (
          <>
            <View accessible style={{ marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: type.bodyLarge }}>{count} expenses · {formatPaise(total)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: type.small }}>Count and total are worked out from the list below.</Text>
              {flagged ? <Text style={{ color: colors.warning, fontSize: type.small, marginTop: 2 }}>{flagged} items are flagged ⚑ as uncertain. Check them after adding.</Text> : null}
            </View>
            {button("Set one date for all…", setAll, "outline")}
            {SAMPLE_ITEMS.filter((i) => !loaded.has(sampleId(i.key))).map((i) => (
              <View key={i.key} style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.text, fontWeight: "600", flexShrink: 1 }}>{i.flag ? "⚑ " : ""}{i.description}</Text>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{formatPaise(i.rupees * 100)}</Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted, fontSize: type.small }}>{categoryName(i.categoryId)}{i.merchant ? ` · ${i.merchant}` : ""}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Date for ${i.description} ${formatPaise(i.rupees * 100)}: ${formatDate(dates[i.key])}. Change`} onPress={() => openDatePicker(dates[i.key], (d) => setDates((s) => ({ ...s, [i.key]: d })))} style={{ minHeight: 44, justifyContent: "center" }}>
                    <Text style={{ color: colors.primary, fontWeight: "600" }}>{formatDate(dates[i.key])} ✎</Text>
                  </Pressable>
                </View>
                {i.flag ? <Text style={{ color: colors.warning, fontSize: type.caption }}>{i.flag}</Text> : null}
              </View>
            ))}
            {button(`Add ${count} sample expenses`, load, "primary")}
          </>
        )}
      </ScrollView>
    </View>
  );
}
