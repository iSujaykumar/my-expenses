import { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

/** Label + content + inline error message. */
export function FormField({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: colors.text, fontSize: type.small, fontWeight: "700", marginBottom: spacing.xs }}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: type.small, marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: colors.textMuted, fontSize: type.caption, marginTop: spacing.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
}
