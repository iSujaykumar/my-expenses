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
    <View style={{ alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={props.icon} size={32} color={colors.onPrimarySoft} />
      </View>
      <Text style={{ color: colors.text, fontSize: type.title, fontWeight: "700", marginTop: spacing.lg, textAlign: "center", letterSpacing: -0.3 }}>{props.title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: type.body, lineHeight: 22, marginTop: spacing.sm, textAlign: "center", maxWidth: 320 }}>{props.message}</Text>
      {props.actionLabel && props.onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onAction}
          style={({ pressed }) => ({
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.xl,
            minHeight: 48,
            justifyContent: "center",
          })}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: type.body }}>{props.actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
