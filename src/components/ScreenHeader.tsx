import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/useTheme";

/** Simple top bar with a back button; respects the status bar safe area. */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={8} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.title, fontWeight: "700", marginLeft: spacing.xs, flex: 1 }}>
          {title}
        </Text>
      </View>
    </View>
  );
}
