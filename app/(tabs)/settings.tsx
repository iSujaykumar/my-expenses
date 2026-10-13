import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "../../src/components/Chip";
import { ListRow } from "../../src/components/ListRow";
import { AppSettings, SETTING_OPTIONS, SettingKey } from "../../src/repo/settings";
import { useAppSettings } from "../../src/state/AppSettings";
import { useTheme } from "../../src/theme/useTheme";
import { formatDisplayDate, todayLocal } from "../../src/utils/date";

const LABELS: { [K in SettingKey]: Record<AppSettings[K], string> } = {
  theme: { system: "Follow phone", light: "Light", dark: "Dark" },
  week_start: { monday: "Monday", sunday: "Sunday" },
  date_format: { "DD MMM YYYY": "", "DD/MM/YYYY": "", "YYYY-MM-DD": "" },
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, setSetting } = useAppSettings();
  const today = todayLocal();

  const section = (title: string) => (
    <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "700", textTransform: "uppercase", marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.lg }}>
      {title}
    </Text>
  );
  const choice = <K extends SettingKey>(key: K, title: string) => (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <Text style={{ color: colors.text, fontSize: type.body, marginBottom: spacing.xs }}>{title}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {(SETTING_OPTIONS[key] as unknown as readonly AppSettings[K][]).map((v) => (
          <Chip
            key={v}
            label={key === "date_format" ? formatDisplayDate(today, v as AppSettings["date_format"]) : (LABELS[key] as Record<string, string>)[v]}
            selected={settings[key] === v}
            onPress={() => setSetting(key, v).catch(() => Alert.alert("Not saved", "Could not save this setting."))}
          />
        ))}
      </View>
    </View>
  );
  const divider = <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.lg }} />;
  const para = (text: string) => <Text style={{ color: colors.text, fontSize: type.small, marginBottom: spacing.sm }}>{text}</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxl }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", paddingHorizontal: spacing.lg }}>
        Settings
      </Text>

      {section("Appearance")}
      {choice("theme", "Theme")}
      {choice("date_format", "Date format")}
      {choice("week_start", "Week starts on")}

      {section("Organise")}
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <ListRow title="Categories" subtitle="Create, rename, recolour, archive" onPress={() => router.push("/settings/categories")} />
        {divider}
        <ListRow title="Budgets" subtitle="Optional monthly limits" onPress={() => router.push("/settings/budgets")} />
        {divider}
        <ListRow title="Recurring expenses" subtitle="Weekly or monthly bills shown in Due soon" onPress={() => router.push("/settings/recurring")} />
      </View>

      {section("Your data")}
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <ListRow title="Backup, export & restore" subtitle="CSV export, full backup, restore from file" onPress={() => router.push("/settings/backup")} />
        {divider}
        <ListRow title="Load sample expenses" subtitle="Preview first; removable later" onPress={() => router.push("/settings/sample")} />
        {divider}
        <ListRow title="Reset all data" subtitle="Delete everything on this phone" onPress={() => router.push("/settings/reset")} />
      </View>

      {section("Privacy")}
      <View style={{ paddingHorizontal: spacing.lg }}>
        {para("Your data stays on this phone. Meow has no account, no ads, no analytics and never connects to the internet.")}
        {para("The data is not encrypted by the app. Anyone who can unlock your phone and open Meow can see it. Use your phone's screen lock.")}
        {para("Uninstalling Meow or using \"Clear storage\" in Android settings deletes all your expenses permanently, unless you exported a backup first.")}
        {para("Exported files (CSV or backup) are not encrypted either. They go wherever you send them from the share menu; keep them somewhere safe.")}
        <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.md }}>Meow version {Constants.expoConfig?.version ?? "unknown"}</Text>
      </View>
    </ScrollView>
  );
}
