import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../../src/components/Card";
import { IconTile } from "../../src/components/IconTile";
import { ListGroup, ListRow } from "../../src/components/ListRow";
import { SectionHeader } from "../../src/components/SectionHeader";
import { SegmentedControl } from "../../src/components/SegmentedControl";
import { AppSettings, SETTING_OPTIONS, SettingKey } from "../../src/repo/settings";
import { useAppSettings } from "../../src/state/AppSettings";
import { MAX_CONTENT_WIDTH } from "../../src/theme/motion";
import { categoryPalette } from "../../src/theme/tokens";
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

  const section = (title: string) => <SectionHeader title={title} variant="group" style={{ marginTop: spacing.xl }} />;
  const choice = <K extends SettingKey>(key: K, title: string, icon: string, tint: string, last = false) => (
    <View style={{ marginBottom: last ? 0 : spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
        <IconTile icon={icon} color={tint} size={32} />
        <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "600", marginLeft: spacing.md }}>{title}</Text>
      </View>
      <SegmentedControl
        accessibilityLabel={title}
        value={settings[key] as string}
        onChange={(v) => setSetting(key, v as AppSettings[K]).catch(() => Alert.alert("Not saved", "Could not save this setting."))}
        segments={(SETTING_OPTIONS[key] as unknown as readonly string[]).map((v) => ({
          value: v,
          label: key === "date_format" ? formatDisplayDate(today, v as AppSettings["date_format"]) : (LABELS[key] as Record<string, string>)[v],
        }))}
      />
    </View>
  );
  const privacyPoint = (icon: "phone-portrait-outline" | "lock-open-outline" | "trash-outline" | "share-outline", text: string) => (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md }}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginRight: spacing.md, marginTop: 1 }} />
      <Text style={{ color: colors.text, fontSize: type.small, lineHeight: 19, flex: 1 }}>{text}</Text>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 112, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
    >
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "800", letterSpacing: -0.6 }}>
        Settings
      </Text>

      {section("Appearance")}
      <Card>
        {choice("theme", "Theme", "contrast-outline", categoryPalette[4])}
        {choice("date_format", "Date format", "calendar-outline", categoryPalette[3])}
        {choice("week_start", "Week starts on", "today-outline", categoryPalette[5], true)}
      </Card>

      {section("Organise")}
      <ListGroup>
        <ListRow icon="pricetags-outline" iconColor={categoryPalette[4]} title="Categories" subtitle="Create, rename, recolour, archive" onPress={() => router.push("/settings/categories")} />
        <ListRow icon="wallet-outline" iconColor={categoryPalette[2]} title="Budgets" subtitle="Optional monthly limits" onPress={() => router.push("/settings/budgets")} />
        <ListRow icon="repeat-outline" iconColor={categoryPalette[3]} title="Recurring expenses" subtitle="Weekly or monthly bills shown in Due soon" onPress={() => router.push("/settings/recurring")} />
      </ListGroup>

      {section("Your data")}
      <ListGroup>
        <ListRow icon="cloud-download-outline" iconColor={categoryPalette[1]} title="Backup, export & restore" subtitle="CSV export, full backup, restore from file" onPress={() => router.push("/settings/backup")} />
        <ListRow icon="flask-outline" iconColor={categoryPalette[15]} title="Load sample expenses" subtitle="Preview first; removable later" onPress={() => router.push("/settings/sample")} />
        <ListRow icon="trash-outline" destructive title="Reset all data" subtitle="Delete everything on this phone" onPress={() => router.push("/settings/reset")} />
      </ListGroup>

      {section("Privacy")}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg }}>
          <IconTile icon="shield-checkmark-outline" color={colors.primary} size={40} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700" }}>Private by design</Text>
            <Text style={{ color: colors.textMuted, fontSize: type.small }}>Offline, no account, no tracking</Text>
          </View>
        </View>
        {privacyPoint("phone-portrait-outline", "Your data stays on this phone. Meow has no account, no ads, no analytics and never connects to the internet.")}
        {privacyPoint("lock-open-outline", "The data is not encrypted by the app. Anyone who can unlock your phone and open Meow can see it. Use your phone's screen lock.")}
        {privacyPoint("trash-outline", "Uninstalling Meow or using \"Clear storage\" in Android settings deletes all your expenses permanently, unless you exported a backup first.")}
        {privacyPoint("share-outline", "Exported files (CSV or backup) are not encrypted either. They go wherever you send them from the share menu; keep them somewhere safe.")}
      </Card>
      <Text style={{ color: colors.textFaint, fontSize: type.small, marginTop: spacing.lg, textAlign: "center" }}>Meow version {Constants.expoConfig?.version ?? "unknown"}</Text>
    </ScrollView>
  );
}
