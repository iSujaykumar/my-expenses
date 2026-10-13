import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "../../components/Chip";
import { DateField } from "../../components/DateTimeFields";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, STATUSES } from "../../constants/categories";
import { Category } from "../../repo/categories";
import { Merchant } from "../../repo/merchants";
import { useReducedMotion } from "../../theme/motion";
import { useTheme } from "../../theme/useTheme";
import { monthRange, monthOf, todayLocal } from "../../utils/date";
import { DATE_PRESET_LABELS, DatePreset, DEFAULT_FILTERS, HistoryFilters, SORT_LABELS, SortOption, toggleValue } from "./filters";

const STATUS_LABELS = { paid: "Paid", pending: "Pending", refunded: "Refunded" } as const;

/** Full-screen filter + sort sheet. Changes apply only when "Show results" is pressed. */
export function FilterSheet(props: {
  visible: boolean;
  filters: HistoryFilters;
  categories: Category[];
  merchants: Merchant[];
  onApply: (filters: HistoryFilters) => void;
  onClose: () => void;
}) {
  const { colors, spacing, radii, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<HistoryFilters>(props.filters);
  const [openedWith, setOpenedWith] = useState<HistoryFilters>(props.filters);

  // Reset the draft whenever the sheet is reopened with different filters.
  if (props.filters !== openedWith) {
    setOpenedWith(props.filters);
    setDraft(props.filters);
  }

  const update = (patch: Partial<HistoryFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const section = (title: string) => (
    <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm }}>{title}</Text>
  );

  const today = todayLocal();
  const defaultCustom = (() => {
    const m = monthOf(today);
    return { start: monthRange(m.year, m.month).start, end: today };
  })();
  const custom = draft.customRange ?? defaultCustom;
  const setCustom = (start: string, end: string) => update({ customRange: start <= end ? { start, end } : { start: end, end: start } });

  return (
    <Modal visible={props.visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.title, fontWeight: "700" }}>Filter & sort</Text>
          <Pressable accessibilityRole="button" onPress={props.onClose} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: type.body }}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          {section("Sort by")}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
              <Chip key={s} label={SORT_LABELS[s]} selected={draft.sort === s} onPress={() => update({ sort: s })} />
            ))}
          </View>

          {section("Date")}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => (
              <Chip
                key={p}
                label={DATE_PRESET_LABELS[p]}
                selected={draft.datePreset === p}
                onPress={() => update({ datePreset: p, customRange: p === "custom" ? custom : draft.customRange })}
              />
            ))}
          </View>
          {draft.datePreset === "custom" ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={{ color: colors.textMuted, marginBottom: spacing.xs }}>From</Text>
              <DateField value={custom.start} onChange={(d) => setCustom(d, custom.end)} />
              <Text style={{ color: colors.textMuted, marginVertical: spacing.xs }}>To</Text>
              <DateField value={custom.end} onChange={(d) => setCustom(custom.start, d)} />
            </View>
          ) : null}

          {section("Category")}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {props.categories.map((c) => (
              <Chip
                key={c.id}
                role="checkbox"
                label={c.isArchived ? `${c.name} (archived)` : c.name}
                color={c.color}
                selected={draft.categoryIds.includes(c.id)}
                onPress={() => update({ categoryIds: toggleValue(draft.categoryIds, c.id) })}
              />
            ))}
          </View>

          {section("Merchant")}
          {props.merchants.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No merchants yet. They appear here after you add one to an expense.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {props.merchants.map((m) => (
                <Chip key={m.id} role="checkbox" label={m.name} selected={draft.merchantIds.includes(m.id)} onPress={() => update({ merchantIds: toggleValue(draft.merchantIds, m.id) })} />
              ))}
            </View>
          )}

          {section("Payment method")}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map((p) => (
              <Chip key={p} role="checkbox" label={PAYMENT_METHOD_LABELS[p]} selected={draft.paymentMethods.includes(p)} onPress={() => update({ paymentMethods: toggleValue(draft.paymentMethods, p) })} />
            ))}
          </View>

          {section("Status")}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <Chip key={s} role="checkbox" label={STATUS_LABELS[s]} selected={draft.statuses.includes(s)} onPress={() => update({ statuses: toggleValue(draft.statuses, s) })} />
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: "row", padding: spacing.md, paddingBottom: spacing.md + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDraft({ ...DEFAULT_FILTERS, search: draft.search })}
            style={{ height: 52, paddingHorizontal: spacing.lg, justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.md }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => props.onApply(draft)}
            style={{ flex: 1, height: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.primary }}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: type.bodyLarge }}>Show results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
