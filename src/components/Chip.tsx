import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Selectable pill used for radio/checkbox style choices. */
export function Chip(props: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  role?: "radio" | "checkbox" | "button";
  testID?: string;
}) {
  const { colors, spacing, radii, type } = useTheme();
  const accent = props.color ?? colors.primary;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole={props.role ?? "radio"}
      accessibilityState={props.role === "button" ? undefined : props.role === "checkbox" ? { checked: props.selected } : { selected: props.selected }}
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 40,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: props.selected ? accent : colors.border,
        backgroundColor: props.selected ? colors.surfaceAlt : colors.surface,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      {props.icon ? <Ionicons name={props.icon} size={16} color={accent} style={{ marginRight: spacing.xs }} /> : null}
      {!props.icon && props.color ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent, marginRight: spacing.xs }} /> : null}
      <Text style={{ color: colors.text, fontSize: type.small, fontWeight: props.selected ? "700" : "500" }}>{props.label}</Text>
      {props.selected && props.role === "checkbox" ? <Ionicons name="checkmark" size={14} color={accent} style={{ marginLeft: spacing.xs }} /> : null}
    </Pressable>
  );
}
