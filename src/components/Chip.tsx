import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { categoryColor } from "../theme/tokens";
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
  const dot = props.color ? categoryColor(props.color) : undefined;
  const iconColor = props.selected ? colors.onPrimarySoft : (dot ?? colors.textMuted);
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole={props.role ?? "radio"}
      accessibilityState={props.role === "button" ? undefined : props.role === "checkbox" ? { checked: props.selected } : { selected: props.selected }}
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        minHeight: 40,
        paddingHorizontal: spacing.md + 2,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: props.selected ? colors.primary : colors.border,
        backgroundColor: props.selected ? colors.primarySoft : pressed ? colors.surfaceAlt : colors.surface,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      })}
    >
      {props.icon ? <Ionicons name={props.icon} size={16} color={iconColor} style={{ marginRight: spacing.xs + 2 }} /> : null}
      {!props.icon && dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginRight: spacing.xs + 2 }} /> : null}
      <Text style={{ color: props.selected ? colors.onPrimarySoft : colors.text, fontSize: type.small, fontWeight: props.selected ? "600" : "500" }}>{props.label}</Text>
      {props.selected && props.role === "checkbox" ? <Ionicons name="checkmark" size={14} color={colors.onPrimarySoft} style={{ marginLeft: spacing.xs }} /> : null}
    </Pressable>
  );
}
