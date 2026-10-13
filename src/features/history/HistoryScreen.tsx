import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "../../components/EmptyState";
import { Fab } from "../../components/Fab";
import { TransactionRow } from "../../components/TransactionRow";
import { useRepositories } from "../../db/DatabaseProvider";
import { Category } from "../../repo/categories";
import { Merchant } from "../../repo/merchants";
import { MAX_LIST_LIMIT, SpendingSummary, TransactionWithDetails } from "../../repo/transactions";
import { useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { todayLocal } from "../../utils/date";
import { formatPaise } from "../../utils/money";
import { FilterSheet } from "./FilterSheet";
import { activeFilterCount, DEFAULT_FILTERS, hasAnyFilter, HistoryFilters, SORT_LABELS, toTransactionFilter } from "./filters";
import { groupByDate, HistoryItem, ungrouped } from "./grouping";

type Item = HistoryItem<TransactionWithDetails>;

export function HistoryScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, type } = useTheme();
  const dataVersion = useDataVersion();

  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [searchText, setSearchText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rows, setRows] = useState<TransactionWithDetails[] | null>(null);
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [totalEver, setTotalEver] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Debounce typing into the search box.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText })), 250);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    let cancelled = false;
    const query = toTransactionFilter(filters, todayLocal());
    Promise.all([
      repos.transactions.list({ ...query, limit: MAX_LIST_LIMIT }),
      repos.transactions.summary(query),
      repos.transactions.count(),
      repos.categories.list({ includeArchived: true }),
      repos.merchants.list(),
    ])
      .then(([list, sum, all, cats, mers]) => {
        if (cancelled) return;
        setRows(list);
        setSummary(sum);
        setTotalEver(all);
        setCategories(cats);
        setMerchants(mers);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, dataVersion, repos]);

  const items: Item[] = useMemo(() => {
    if (!rows) return [];
    const byDate = filters.sort === "date_desc" || filters.sort === "date_asc";
    return byDate ? groupByDate(rows, todayLocal()) : ungrouped(rows);
  }, [rows, filters.sort]);

  const openExpense = useCallback((id: string) => router.push({ pathname: "/expense/[id]", params: { id } }), [router]);
  const clearAll = () => {
    setSearchText("");
    setFilters(DEFAULT_FILTERS);
  };

  const filterCount = activeFilterCount(filters);
  const filtered = hasAnyFilter({ ...filters, search: searchText });

  const renderItem = useCallback(
    ({ item }: { item: Item }) =>
      item.type === "header" ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs, backgroundColor: colors.background }}>
          <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "700" }}>{item.label}</Text>
          <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "700" }}>{formatPaise(item.dayTotalPaise)}</Text>
        </View>
      ) : (
        <TransactionRow transaction={item.transaction} onPress={openExpense} />
      ),
    [colors, spacing, type, openExpense],
  );

  const header = (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.background }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.headline, fontWeight: "700", marginBottom: spacing.md }}>History</Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md }}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search expenses"
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search description, merchant, notes"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, marginLeft: spacing.sm, color: colors.text, fontSize: type.body }}
            returnKeyType="search"
          />
          {searchText ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter and sort${filterCount ? `, ${filterCount} active` : ""}`}
          onPress={() => setSheetOpen(true)}
          style={{ height: 48, marginLeft: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: filterCount ? colors.primary : colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center" }}
        >
          <Ionicons name="options-outline" size={20} color={filterCount ? colors.primary : colors.text} />
          {filterCount ? <Text style={{ color: colors.primary, fontWeight: "700", marginLeft: spacing.xs }}>{filterCount}</Text> : null}
        </Pressable>
      </View>
      {rows && summary && totalEver ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "600" }}>
              {rows.length} {rows.length === 1 ? "expense" : "expenses"} · {formatPaise(summary.totalPaise)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: type.caption }}>
              {SORT_LABELS[filters.sort]}
              {summary.refundedCount ? ` · ${summary.refundedCount} refunded not counted` : ""}
            </Text>
          </View>
          {filtered ? (
            <Pressable accessibilityRole="button" onPress={clearAll} hitSlop={10}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  let body;
  if (loadError) {
    body = <EmptyState icon="alert-circle-outline" title="Could not load history" message="Please try again." actionLabel="Try again" onAction={() => setFilters({ ...filters })} />;
  } else if (!rows || totalEver === null) {
    body = <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />;
  } else if (totalEver === 0) {
    body = <EmptyState icon="receipt-outline" title="No expenses yet" message="Tap “Add expense” to record your first one." />;
  } else if (rows.length === 0) {
    body = <EmptyState icon="search-outline" title="No matching expenses" message="Try a different search or clear the filters." actionLabel="Clear filters" onAction={clearAll} />;
  } else {
    body = (
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 96 }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <View style={{ flex: 1 }}>{body}</View>
      <Fab onPress={() => router.push("/expense/new")} />
      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        categories={categories}
        merchants={merchants}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}
