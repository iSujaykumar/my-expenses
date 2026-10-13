import { View, Text } from "react-native";
import { PieChart } from "react-native-gifted-charts";

import { useTheme } from "../../theme/useTheme";
import { formatPaise } from "../../utils/money";
import { CategoryShare, chartSlices } from "./stats";

/** Donut chart plus an always-visible text list (the accessible alternative). */
export function CategoryBreakdown({ shares, totalPaise }: { shares: CategoryShare[]; totalPaise: number }) {
  const { colors, spacing, type } = useTheme();
  const slices = chartSlices(shares, 6, colors.textMuted);
  return (
    <View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", marginVertical: spacing.md }}>
        <PieChart
          data={slices.map((s) => ({ value: s.value, color: s.color }))}
          donut
          radius={88}
          innerRadius={58}
          innerCircleColor={colors.surface}
          strokeWidth={2}
          strokeColor={colors.surface}
          centerLabelComponent={() => (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.textMuted, fontSize: type.caption }}>Total</Text>
              <Text style={{ color: colors.text, fontSize: type.small, fontWeight: "700" }}>{formatPaise(totalPaise, { hideZeroPaise: true })}</Text>
            </View>
          )}
        />
      </View>
      {shares.map((s) => (
        <View
          key={s.categoryId}
          accessible
          accessibilityLabel={`${s.name}${s.isArchived ? " (archived)" : ""}: ${formatPaise(s.totalPaise)}, ${s.percent}%`}
          style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs + 2 }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.color, marginRight: spacing.sm }} />
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: type.body }}>
            {s.name}
            {s.isArchived ? <Text style={{ color: colors.textMuted }}> (archived)</Text> : null}
          </Text>
          <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "600" }}>{formatPaise(s.totalPaise)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: type.small, width: 56, textAlign: "right" }}>{s.percent.toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}
