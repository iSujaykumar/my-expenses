import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { IconTile } from "../../components/IconTile";
import { useInputStyle } from "../../components/inputStyle";
import { categoryColor, MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { paiseToInputString, parseRupeesToPaise } from "../../utils/money";

/** One budget: amount (Rs) + on/off switch + Save / Remove. */
export function BudgetEditorRow(props: {
  title: string;
  color?: string | null;
  icon?: string | null;
  amountPaise: number | null;
  enabled: boolean;
  onSave: (amountPaise: number) => Promise<void>;
  onToggle?: (enabled: boolean) => Promise<void>;
  onRemove?: () => void;
  testID?: string;
}) {
  const { colors, spacing, type } = useTheme();
  const [text, setText] = useState(props.amountPaise ? paiseToInputString(props.amountPaise) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputStyle = useInputStyle({ invalid: !!error, focused });
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

  const tint = props.color ? categoryColor(props.color) : colors.primary;
  return (
    <Card testID={props.testID} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
        <IconTile icon={props.icon ?? (props.color ? "pricetag-outline" : "wallet-outline")} color={tint} size={36} />
        <Text style={{ flex: 1, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", marginLeft: spacing.md }}>{props.title}</Text>
        {props.onToggle ? (
          <Switch
            accessibilityLabel={`${props.title} budget ${props.enabled ? "on" : "off"}`}
            value={props.enabled}
            onValueChange={(v) => void props.onToggle?.(v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={[inputStyle, { flex: 1, flexDirection: "row", alignItems: "center" }]}>
          <Text style={{ ...MONEY, color: colors.textMuted, marginRight: spacing.xs, fontSize: type.body, fontWeight: "600" }}>Rs</Text>
          <TextInput
            testID={props.testID ? `${props.testID}-amount` : undefined}
            accessibilityLabel={`${props.title} monthly budget in rupees`}
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="decimal-pad"
            placeholder="Monthly amount"
            placeholderTextColor={colors.textFaint}
            style={{ ...MONEY, flex: 1, color: colors.text, fontSize: type.body, fontWeight: "600", paddingVertical: 0 }}
            maxLength={16}
          />
        </View>
        <Button
          testID={props.testID ? `${props.testID}-save` : undefined}
          label={saving ? "Saving…" : "Save"}
          accessibilityLabel={`Save ${props.title} budget`}
          disabled={saving || !changed}
          onPress={save}
          style={{ marginLeft: spacing.sm, paddingHorizontal: spacing.lg }}
        />
      </View>
      {error ? <Text style={{ color: colors.danger, fontSize: type.small, fontWeight: "500", marginTop: spacing.sm }}>{error}</Text> : null}
      {!props.enabled && props.amountPaise ? <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.sm }}>Off. Not shown on the dashboard.</Text> : null}
      {props.onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${props.title} budget`}
          onPress={props.onRemove}
          hitSlop={8}
          style={{ alignSelf: "flex-start", marginTop: spacing.md, flexDirection: "row", alignItems: "center", minHeight: 32 }}
        >
          <Ionicons name="trash-outline" size={15} color={colors.danger} style={{ marginRight: spacing.xs }} />
          <Text style={{ color: colors.danger, fontWeight: "600", fontSize: type.small }}>Remove budget</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
