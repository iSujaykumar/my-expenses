import Constants from "expo-constants";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/useTheme";

export default function SettingsScreen() {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", marginBottom: spacing.md }}>
        Settings
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: type.body }}>
        Theme, categories, budgets and backup arrive in later phases. The app currently follows your phone’s light/dark setting.
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xl }}>Meow version {Constants.expoConfig?.version ?? "unknown"}</Text>
      <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>All data stays on this phone. No account, no internet.</Text>
    </View>
  );
}
