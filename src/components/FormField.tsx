import { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Label + content + inline error message. */
export function FormField({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "600", marginBottom: spacing.sm, marginLeft: spacing.xxs }}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: type.small, fontWeight: "500", marginTop: spacing.xs + 2, marginLeft: spacing.xxs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: colors.textMuted, fontSize: type.caption, marginTop: spacing.xs + 2, marginLeft: spacing.xxs }}>{hint}</Text>
      ) : null}
    </View>
  );
}
