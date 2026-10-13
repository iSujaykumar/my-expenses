import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

export function EmptyState(props: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, spacing, radii, type } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing.xxl }}>
      <Ionicons name={props.icon} size={48} color={colors.textMuted} />
      <Text style={{ color: colors.text, fontSize: type.title, fontWeight: "700", marginTop: spacing.md, textAlign: "center" }}>{props.title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: type.body, marginTop: spacing.sm, textAlign: "center" }}>{props.message}</Text>
      {props.actionLabel && props.onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onAction}
          style={{ marginTop: spacing.lg, borderColor: colors.primary, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}
        >
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: type.body }}>{props.actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
