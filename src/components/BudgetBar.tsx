import { Text, View } from "react-native";

import { BudgetLevel } from "../repo/budgets";
import { categoryColor, FONT_FAMILY, MONEY } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { formatPaise } from "../utils/money";

/** Spent vs budget with a calm warning at 80% and an "over" state at 100%. */
export function BudgetBar(props: { title: string; color?: string | null; spentPaise: number; budgetPaise: number; percentUsed: number; level: BudgetLevel }) {
  const { colors, spacing, radii, type } = useTheme();
  const barColor = props.level === "over" ? colors.danger : props.level === "warning" ? colors.warning : colors.primary;
  const dot = props.color ? categoryColor(props.color) : null;
  const remaining = props.budgetPaise - props.spentPaise;
  const status =
    props.level === "over"
      ? remaining === 0
        ? "Budget fully used"
        : `Over by ${formatPaise(-remaining)}`
      : props.level === "warning"
        ? `Nearly there · ${formatPaise(remaining)} left`
        : `${formatPaise(remaining)} left`;
  return (
    <View
      accessible
      accessibilityLabel={`${props.title} budget: spent ${formatPaise(props.spentPaise)} of ${formatPaise(props.budgetPaise)}, ${props.percentUsed}% used. ${status}`}
      style={{ marginBottom: spacing.md }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 1 }}>
          {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginRight: spacing.sm }} /> : null}
          <Text numberOfLines={1} style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.body, fontWeight: "600" }}>{props.title}</Text>
        </View>
        <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.small, fontWeight: "500" }}>{props.percentUsed}% used</Text>
      </View>
      <View style={{ height: 10, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${Math.min(100, props.percentUsed)}%`, height: "100%", backgroundColor: barColor, borderRadius: radii.pill }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs + 2 }}>
        <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.small }}>
          {formatPaise(props.spentPaise)} of {formatPaise(props.budgetPaise)}
        </Text>
        <Text style={{ ...MONEY, color: props.level === "ok" ? colors.textMuted : barColor, fontSize: type.small, fontWeight: props.level === "ok" ? "400" : "600" }}>{status}</Text>
      </View>
    </View>
  );
}
