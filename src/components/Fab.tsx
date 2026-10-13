import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Big, always-visible "Add expense" button. */
export function Fab({ onPress, label = "Add expense" }: { onPress: () => void; label?: string }) {
  const { colors, spacing, radii, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          borderRadius: radii.pill,
          right: spacing.lg,
          bottom: spacing.lg,
          paddingHorizontal: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name="add" size={26} color={colors.onPrimary} />
      <Text style={{ color: colors.onPrimary, fontSize: type.bodyLarge, fontWeight: "700", marginLeft: spacing.sm }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", height: 56, flexDirection: "row", alignItems: "center", elevation: 4 },
});
