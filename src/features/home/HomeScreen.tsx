import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BudgetBar } from "../../components/BudgetBar";
import { EmptyState } from "../../components/EmptyState";
import { Fab } from "../../components/Fab";
import { TransactionRow } from "../../components/TransactionRow";
import { useRepositories } from "../../db/DatabaseProvider";
import { useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { addMonths, monthLabel, monthOf, todayLocal, YearMonth } from "../../utils/date";
import { formatPaise } from "../../utils/money";
import { CategoryBreakdown } from "../dashboard/CategoryBreakdown";
import { DashboardData, loadDashboard } from "../dashboard/loadDashboard";
import { DueSoon } from "../recurring/DueSoon";

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

  const card = (children: ReactNode, title?: string, action?: ReactNode) => (
    <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      {title ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>{title}</Text>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
      <Text style={{ color: colors.primary, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
  const stat = (label: string, value: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.textMuted, fontSize: type.caption }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: 2 }}>{value}</Text>
    </View>
  );

  let content: ReactNode;
  if (error) {
    content = <EmptyState icon="alert-circle-outline" title="Could not load" message="Please reopen the app." />;
  } else if (!shown) {
    content = <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />;
  } else if (shown.totalEver === 0) {
    content = (
      <EmptyState
        icon="wallet-outline"
        title="Welcome to Meow"
        message="Your spending summary, category chart and budgets will appear here. Start by adding your first expense."
        actionLabel="Add your first expense"
        onAction={() => router.push("/expense/new")}
      />
    );
  } else {
    const d = shown;
    content = (
      <>
        {card(
          <>
            <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "600" }}>Spent in {monthLabel(month)}</Text>
            <Text style={{ color: colors.text, fontSize: type.display, fontWeight: "700", marginTop: spacing.xs }}>{formatPaise(d.summary.totalPaise)}</Text>
            {d.summary.pendingCount ? (
              <Text style={{ color: colors.warning, fontSize: type.small, marginTop: 2 }}>Includes {formatPaise(d.summary.pendingPaise)} pending</Text>
            ) : null}
            <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>{d.comparison.label}</Text>
            <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
              {stat("Expenses", String(d.summary.count))}
              {stat(d.average.label, d.average.averagePaise === null ? "-" : formatPaise(d.average.averagePaise))}
            </View>
            <View style={{ flexDirection: "row", marginTop: spacing.md }}>
              {stat(isCurrent ? `${month.year} so far` : `Total in ${month.year}`, formatPaise(d.yearTotalPaise))}
              {stat("Refunded (not counted)", d.summary.refundedCount ? formatPaise(d.summary.refundedPaise) : "None")}
            </View>
          </>,
        )}

        {d.budgets.length > 0
          ? card(
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
              )),
              "Budgets",
              link("Manage", () => router.push("/settings/budgets")),
            )
          : card(
              <Text style={{ color: colors.textMuted, fontSize: type.body }}>Set a monthly budget to see how much is left.</Text>,
              "Budgets",
              link("Set up", () => router.push("/settings/budgets")),
            )}

        {card(
          d.categories.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: type.body }}>No spending in {monthLabel(month)}.</Text>
          ) : (
            <>
              <Text style={{ color: colors.textMuted, fontSize: type.small }}>
                Top: {d.categories.slice(0, 3).map((c) => c.name).join(", ")}
              </Text>
              <CategoryBreakdown shares={d.categories} totalPaise={d.summary.totalPaise} />
            </>
          ),
          "Spending by category",
        )}

        {card(
          d.recent.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: type.body }}>No expenses in {monthLabel(month)}.</Text>
          ) : (
            <View style={{ marginHorizontal: -spacing.lg }}>
              {d.recent.map((t) => (
                <TransactionRow key={t.id} transaction={t} onPress={open} />
              ))}
            </View>
          ),
          `Recent in ${monthLabel(month)}`,
          link("See all", () => router.navigate("/history")),
        )}
      </>
    );
  }

  const arrow = (dir: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? `Previous month, ${monthLabel(addMonths(month, -1))}` : `Next month, ${monthLabel(addMonths(month, 1))}`}
      onPress={() => setMonth((m) => addMonths(m, dir))}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={dir < 0 ? "chevron-back" : "chevron-forward"} size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 112 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", flex: 1 }}>Meow</Text>
          {arrow(-1)}
          <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700", minWidth: 80, textAlign: "center" }}>{monthLabel(month)}</Text>
          {arrow(1)}
        </View>
        {!isCurrent ? (
          <Pressable accessibilityRole="button" onPress={() => setMonth(monthOf(today))} style={{ alignSelf: "flex-end", marginRight: spacing.lg, marginBottom: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Back to this month</Text>
          </Pressable>
        ) : null}
        <DueSoon today={today} />
        {content}
      </ScrollView>
      <Fab onPress={() => router.push("/expense/new")} />
    </View>
  );
}
