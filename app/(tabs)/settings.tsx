import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListRow } from "../../src/components/ListRow";
import { useTheme } from "../../src/theme/useTheme";

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xxl }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", marginBottom: spacing.md, paddingHorizontal: spacing.lg }}>
        Settings
      </Text>
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <ListRow title="Categories" subtitle="Create, rename, recolour, archive" onPress={() => router.push("/settings/categories")} />
        <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.lg }} />
        <ListRow title="Budgets" subtitle="Optional monthly limits" onPress={() => router.push("/settings/budgets")} />
      </View>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xl }}>
          The app follows your phone&apos;s light/dark setting.
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>Meow version {Constants.expoConfig?.version ?? "unknown"}</Text>
        <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>All data stays on this phone. No account, no internet.</Text>
      </View>
    </ScrollView>
  );
}
