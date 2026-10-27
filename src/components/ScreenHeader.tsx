import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/useTheme";

/** Top bar for pushed screens: round back button and a centred-left title, blending into the page. */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <View style={{ minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: colors.text, fontSize: type.title, fontWeight: "700", marginLeft: spacing.md, flex: 1, letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        {right}
      </View>
    </View>
  );
}
