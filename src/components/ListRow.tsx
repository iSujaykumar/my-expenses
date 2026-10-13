import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Tappable settings-style row with a chevron. */
export function ListRow({ title, subtitle, left, onPress }: { title: string; subtitle?: string; left?: ReactNode; onPress: () => void }) {
  const { colors, spacing, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: pressed ? colors.surfaceAlt : colors.surface })}
    >
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
