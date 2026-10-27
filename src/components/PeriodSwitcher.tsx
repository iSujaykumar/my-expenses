import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Compact "‹ October 2026 ›" pill used to move between months or other periods. */
export function PeriodSwitcher({
  label,
  onPrevious,
  onNext,
  previousAccessibilityLabel,
  nextAccessibilityLabel,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  previousAccessibilityLabel: string;
  nextAccessibilityLabel: string;
}) {
  const { colors, spacing, type, elevation } = useTheme();
  const arrow = (dir: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? previousAccessibilityLabel : nextAccessibilityLabel}
      onPress={dir < 0 ? onPrevious : onNext}
      hitSlop={4}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}
    >
      <Ionicons name={dir < 0 ? "chevron-back" : "chevron-forward"} size={20} color={colors.text} />
    </Pressable>
  );
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 2 },
        elevation,
      ]}
    >
      {arrow(-1)}
      <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "600", minWidth: 120, textAlign: "center", paddingHorizontal: spacing.xs }}>{label}</Text>
      {arrow(1)}
    </View>
  );
}
