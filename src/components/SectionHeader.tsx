import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { useTheme } from "../theme/useTheme";

/**
 * Title above a group of content. "section" is a bold sentence-case heading;
 * "group" is the small muted label used above settings-style groups.
 */
export function SectionHeader({
  title,
  variant = "section",
  actionLabel,
  onAction,
  actionAccessibilityLabel,
  style,
}: {
  title: string;
  variant?: "section" | "group";
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, type } = useTheme();
  const group = variant === "group";
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, paddingHorizontal: group ? spacing.xs : 0 },
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        style={
          group
            ? { color: colors.textMuted, fontSize: type.small, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" }
            : { color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", letterSpacing: -0.2 }
        }
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
          hitSlop={12}
          onPress={onAction}
          style={{ minHeight: 32, justifyContent: "center" }}
        >
          <Text style={{ color: colors.primary, fontSize: type.small, fontWeight: "600" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
