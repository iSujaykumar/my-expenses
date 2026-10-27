import { Text, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";

import { categoryColor, MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { formatPaise } from "../../utils/money";
import { CategoryShare, chartSlices } from "./stats";

/** Donut chart with a centre total, plus an always-visible text list (the accessible alternative). */
export function CategoryBreakdown({ shares, totalPaise }: { shares: CategoryShare[]; totalPaise: number }) {
  const { colors, spacing, type } = useTheme();
  const slices = chartSlices(shares, 6, colors.textFaint);
  return (
    <View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.lg }}>
        <PieChart
          data={slices.map((s) => ({ value: s.value, color: categoryColor(s.color) }))}
          donut
          radius={92}
          innerRadius={68}
          innerCircleColor={colors.surface}
          strokeWidth={3}
          strokeColor={colors.surface}
          centerLabelComponent={() => (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.textMuted, fontSize: type.caption, fontWeight: "500" }}>Total</Text>
              <Text style={{ ...MONEY, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", marginTop: 2, letterSpacing: -0.3 }}>
                {formatPaise(totalPaise, { hideZeroPaise: true })}
              </Text>
            </View>
          )}
        />
      </View>
      {shares.map((s) => (
        <View
          key={s.categoryId}
          accessible
          accessibilityLabel={`${s.name}${s.isArchived ? " (archived)" : ""}: ${formatPaise(s.totalPaise)}, ${s.percent}%`}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: categoryColor(s.color), marginRight: spacing.md }} />
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: type.body }}>
            {s.name}
            {s.isArchived ? <Text style={{ color: colors.textMuted }}> (archived)</Text> : null}
          </Text>
          <Text style={{ ...MONEY, color: colors.text, fontSize: type.body, fontWeight: "600" }}>{formatPaise(s.totalPaise)}</Text>
          <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.small, width: 56, textAlign: "right" }}>{s.percent.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}
