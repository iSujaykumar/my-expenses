import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { useTheme } from "../../theme/useTheme";
import { paiseToInputString, parseRupeesToPaise } from "../../utils/money";

/** One budget: amount (Rs) + on/off switch + Save / Remove. */
export function BudgetEditorRow(props: {
  title: string;
  color?: string | null;
  amountPaise: number | null;
  enabled: boolean;
  onSave: (amountPaise: number) => Promise<void>;
  onToggle?: (enabled: boolean) => Promise<void>;
  onRemove?: () => void;
  testID?: string;
}) {
  const { colors, spacing, radii, type } = useTheme();
  const [text, setText] = useState(props.amountPaise ? paiseToInputString(props.amountPaise) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changed = props.amountPaise === null || text !== paiseToInputString(props.amountPaise);

  const save = async () => {
    const r = parseRupeesToPaise(text);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await props.onSave(r.paise);
      setText(paiseToInputString(r.paise));
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID={props.testID} style={{ padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
        {props.color ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: props.color, marginRight: spacing.sm }} /> : null}
        <Text style={{ flex: 1, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>{props.title}</Text>
        {props.onToggle ? (
          <Switch
            accessibilityLabel={`${props.title} budget ${props.enabled ? "on" : "off"}`}
            value={props.enabled}
            onValueChange={(v) => void props.onToggle?.(v)}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48, borderWidth: 1, borderColor: error ? colors.danger : colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md }}>
          <Text style={{ color: colors.textMuted, marginRight: spacing.xs }}>Rs</Text>
          <TextInput
            testID={props.testID ? `${props.testID}-amount` : undefined}
            accessibilityLabel={`${props.title} monthly budget in rupees`}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (error) setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="Monthly amount"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: type.body }}
            maxLength={16}
          />
        </View>
        <Pressable
          testID={props.testID ? `${props.testID}-save` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Save ${props.title} budget`}
          disabled={saving || !changed}
          onPress={save}
          style={{ height: 48, paddingHorizontal: spacing.lg, marginLeft: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary, justifyContent: "center", opacity: saving || !changed ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "700" }}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: type.small, marginTop: spacing.xs }}>{error}</Text> : null}
      {!props.enabled && props.amountPaise ? <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>Off. Not shown on the dashboard.</Text> : null}
      {props.onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${props.title} budget`} onPress={props.onRemove} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: spacing.md }}>
          <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove budget</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
