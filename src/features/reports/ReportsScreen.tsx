import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "../../components/Card";
import { PeriodSwitcher } from "../../components/PeriodSwitcher";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useRepositories } from "../../db/DatabaseProvider";
import { useAppSettings, useFormatDate } from "../../state/AppSettings";
import { subscribeDataChanged } from "../../state/dataEvents";
import { MAX_CONTENT_WIDTH } from "../../theme/motion";
import { FONT_FAMILY, MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import {
  addMonths, compareWithPreviousMonth, DateRange, monthLabel, monthOf, monthRange, parseDateString, toDateString, todayLocal, YearMonth, yearRange,
} from "../../utils/date";
import { formatPaise } from "../../utils/money";
import { CategoryBreakdown } from "../dashboard/CategoryBreakdown";
import { Granularity, loadReport, ReportData } from "./calc";

type Mode = "month" | "year" | "custom";

export interface Comparison {
  label: string;
  previousPaise: number;
  differencePaise: number;
}

/** Range for the period before the given one (same mode). */
function previousRange(mode: Mode, range: DateRange, ym: YearMonth, year: number): { range: DateRange; name: string } | null {
  if (mode === "month") {
    const p = addMonths(ym, -1);
    return { range: monthRange(p.year, p.month), name: monthLabel(p) };
  }
  if (mode === "year") return { range: yearRange(year - 1), name: String(year - 1) };
  return null;
}

export function ReportsScreen() {
  const repos = useRepositories();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, type } = useTheme();
  const { settings } = useAppSettings();
  const formatDate = useFormatDate();
  const today = todayLocal();
  const [mode, setMode] = useState<Mode>("month");
  const [ym, setYm] = useState<YearMonth>(monthOf(today));
  const [year, setYear] = useState(monthOf(today).year);
  const [custom, setCustom] = useState<DateRange>({ start: toDateString(monthOf(today).year, monthOf(today).month, 1), end: today });
  const [granularity, setGranularity] = useState<Granularity | undefined>(undefined);
  const [showTable, setShowTable] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState(false);

  const range: DateRange = mode === "month" ? monthRange(ym.year, ym.month) : mode === "year" ? yearRange(year) : custom;

  const fetchReport = useCallback(async (): Promise<{ r: ReportData; cmp: Comparison | null }> => {
    {
      const r = await loadReport(repos, range, today, settings.week_start, granularity, formatDate);
      const prev = previousRange(mode, range, ym, year);
      let cmp: Comparison | null = null;
      if (prev) {
        const p = await repos.transactions.summary({ range: prev.range });
        if (mode === "month") {
          const c = compareWithPreviousMonth(ym, r.summary.totalPaise, p.totalPaise);
          cmp = { label: c.label, previousPaise: p.totalPaise, differencePaise: c.differencePaise };
        } else {
          const diff = r.summary.totalPaise - p.totalPaise;
          const label =
            p.totalPaise === 0
              ? r.summary.totalPaise === 0 ? `Same as ${prev.name}` : `No spending in ${prev.name} to compare`
              : diff === 0 ? `Same as ${prev.name}` : `${diff > 0 ? "Up" : "Down"} ${(Math.round((Math.abs(diff) * 1000) / p.totalPaise) / 10).toFixed(1)}% vs ${prev.name}`;
          cmp = { label, previousPaise: p.totalPaise, differencePaise: diff };
        }
      }
      return { r, cmp };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, range.start, range.end, today, settings.week_start, granularity, formatDate, mode]);

  useEffect(() => {
    let cancelled = false;
    const run = () =>
      fetchReport()
        .then(({ r, cmp }) => {
          if (cancelled) return;
          setData(r);
          setComparison(cmp);
          setError(false);
        })
        .catch(() => !cancelled && setError(true));
    run();
    const unsubscribe = subscribeDataChanged(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchReport]);

  const pickDate = (which: "start" | "end") => {
    const { year: y, month: m, day: d } = parseDateString(custom[which]);
    DateTimePickerAndroid.open({
      value: new Date(y, m - 1, d),
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        const s = toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
        setCustom((c) => {
          const next = { ...c, [which]: s };
          // Keep start <= end by moving the other end.
          if (next.start > next.end) return which === "start" ? { start: s, end: s } : { start: s, end: s };
          return next;
        });
      },
    });
  };

  const periodTitle = mode === "month" ? monthLabel(ym) : mode === "year" ? String(year) : `${formatDate(custom.start)} – ${formatDate(custom.end)}`;
  const canNext = mode === "month" ? monthRange(ym.year, ym.month).end < today : mode === "year" ? year < monthOf(today).year : false;

  const step = (delta: number) => {
    if (mode === "month") setYm((v) => addMonths(v, delta));
    else setYear((v) => v + delta);
  };

  const card = (title: string, children: ReactNode, how?: string) => (
    <Card style={{ marginBottom: spacing.md }}>
      <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, color: colors.text, fontWeight: "700", fontSize: type.bodyLarge, letterSpacing: -0.2, marginBottom: spacing.md }}>
        {title}
      </Text>
      {children}
      {how ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} style={{ marginRight: spacing.xs + 2, marginTop: 1 }} />
          <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption, lineHeight: 17, flex: 1 }}>How this is calculated: {how}</Text>
        </View>
      ) : null}
    </Card>
  );

  const barList = (rows: { key: string; name: string; totalPaise: number; count: number; percent: number }[]) => {
    const max = Math.max(1, ...rows.map((r) => r.totalPaise));
    return rows.map((r) => (
      <View
        key={r.key}
        accessible
        accessibilityLabel={`${r.name}: ${formatPaise(r.totalPaise)}, ${r.percent}% of spending, ${r.count} ${r.count === 1 ? "expense" : "expenses"}`}
        style={{ marginBottom: spacing.md }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, flex: 1, fontSize: type.body, fontWeight: "500" }} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={{ ...MONEY, color: colors.text, fontWeight: "600", fontSize: type.body }}>{formatPaise(r.totalPaise)}</Text>
          <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.small, width: 44, textAlign: "right" }}>{r.percent}%</Text>
        </View>
        <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, marginTop: spacing.xs + 2, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${Math.max(2, (r.totalPaise / max) * 100)}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
        </View>
      </View>
    ));
  };

  const trendMax = data ? Math.max(0, ...data.trend.map((p) => p.totalPaise)) : 0;
  const trendIcon = comparison ? (comparison.differencePaise > 0 ? "trending-up" : comparison.differencePaise < 0 ? "trending-down" : "remove") : "remove";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 112, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
    >
      <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.headline, fontWeight: "800", letterSpacing: -0.6, marginBottom: spacing.md }}>
        Reports
      </Text>
      <SegmentedControl
        accessibilityLabel="Report period type"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setGranularity(undefined);
        }}
        segments={[
          { value: "month", label: "Month" },
          { value: "year", label: "Year" },
          { value: "custom", label: "Custom range" },
        ]}
      />

      <View style={{ alignItems: "center", marginVertical: spacing.md }}>
        {mode === "custom" ? (
          <View style={{ flexDirection: "row", alignSelf: "stretch", gap: spacing.sm }}>
            {(["start", "end"] as const).map((w) => (
              <Pressable
                key={w}
                accessibilityRole="button"
                accessibilityLabel={`${w === "start" ? "From" : "To"} ${formatDate(custom[w])}. Change`}
                onPress={() => pickDate(w)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  paddingHorizontal: spacing.md,
                  backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                })}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>{w === "start" ? "From" : "To"}</Text>
                  <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, fontWeight: "600", fontSize: type.body }}>{formatDate(custom[w])}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <PeriodSwitcher
            label={periodTitle}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            nextDisabled={!canNext}
            previousAccessibilityLabel="Previous period"
            nextAccessibilityLabel="Next period"
          />
        )}
      </View>

      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.dangerSurface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md }}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: spacing.sm }} />
          <Text style={{ fontFamily: FONT_FAMILY, color: colors.danger, fontSize: type.body }}>Could not load this report.</Text>
        </View>
      ) : null}
      {data ? (
        <>
          {card(
            "Total spent",
            <>
              <Text accessibilityLabel={`Total spent ${formatPaise(data.summary.totalPaise)}`} style={{ ...MONEY, color: colors.text, fontSize: type.display, fontWeight: "700", letterSpacing: -0.8 }}>
                {formatPaise(data.summary.totalPaise)}
              </Text>
              <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, marginTop: spacing.xs, fontSize: type.small }}>
                {data.summary.count} {data.summary.count === 1 ? "expense" : "expenses"} · {data.info.note}
              </Text>
              {comparison ? (
                <View style={{ flexDirection: "row", marginTop: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 1, flexShrink: 1 }}>
                    <Ionicons name={trendIcon} size={14} color={colors.text} style={{ marginRight: spacing.xs }} />
                    <Text style={{ ...MONEY, color: colors.text, fontSize: type.caption, fontWeight: "600", flexShrink: 1 }}>
                      {comparison.label}
                      {comparison.previousPaise > 0 ? ` (${formatPaise(comparison.previousPaise)})` : ""}
                    </Text>
                  </View>
                </View>
              ) : null}
              {data.averagePerDayPaise !== null || data.summary.pendingPaise > 0 || data.summary.refundedCount > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md, gap: spacing.sm }}>
                  {data.averagePerDayPaise !== null ? (
                    <View style={{ flexGrow: 1, flexBasis: 140, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md }}>
                      <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>Average per day</Text>
                      <Text style={{ ...MONEY, color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: 2 }}>{formatPaise(data.averagePerDayPaise)}</Text>
                    </View>
                  ) : null}
                  {data.summary.pendingPaise > 0 ? (
                    <View style={{ flexGrow: 1, flexBasis: 140, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md }}>
                      <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>Pending (included)</Text>
                      <Text style={{ ...MONEY, color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: 2 }}>{formatPaise(data.summary.pendingPaise)}</Text>
                    </View>
                  ) : null}
                  {data.summary.refundedCount > 0 ? (
                    <View style={{ flexGrow: 1, flexBasis: 140, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md }}>
                      <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>Refunded (not counted)</Text>
                      <Text style={{ ...MONEY, color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: 2 }}>{formatPaise(data.summary.refundedPaise)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </>,
            `sum of Paid and Pending expenses dated in this period; Refunded expenses are never counted. Average = total ÷ days elapsed so far (${data.info.elapsedDays}).${comparison ? ` The comparison is against the whole previous ${mode}${data.info.state === "in_progress" ? ", so a period still in progress will usually look lower" : ""}.` : ""}`,
          )}

          {data.summary.count === 0 ? (
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.md }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.md }}>
                <Ionicons name="bar-chart-outline" size={26} color={colors.onPrimarySoft} />
              </View>
              <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, color: colors.text, fontWeight: "700", fontSize: type.bodyLarge }}>
                No spending
              </Text>
              <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center", fontSize: type.body }}>
                {data.info.state === "future" ? "This period hasn't started yet." : "No paid or pending expenses in this period."}
              </Text>
            </Card>
          ) : (
            <>
              {card(
                "Trend",
                <>
                  <View style={{ marginBottom: spacing.md }}>
                    <SegmentedControl
                      accessibilityLabel="Trend grouping"
                      value={data.granularity}
                      onChange={(g) => setGranularity(g)}
                      segments={[
                        { value: "day", label: "Daily" },
                        { value: "week", label: "Weekly" },
                        { value: "month", label: "Monthly" },
                      ]}
                    />
                  </View>
                  {data.trend.length > 120 ? (
                    <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted }}>Too many {data.granularity}s to draw. Pick Weekly or Monthly, or see the table.</Text>
                  ) : (
                    <View accessible accessibilityLabel={`Bar chart of spending per ${data.granularity}. Highest ${formatPaise(trendMax)}. Use Show as table for every value.`}>
                      <BarChart
                        data={data.trend.map((p) => ({
                          value: p.totalPaise / 100,
                          label: p.label,
                          frontColor: p.partial ? colors.textFaint : colors.primary,
                          gradientColor: p.partial ? colors.border : colors.heroEnd,
                        }))}
                        showGradient
                        barWidth={data.trend.length > 20 ? 8 : 18}
                        spacing={data.trend.length > 20 ? 4 : 10}
                        barBorderTopLeftRadius={data.trend.length > 20 ? 3 : 6}
                        barBorderTopRightRadius={data.trend.length > 20 ? 3 : 6}
                        noOfSections={3}
                        yAxisLabelWidth={48}
                        formatYLabel={(v: string) => `₹${Math.round(Number(v)).toLocaleString("en-IN")}`}
                        yAxisTextStyle={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: 10 }}
                        xAxisLabelTextStyle={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: 9 }}
                        xAxisColor={colors.border}
                        yAxisThickness={0}
                        rulesType="dashed"
                        rulesColor={colors.divider}
                        height={160}
                        isAnimated={false}
                      />
                    </View>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.sm }}>
                    <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>Legend: </Text>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.primary, marginRight: spacing.xs }} />
                    <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption, marginRight: spacing.md }}>full {data.granularity}</Text>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.textFaint, marginRight: spacing.xs }} />
                    <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption }}>partial {data.granularity} (cut by the range or not over yet)</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowTable((v) => !v)}
                    style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: spacing.sm, opacity: pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name={showTable ? "chevron-up" : "list-outline"} size={16} color={colors.primary} style={{ marginRight: spacing.xs }} />
                    <Text style={{ fontFamily: FONT_FAMILY, color: colors.primary, fontWeight: "600", fontSize: type.body }}>{showTable ? "Hide table" : "Show as table"}</Text>
                  </Pressable>
                  {showTable
                    ? data.trend.map((p) => (
                        <View key={p.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }}>
                          <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, flex: 1, fontSize: type.small }}>
                            {p.longLabel}
                            {p.partial ? " (partial)" : ""}
                          </Text>
                          <Text style={{ ...MONEY, color: colors.text, fontSize: type.small, fontWeight: "600" }}>{formatPaise(p.totalPaise)}</Text>
                        </View>
                      ))
                    : null}
                </>,
                `each bar adds up the counted expenses in that ${data.granularity}${data.granularity === "week" ? `; weeks start on ${settings.week_start === "monday" ? "Monday" : "Sunday"} (change in Settings)` : ""}. Days with no expenses show as ₹0.`,
              )}
              {card("By category", <CategoryBreakdown shares={data.categories} totalPaise={data.summary.totalPaise} />, "each category's counted total ÷ the period total.")}
              {card(
                "By merchant",
                <>
                  {data.merchants.length ? barList(data.merchants.slice(0, 10).map((m) => ({ key: m.id, ...m }))) : <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted }}>No merchants recorded.</Text>}
                  {data.merchants.length > 10 ? <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small }}>+ {data.merchants.length - 10} more merchants</Text> : null}
                  {data.noMerchantPaise > 0 ? <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small }}>No merchant: {formatPaise(data.noMerchantPaise)}</Text> : null}
                </>,
                "counted total per merchant ÷ the period total. Expenses without a merchant are shown separately.",
              )}
              {card("By payment method", barList(data.paymentMethods.map((p) => ({ key: p.method, name: p.label, ...p }))), "counted total per payment method ÷ the period total.")}
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
