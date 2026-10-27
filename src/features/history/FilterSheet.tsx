import { ReactNode, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Chip } from "../../components/Chip";
import { DateField } from "../../components/DateTimeFields";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, STATUSES } from "../../constants/categories";
import { Category } from "../../repo/categories";
import { Merchant } from "../../repo/merchants";
import { useReducedMotion } from "../../theme/motion";
import { useTheme } from "../../theme/useTheme";
import { monthRange, monthOf, todayLocal } from "../../utils/date";
import { DATE_PRESET_LABELS, DatePreset, DEFAULT_FILTERS, HistoryFilters, SORT_LABELS, SortOption, toggleValue } from "./filters";
import { FONT_FAMILY } from "../../theme/tokens";

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
  const { colors, spacing, type } = useTheme();
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
    <Text
      accessibilityRole="header"
      style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs }}
    >
      {title}
    </Text>
  );
  const group = (children: ReactNode) => <Card style={{ paddingBottom: spacing.lg - spacing.sm }}>{children}</Card>;

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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.title + 2, fontWeight: "800", letterSpacing: -0.4 }}>
            Filter & sort
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={props.onClose}
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          {section("Sort by")}
          {group(
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((s) => (
                <Chip key={s} label={SORT_LABELS[s]} selected={draft.sort === s} onPress={() => update({ sort: s })} />
              ))}
            </View>,
          )}

          {section("Date")}
          {group(
            <>
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
                <View style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
                  <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, fontWeight: "500", marginBottom: spacing.xs }}>From</Text>
                  <DateField value={custom.start} onChange={(d) => setCustom(d, custom.end)} />
                  <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, fontWeight: "500", marginTop: spacing.md, marginBottom: spacing.xs }}>To</Text>
                  <DateField value={custom.end} onChange={(d) => setCustom(custom.start, d)} />
                </View>
              ) : null}
            </>,
          )}

          {section("Category")}
          {group(
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
            </View>,
          )}

          {section("Merchant")}
          {group(
            props.merchants.length === 0 ? (
              <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, marginBottom: spacing.sm }}>No merchants yet. They appear here after you add one to an expense.</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {props.merchants.map((m) => (
                  <Chip key={m.id} role="checkbox" label={m.name} selected={draft.merchantIds.includes(m.id)} onPress={() => update({ merchantIds: toggleValue(draft.merchantIds, m.id) })} />
                ))}
              </View>
            ),
          )}

          {section("Payment method")}
          {group(
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {PAYMENT_METHODS.map((p) => (
                <Chip key={p} role="checkbox" label={PAYMENT_METHOD_LABELS[p]} selected={draft.paymentMethods.includes(p)} onPress={() => update({ paymentMethods: toggleValue(draft.paymentMethods, p) })} />
              ))}
            </View>,
          )}

          {section("Status")}
          {group(
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {STATUSES.map((s) => (
                <Chip key={s} role="checkbox" label={STATUS_LABELS[s]} selected={draft.statuses.includes(s)} onPress={() => update({ statuses: toggleValue(draft.statuses, s) })} />
              ))}
            </View>,
          )}
        </ScrollView>
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md + insets.bottom,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Button variant="secondary" label="Reset" onPress={() => setDraft({ ...DEFAULT_FILTERS, search: draft.search })} style={{ paddingHorizontal: spacing.lg }} />
          <Button label="Show results" onPress={() => props.onApply(draft)} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}
