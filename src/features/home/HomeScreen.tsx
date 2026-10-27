import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BudgetBar } from "../../components/BudgetBar";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { IconTile } from "../../components/IconTile";
import { PeriodSwitcher } from "../../components/PeriodSwitcher";
import { ProgressRing } from "../../components/ProgressRing";
import { SectionHeader } from "../../components/SectionHeader";
import { TransactionRow } from "../../components/TransactionRow";
import { useRepositories } from "../../db/DatabaseProvider";
import { useDataVersion } from "../../state/dataEvents";
import { MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { addMonths, monthLabel, monthOf, todayLocal, YearMonth } from "../../utils/date";
import { formatPaise } from "../../utils/money";
import { CategoryBreakdown } from "../dashboard/CategoryBreakdown";
import { DashboardData, loadDashboard } from "../dashboard/loadDashboard";
import { DueSoon } from "../recurring/DueSoon";

function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, type } = useTheme();
  const dataVersion = useDataVersion();
  const today = todayLocal();
  const [month, setMonth] = useState<YearMonth>(() => monthOf(todayLocal()));
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDashboard(repos, month, today)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repos, month, today, dataVersion]);

  const open = useCallback((id: string) => router.push({ pathname: "/expense/[id]", params: { id } }), [router]);
  const isCurrent = month.year === monthOf(today).year && month.month === monthOf(today).month;
  const shown = data && data.month.year === month.year && data.month.month === month.month ? data : null;

  const section = (children: ReactNode) => <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.xl }}>{children}</View>;

  const stat = (icon: string, tint: string, label: string, value: string) => (
    <Card style={{ flex: 1, padding: spacing.md + 2 }}>
      <View accessible accessibilityLabel={`${label}: ${value}`}>
        <IconTile icon={icon} color={tint} size={32} />
        <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: type.caption, marginTop: spacing.sm + 2 }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...MONEY, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", marginTop: 2, letterSpacing: -0.3 }}>
          {value}
        </Text>
      </View>
    </Card>
  );

  let content: ReactNode;
  if (error) {
    content = <EmptyState icon="alert-circle-outline" title="Could not load" message="Please reopen the app." />;
  } else if (!shown) {
    content = <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />;
  } else if (shown.totalEver === 0) {
    content = (
      <Card style={{ marginHorizontal: spacing.lg }}>
        <EmptyState
          icon="wallet-outline"
          title="Welcome to Meow"
          message="Your spending summary, category chart and budgets will appear here. Start by adding your first expense."
          actionLabel="Add your first expense"
          onAction={() => router.push("/expense/new")}
        />
      </Card>
    );
  } else {
    const d = shown;
    const overall = d.budgets.find((b) => b.budget.scope === "overall");
    const trendIcon = d.comparison.direction === "up" ? "trending-up" : d.comparison.direction === "down" ? "trending-down" : "remove";
    const ringColor = overall?.level === "over" ? "#FFB4AB" : overall?.level === "warning" ? "#FFD08A" : colors.onHero;

    content = (
      <>
        {section(
          <LinearGradient
            colors={[colors.heroStart, colors.heroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radii.xl, padding: spacing.xl - 4, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }} accessible accessibilityLabel={`Spent in ${monthLabel(month)}: ${formatPaise(d.summary.totalPaise)}. ${d.comparison.label}`}>
                <Text style={{ color: colors.onHeroMuted, fontSize: type.small, fontWeight: "500" }}>Spent in {monthLabel(month)}</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ ...MONEY, color: colors.onHero, fontSize: type.hero, fontWeight: "700", letterSpacing: -1.2, marginTop: spacing.xs }}
                >
                  {formatPaise(d.summary.totalPaise)}
                </Text>
                <View style={{ flexDirection: "row", marginTop: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.heroChip, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 1 }}>
                    <Ionicons name={trendIcon} size={14} color={colors.onHero} style={{ marginRight: spacing.xs }} />
                    <Text style={{ ...MONEY, color: colors.onHero, fontSize: type.caption, fontWeight: "600" }}>{d.comparison.label}</Text>
                  </View>
                </View>
              </View>
              {overall ? (
                <View
                  accessible
                  accessibilityLabel={`Overall budget ${overall.percentUsed}% used`}
                  style={{ marginLeft: spacing.md, alignItems: "center" }}
                >
                  <ProgressRing size={76} stroke={7} progress={overall.percentUsed / 100} color={ringColor} track={colors.heroChip}>
                    <Text style={{ ...MONEY, color: colors.onHero, fontSize: type.body, fontWeight: "700" }}>{overall.percentUsed}%</Text>
                    <Text style={{ color: colors.onHeroMuted, fontSize: 10, fontWeight: "500" }}>budget</Text>
                  </ProgressRing>
                </View>
              ) : null}
            </View>
            {d.summary.pendingCount || overall ? (
              <View style={{ marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.heroChip, gap: spacing.xs }}>
                {overall ? (
                  <Text style={{ ...MONEY, color: colors.onHeroMuted, fontSize: type.small }}>
                    {overall.spentPaise <= overall.budget.monthlyAmountPaise
                      ? `${formatPaise(overall.budget.monthlyAmountPaise - overall.spentPaise)} left of ${formatPaise(overall.budget.monthlyAmountPaise)}`
                      : `Over budget by ${formatPaise(overall.spentPaise - overall.budget.monthlyAmountPaise)}`}
                  </Text>
                ) : null}
                {d.summary.pendingCount ? (
                  <Text style={{ ...MONEY, color: colors.onHeroMuted, fontSize: type.small }}>Includes {formatPaise(d.summary.pendingPaise)} pending</Text>
                ) : null}
              </View>
            ) : null}
          </LinearGradient>,
        )}

        {section(
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {stat("receipt-outline", colors.primary, "Expenses", String(d.summary.count))}
              {stat("calendar-outline", "#3B7DD8", d.average.label, d.average.averagePaise === null ? "-" : formatPaise(d.average.averagePaise))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {stat("stats-chart-outline", "#7B5CD6", isCurrent ? `${month.year} so far` : `Total in ${month.year}`, formatPaise(d.yearTotalPaise))}
              {stat("return-down-back-outline", "#E07A2F", "Refunded (not counted)", d.summary.refundedCount ? formatPaise(d.summary.refundedPaise) : "None")}
            </View>
          </View>,
        )}

        <DueSoon today={today} />

        {section(
          <>
            <SectionHeader
              title="Budgets"
              actionLabel={d.budgets.length > 0 ? "Manage" : "Set up"}
              actionAccessibilityLabel={d.budgets.length > 0 ? "Manage budgets" : "Set up a budget"}
              onAction={() => router.push("/settings/budgets")}
            />
            <Card>
              {d.budgets.length > 0 ? (
                d.budgets.map((b) => (
                  <BudgetBar
                    key={b.budget.id}
                    title={b.budget.scope === "overall" ? "Overall" : (b.categoryName ?? "Category")}
                    color={b.categoryColor}
                    spentPaise={b.spentPaise}
                    budgetPaise={b.budget.monthlyAmountPaise}
                    percentUsed={b.percentUsed}
                    level={b.level}
                  />
                ))
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconTile icon="flag-outline" color={colors.primary} size={36} />
                  <Text style={{ color: colors.textMuted, fontSize: type.body, flex: 1, marginLeft: spacing.md }}>Set a monthly budget to see how much is left.</Text>
                </View>
              )}
            </Card>
          </>,
        )}

        {section(
          <>
            <SectionHeader title="Spending by category" />
            <Card>
              {d.categories.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: type.body }}>No spending in {monthLabel(month)}.</Text>
              ) : (
                <CategoryBreakdown shares={d.categories} totalPaise={d.summary.totalPaise} />
              )}
            </Card>
          </>,
        )}

        {section(
          <>
            <SectionHeader title={`Recent in ${monthLabel(month)}`} actionLabel="See all" actionAccessibilityLabel="See all expenses" onAction={() => router.navigate("/history")} />
            <Card padded={false} style={{ overflow: "hidden" }}>
              {d.recent.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: type.body, padding: spacing.lg }}>No expenses in {monthLabel(month)}.</Text>
              ) : (
                d.recent.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg + 42 + spacing.md }} /> : null}
                    <TransactionRow transaction={t} onPress={open} />
                  </View>
                ))
              )}
            </Card>
          </>,
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "500" }}>{greeting(new Date().getHours())}</Text>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "800", letterSpacing: -0.8, marginTop: 2 }}>
              Meow
            </Text>
          </View>
          {!isCurrent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to this month"
              onPress={() => setMonth(monthOf(today))}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: pressed ? colors.primarySoft : colors.surface, borderWidth: 1, borderColor: colors.border })}
            >
              <Ionicons name="today-outline" size={16} color={colors.primary} style={{ marginRight: spacing.xs }} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: type.small }}>Back to this month</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <PeriodSwitcher
            label={monthLabel(month)}
            onPrevious={() => setMonth((m) => addMonths(m, -1))}
            onNext={() => setMonth((m) => addMonths(m, 1))}
            previousAccessibilityLabel={`Previous month, ${monthLabel(addMonths(month, -1))}`}
            nextAccessibilityLabel={`Next month, ${monthLabel(addMonths(month, 1))}`}
          />
        </View>
        {content}
      </ScrollView>
    </View>
  );
}
