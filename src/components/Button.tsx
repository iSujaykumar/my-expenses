import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleProp, Text, ViewStyle } from "react-native";

import { useTheme } from "../theme/useTheme";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/** Standard button. Primary is filled teal; secondary is a soft tonal button; danger is for destructive actions. */
export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
  testID,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, type } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.surfaceAlt },
    danger: { bg: colors.dangerSurface, fg: colors.danger, border: colors.dangerSurface },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
  }[variant];
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 16,
          paddingHorizontal: spacing.xl,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          opacity: inactive ? 0.55 : pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} style={{ marginRight: spacing.sm }} /> : icon ? <Ionicons name={icon} size={19} color={palette.fg} style={{ marginRight: spacing.sm }} /> : null}
      <Text style={{ color: palette.fg, fontSize: type.body, fontWeight: "700", letterSpacing: 0.1 }}>{label}</Text>
    </Pressable>
  );
}
