import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "../../components/Chip";
import { useRepositories } from "../../db/DatabaseProvider";
import { useAppSettings, useFormatDate } from "../../state/AppSettings";
import { subscribeDataChanged } from "../../state/dataEvents";
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

  const card = (title: string, children: React.ReactNode, how?: string) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "700", fontSize: type.bodyLarge, marginBottom: spacing.sm }}>{title}</Text>
      {children}
      {how ? <Text style={{ color: colors.textMuted, fontSize: type.caption, marginTop: spacing.sm }}>How this is calculated: {how}</Text> : null}
    </View>
  );

  const barList = (rows: { key: string; name: string; totalPaise: number; count: number; percent: number }[]) => {
    const max = Math.max(1, ...rows.map((r) => r.totalPaise));
    return rows.map((r) => (
      <View key={r.key} accessible accessibilityLabel={`${r.name}: ${formatPaise(r.totalPaise)}, ${r.percent}% of spending, ${r.count} ${r.count === 1 ? "expense" : "expenses"}`} style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>{r.name}</Text>
          <Text style={{ color: colors.text, fontWeight: "600" }}>{formatPaise(r.totalPaise)} · {r.percent}%</Text>
        </View>
        <View style={{ height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, marginTop: 4 }}>
          <View style={{ height: 6, width: `${(r.totalPaise / max) * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
        </View>
      </View>
    ));
  };

  const trendMax = data ? Math.max(0, ...data.trend.map((p) => p.totalPaise)) : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", marginBottom: spacing.md }}>Reports</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md }}>
        {(["month", "year", "custom"] as const).map((m) => (
          <Chip key={m} label={m === "month" ? "Month" : m === "year" ? "Year" : "Custom range"} selected={mode === m} onPress={() => { setMode(m); setGranularity(undefined); }} />
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
        {mode !== "custom" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Previous period" onPress={() => step(-1)} hitSlop={12} style={{ padding: spacing.sm }}>
            <Text style={{ color: colors.primary, fontSize: type.bodyLarge, fontWeight: "700" }}>‹</Text>
          </Pressable>
        ) : null}
        {mode === "custom" ? (
          <View style={{ flexDirection: "row", flex: 1, gap: spacing.sm }}>
            {(["start", "end"] as const).map((w) => (
              <Pressable key={w} accessibilityRole="button" accessibilityLabel={`${w === "start" ? "From" : "To"} ${formatDate(custom[w])}. Change`} onPress={() => pickDate(w)} style={{ flex: 1, minHeight: 48, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface }}>
                <Text style={{ color: colors.textMuted, fontSize: type.caption }}>{w === "start" ? "From" : "To"}</Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{formatDate(custom[w])}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>{periodTitle}</Text>
        )}
        {mode !== "custom" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Next period" accessibilityState={{ disabled: !canNext }} disabled={!canNext} onPress={() => step(1)} hitSlop={12} style={{ padding: spacing.sm, opacity: canNext ? 1 : 0.3 }}>
            <Text style={{ color: colors.primary, fontSize: type.bodyLarge, fontWeight: "700" }}>›</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={{ color: colors.danger, marginBottom: spacing.md }}>Could not load this report.</Text> : null}
      {data ? (
        <>
          {card(
            "Total spent",
            <>
              <Text accessibilityLabel={`Total spent ${formatPaise(data.summary.totalPaise)}`} style={{ color: colors.text, fontSize: type.display ?? 32, fontWeight: "700" }}>{formatPaise(data.summary.totalPaise)}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 2 }}>{data.summary.count} {data.summary.count === 1 ? "expense" : "expenses"} · {data.info.note}</Text>
              {data.summary.pendingPaise > 0 ? <Text style={{ color: colors.textMuted, fontSize: type.small }}>Includes {formatPaise(data.summary.pendingPaise)} pending</Text> : null}
              {data.summary.refundedCount > 0 ? <Text style={{ color: colors.textMuted, fontSize: type.small }}>{formatPaise(data.summary.refundedPaise)} refunded (not counted)</Text> : null}
              {data.averagePerDayPaise !== null ? (
                <Text style={{ color: colors.text, marginTop: spacing.sm }}>Average {formatPaise(data.averagePerDayPaise)} per day</Text>
              ) : null}
              {comparison ? (
                <Text style={{ color: colors.text, marginTop: spacing.xs }}>{comparison.label}{comparison.previousPaise > 0 ? ` (${formatPaise(comparison.previousPaise)})` : ""}</Text>
              ) : null}
            </>,
            `sum of Paid and Pending expenses dated in this period; Refunded expenses are never counted. Average = total ÷ days elapsed so far (${data.info.elapsedDays}).${comparison ? ` The comparison is against the whole previous ${mode}${data.info.state === "in_progress" ? ", so a period still in progress will usually look lower" : ""}.` : ""}`,
          )}

          {data.summary.count === 0 ? (
            card("No spending", <Text style={{ color: colors.textMuted }}>{data.info.state === "future" ? "This period hasn't started yet." : "No paid or pending expenses in this period."}</Text>)
          ) : (
            <>
              {card(
                "Trend",
                <>
                  <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.sm }}>
                    {(["day", "week", "month"] as const).map((g) => (
                      <Chip key={g} label={g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"} selected={data.granularity === g} onPress={() => setGranularity(g)} />
                    ))}
                  </View>
                  {data.trend.length > 120 ? (
                    <Text style={{ color: colors.textMuted }}>Too many {data.granularity}s to draw. Pick Weekly or Monthly, or see the table.</Text>
                  ) : (
                    <View accessible accessibilityLabel={`Bar chart of spending per ${data.granularity}. Highest ${formatPaise(trendMax)}. Use Show as table for every value.`}>
                      <BarChart
                        data={data.trend.map((p) => ({ value: p.totalPaise / 100, label: p.label, frontColor: p.partial ? colors.textMuted : colors.primary }))}
                        barWidth={data.trend.length > 20 ? 8 : 18}
                        spacing={data.trend.length > 20 ? 4 : 10}
                        noOfSections={3}
                        yAxisLabelWidth={48}
                        formatYLabel={(v: string) => `₹${Math.round(Number(v)).toLocaleString("en-IN")}`}
                        yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
                        xAxisColor={colors.border}
                        yAxisColor={colors.border}
                        rulesColor={colors.border}
                        height={160}
                        isAnimated={false}
                      />
                    </View>
                  )}
                  <Text style={{ color: colors.textMuted, fontSize: type.caption, marginTop: spacing.xs }}>
                    Legend: <Text style={{ color: colors.primary }}>■</Text> full {data.granularity}  <Text style={{ color: colors.textMuted }}>■</Text> partial {data.granularity} (cut by the range or not over yet)
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => setShowTable((v) => !v)} style={{ minHeight: 44, justifyContent: "center" }}>
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>{showTable ? "Hide table" : "Show as table"}</Text>
                  </Pressable>
                  {showTable
                    ? data.trend.map((p) => (
                        <View key={p.key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ color: colors.text, flex: 1 }}>{p.longLabel}{p.partial ? " (partial)" : ""}</Text>
                          <Text style={{ color: colors.text }}>{formatPaise(p.totalPaise)}</Text>
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
                  {data.merchants.length ? barList(data.merchants.slice(0, 10).map((m) => ({ key: m.id, ...m }))) : <Text style={{ color: colors.textMuted }}>No merchants recorded.</Text>}
                  {data.merchants.length > 10 ? <Text style={{ color: colors.textMuted, fontSize: type.small }}>+ {data.merchants.length - 10} more merchants</Text> : null}
                  {data.noMerchantPaise > 0 ? <Text style={{ color: colors.textMuted, fontSize: type.small }}>No merchant: {formatPaise(data.noMerchantPaise)}</Text> : null}
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
