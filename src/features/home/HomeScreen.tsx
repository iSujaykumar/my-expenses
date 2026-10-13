import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { Fab } from "../../components/Fab";
import { TransactionRow } from "../../components/TransactionRow";
import { useRepositories } from "../../db/DatabaseProvider";
import { SpendingSummary, TransactionWithDetails } from "../../repo/transactions";
import { useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { compareWithPreviousMonth, monthLabel, monthOf, monthRange, previousMonth, todayLocal } from "../../utils/date";
import { formatPaise } from "../../utils/money";

interface HomeData {
  month: SpendingSummary;
  previousTotal: number;
  recent: TransactionWithDetails[];
  totalEver: number;
}

export function HomeScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, type } = useTheme();
  const dataVersion = useDataVersion();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState(false);
  const today = todayLocal();
  const ym = monthOf(today);

  useEffect(() => {
    let cancelled = false;
    const prev = previousMonth(ym);
    Promise.all([
      repos.transactions.summary({ range: monthRange(ym.year, ym.month) }),
      repos.transactions.totalSpending(monthRange(prev.year, prev.month)),
      repos.transactions.list({ limit: 5, sort: "date_desc" }),
      repos.transactions.count(),
    ])
      .then(([month, previousTotal, recent, totalEver]) => {
        if (!cancelled) {
          setData({ month, previousTotal, recent, totalEver });
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // ym is derived from today; re-run when the day changes or data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, dataVersion, today]);

  const open = useCallback((id: string) => router.push({ pathname: "/expense/[id]", params: { id } }), [router]);
  const comparison = data ? compareWithPreviousMonth(ym, data.month.totalPaise, data.previousTotal) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: 112 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          Meow
        </Text>
        {error ? (
          <EmptyState icon="alert-circle-outline" title="Could not load" message="Please reopen the app." />
        ) : !data ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />
        ) : (
          <>
            <View style={{ marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "600" }}>Spent in {monthLabel(ym)}</Text>
              <Text style={{ color: colors.text, fontSize: type.display, fontWeight: "700", marginTop: spacing.xs }}>{formatPaise(data.month.totalPaise)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>
                {data.month.count} {data.month.count === 1 ? "expense" : "expenses"}
                {data.month.pendingCount ? ` · ${formatPaise(data.month.pendingPaise)} pending` : ""}
              </Text>
              {comparison && data.totalEver > 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs }}>{comparison.label}</Text>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>Recent</Text>
              {data.totalEver > 0 ? (
                <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.navigate("/history")}>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>See all</Text>
                </Pressable>
              ) : null}
            </View>
            {data.recent.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No expenses yet" message="Tap “Add expense” to record your first one." />
            ) : (
              data.recent.map((t) => <TransactionRow key={t.id} transaction={t} onPress={open} />)
            )}
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push("/expense/new")} />
    </View>
  );
}
