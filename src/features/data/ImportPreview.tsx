import { Text, View } from "react-native";

import { TABLE_ORDER, TableName } from "../../data/backup";
import { ImportPlan } from "../../data/importBackup";
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
  const { colors, spacing, type } = useTheme();
  const cell = (text: string | number, bold = false, color = colors.text) => (
    <Text style={{ flex: 1, textAlign: "right", color, fontSize: type.small, fontWeight: bold ? "700" : "400" }}>{text}</Text>
  );
  return (
    <View>
      <View style={{ flexDirection: "row", paddingVertical: spacing.xs }}>
        <Text style={{ flex: 1.4, color: colors.textMuted, fontSize: type.small, fontWeight: "700" }}>{plan.mode === "replace" ? "Will contain" : "Record"}</Text>
        {cell(plan.mode === "replace" ? "Count" : "New", true, colors.textMuted)}
        {plan.mode === "merge" ? cell("Already here", true, colors.textMuted) : null}
        {cell("Invalid", true, colors.textMuted)}
      </View>
      {TABLE_ORDER.map((t) => (
        <View key={t} accessible accessibilityLabel={`${TABLE_LABELS[t]}: ${plan.counts[t].new} ${plan.mode === "replace" ? "" : "new, "}${plan.mode === "merge" ? `${plan.counts[t].duplicate} already here, ` : ""}${plan.counts[t].invalid} invalid`} style={{ flexDirection: "row", paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ flex: 1.4, color: colors.text, fontSize: type.small }}>{TABLE_LABELS[t]}</Text>
          {cell(plan.counts[t].new)}
          {plan.mode === "merge" ? cell(plan.counts[t].duplicate) : null}
          {cell(plan.counts[t].invalid, plan.counts[t].invalid > 0, plan.counts[t].invalid > 0 ? colors.danger : colors.text)}
        </View>
      ))}
      {plan.invalid.length ? (
        <View style={{ marginTop: spacing.md }}>
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
      {plan.blockedReason ? <Text style={{ color: colors.danger, marginTop: spacing.md, fontSize: type.small, fontWeight: "700" }}>{plan.blockedReason}</Text> : null}
    </View>
  );
}
