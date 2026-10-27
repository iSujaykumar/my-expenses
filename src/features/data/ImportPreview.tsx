import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { TABLE_ORDER, TableName } from "../../data/backup";
import { ImportPlan } from "../../data/importBackup";
import { MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

const TABLE_LABELS: Record<TableName, string> = {
  transactions: "Expenses",
  categories: "Categories",
  merchants: "Merchants",
  budgets: "Budgets",
  settings: "Settings",
};

export const DEDUPE_EXPLANATION =
  "Every record in Meow has a permanent ID. When merging, a record whose ID is already on this phone is the same record, so it is skipped and your phone's copy is kept. Categories and merchants with the same name (ignoring capital letters) are treated as the same, and imported expenses are linked to yours. Budgets for a category that already has one, and all settings, keep this phone's values.";

/** Table of what an import will do: new / duplicate / invalid per kind of record. */
export function ImportPreview({ plan }: { plan: ImportPlan }) {
  const { colors, spacing, radii, type } = useTheme();
  const cell = (text: string | number, bold = false, color = colors.text) => (
    <Text style={{ ...MONEY, flex: 1, textAlign: "right", color, fontSize: type.small, fontWeight: bold ? "700" : "500" }}>{text}</Text>
  );
  return (
    <View>
      <View style={{ borderRadius: radii.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
      <View style={{ flexDirection: "row", paddingVertical: spacing.sm }}>
        <Text style={{ flex: 1.4, color: colors.textMuted, fontSize: type.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>{plan.mode === "replace" ? "Will contain" : "Record"}</Text>
        {cell(plan.mode === "replace" ? "Count" : "New", true, colors.textMuted)}
        {plan.mode === "merge" ? cell("Already here", true, colors.textMuted) : null}
        {cell("Invalid", true, colors.textMuted)}
      </View>
      {TABLE_ORDER.map((t) => (
        <View key={t} accessible accessibilityLabel={`${TABLE_LABELS[t]}: ${plan.counts[t].new} ${plan.mode === "replace" ? "" : "new, "}${plan.mode === "merge" ? `${plan.counts[t].duplicate} already here, ` : ""}${plan.counts[t].invalid} invalid`} style={{ flexDirection: "row", paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
          <Text style={{ flex: 1.4, color: colors.text, fontSize: type.small, fontWeight: "500" }}>{TABLE_LABELS[t]}</Text>
          {cell(plan.counts[t].new)}
          {plan.mode === "merge" ? cell(plan.counts[t].duplicate) : null}
          {cell(plan.counts[t].invalid, plan.counts[t].invalid > 0, plan.counts[t].invalid > 0 ? colors.danger : colors.text)}
        </View>
      ))}
      </View>
      {plan.invalid.length ? (
        <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerSurface }}>
          <Text style={{ color: colors.danger, fontSize: type.small, fontWeight: "700" }}>
            {plan.invalid.length} invalid {plan.invalid.length === 1 ? "record" : "records"} will NOT be imported:
          </Text>
          {plan.invalid.slice(0, 8).map((r) => (
            <Text key={`${r.table}-${r.index}`} style={{ color: colors.textMuted, fontSize: type.caption, marginTop: 2 }}>
              • {TABLE_LABELS[r.table]} #{r.index}: {r.reason}
            </Text>
          ))}
          {plan.invalid.length > 8 ? <Text style={{ color: colors.textMuted, fontSize: type.caption }}>…and {plan.invalid.length - 8} more</Text> : null}
        </View>
      ) : null}
      {plan.blockedReason ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerSurface }}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: spacing.sm }} />
          <Text style={{ flex: 1, color: colors.danger, fontSize: type.small, fontWeight: "700" }}>{plan.blockedReason}</Text>
        </View>
      ) : null}
    </View>
  );
}
