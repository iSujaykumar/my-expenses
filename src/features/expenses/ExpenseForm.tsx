import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Chip } from "../../components/Chip";
import { DateField, TimeField } from "../../components/DateTimeFields";
import { FormField } from "../../components/FormField";
import { IconTile } from "../../components/IconTile";
import { useInputStyle } from "../../components/inputStyle";
import { SegmentedControl } from "../../components/SegmentedControl";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PaymentMethod, STATUSES } from "../../constants/categories";
import { ValidationError } from "../../db/types";
import { Category } from "../../repo/categories";
import { categoryColor, MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { hapticSuccess } from "../../utils/haptics";
import { ExpenseFormErrors, ExpenseFormValues, validateExpenseForm, ValidatedExpense } from "./form";

const STATUS_LABELS = { paid: "Paid", pending: "Pending", refunded: "Refunded" } as const;
const STATUS_HINTS = {
  paid: "Counts as spending.",
  pending: "Counts as spending, marked “Pending”.",
  refunded: "Does not count as spending anywhere.",
} as const;

const PAYMENT_ICONS: Record<PaymentMethod, ComponentProps<typeof Ionicons>["name"]> = {
  cash: "cash-outline",
  upi: "phone-portrait-outline",
  debit_card: "card-outline",
  credit_card: "card",
  bank_transfer: "business-outline",
  other: "ellipsis-horizontal",
};

const FIELD_MAP: Record<string, keyof ExpenseFormValues> = {
  amountPaise: "amount",
  merchant: "merchantName",
  merchantId: "merchantName",
  categoryId: "categoryId",
  date: "date",
  time: "time",
  paymentMethod: "paymentMethod",
  status: "status",
  description: "description",
  notes: "notes",
};

export interface ExpenseFormProps {
  initialValues: ExpenseFormValues;
  /** Active categories, plus the expense's own archived category when editing. */
  categories: Category[];
  /** Recently used merchant names, most recent first. */
  recentMerchants: string[];
  submitLabel: string;
  onSubmit: (value: ValidatedExpense) => Promise<void>;
  onDelete?: () => void;
  onValuesChange?: (values: ExpenseFormValues) => void;
}

export function ExpenseForm(props: ExpenseFormProps) {
  const { colors, spacing, radii, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<ExpenseFormValues>(props.initialValues);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [merchantFocused, setMerchantFocused] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const set = <K extends keyof ExpenseFormValues>(key: K, value: ExpenseFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    props.onValuesChange?.(next);
    if (submitted) {
      const r = validateExpenseForm(next);
      setErrors(r.ok ? {} : r.errors);
    }
  };

  const suggestions = useMemo(() => {
    const q = values.merchantName.trim().toLowerCase();
    return props.recentMerchants.filter((m) => m.toLowerCase() !== q && (!q || m.toLowerCase().includes(q))).slice(0, 6);
  }, [values.merchantName, props.recentMerchants]);

  const submit = async () => {
    setSubmitted(true);
    setGeneralError(null);
    const r = validateExpenseForm(values);
    if (!r.ok) {
      setErrors(r.errors);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await props.onSubmit(r.value);
      hapticSuccess();
    } catch (e) {
      if (e instanceof ValidationError && FIELD_MAP[e.field]) setErrors({ [FIELD_MAP[e.field]]: e.message });
      else setGeneralError("Could not save this expense. Your entries are kept. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const descriptionStyle = useInputStyle({ invalid: !!errors.description, focused: focused === "description" });
  const merchantStyle = useInputStyle({ invalid: !!errors.merchantName, focused: focused === "merchant" });
  const notesStyle = useInputStyle({ invalid: !!errors.notes, focused: focused === "notes" });

  const group = (title: string, children: ReactNode) => (
    <View style={{ marginBottom: spacing.lg }}>
      <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs }}>
        {title}
      </Text>
      <Card style={{ paddingBottom: 0 }}>{children}</Card>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {generalError ? (
          <View style={{ flexDirection: "row", alignItems: "flex-start", backgroundColor: colors.dangerSurface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: spacing.sm, marginTop: 1 }} />
            <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: type.body, flex: 1 }}>
              {generalError}
            </Text>
          </View>
        ) : null}

        <Card style={{ alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.lg, borderColor: errors.amount ? colors.danger : colors.border, borderWidth: errors.amount ? 1.5 : StyleSheet.hairlineWidth }}>
          <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "600" }}>
            Amount <Text style={{ color: colors.danger }}>*</Text>
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.sm, alignSelf: "stretch" }}>
            <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.headline, fontWeight: "600", marginRight: spacing.sm }}>Rs</Text>
            <TextInput
              testID="amount-input"
              accessibilityLabel="Amount in rupees"
              value={values.amount}
              onChangeText={(t) => set("amount", t)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textFaint}
              style={{ ...MONEY, minWidth: 120, maxWidth: "80%", fontSize: type.hero, fontWeight: "700", color: colors.text, paddingVertical: spacing.xs, letterSpacing: -1 }}
              maxLength={16}
            />
          </View>
          {errors.amount ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: type.small, fontWeight: "500", marginTop: spacing.sm }}>
              {errors.amount}
            </Text>
          ) : null}
        </Card>

        {group(
          "Details",
          <>
            <FormField label="Description" error={errors.description}>
              <TextInput
                testID="description-input"
                accessibilityLabel="Description"
                value={values.description}
                onChangeText={(t) => set("description", t)}
                onFocus={() => setFocused("description")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Lunch with team"
                placeholderTextColor={colors.textFaint}
                style={descriptionStyle}
                maxLength={200}
              />
            </FormField>
            <FormField label="Date" required error={errors.date}>
              <DateField value={values.date} onChange={(d) => set("date", d)} />
            </FormField>
            <FormField label="Time" error={errors.time}>
              <TimeField value={values.time} onChange={(t) => set("time", t)} />
            </FormField>
          </>,
        )}

        {group(
          "Category",
          <FormField label="Choose one" required error={errors.categoryId}>
            <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs }}>
              {props.categories.map((c) => {
                const selected = values.categoryId === c.id;
                const label = c.isArchived ? `${c.name} (archived)` : c.name;
                return (
                  <View key={c.id} style={{ width: "25%", padding: spacing.xs }}>
                    <Pressable
                      testID={`category-${c.id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={label}
                      onPress={() => set("categoryId", c.id)}
                      style={({ pressed }) => ({
                        alignItems: "center",
                        paddingVertical: spacing.sm + 2,
                        paddingHorizontal: spacing.xs,
                        minHeight: 84,
                        borderRadius: radii.md + 2,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : "transparent",
                        backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent",
                      })}
                    >
                      <IconTile icon={c.icon} color={categoryColor(c.color)} size={42} />
                      <Text
                        numberOfLines={2}
                        style={{ color: selected ? colors.onPrimarySoft : colors.text, fontSize: type.caption, fontWeight: selected ? "600" : "500", marginTop: spacing.xs + 2, textAlign: "center" }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </FormField>,
        )}

        {group(
          "Payment",
          <>
            <FormField label="Merchant" error={errors.merchantName} hint="Optional. Recent merchants appear as suggestions.">
              <TextInput
                testID="merchant-input"
                accessibilityLabel="Merchant"
                value={values.merchantName}
                onChangeText={(t) => set("merchantName", t)}
                onFocus={() => {
                  setMerchantFocused(true);
                  setFocused("merchant");
                }}
                onBlur={() => {
                  setMerchantFocused(false);
                  setFocused(null);
                }}
                placeholder="e.g. Swiggy"
                placeholderTextColor={colors.textFaint}
                style={merchantStyle}
                maxLength={80}
              />
              {(merchantFocused || values.merchantName === "") && suggestions.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
                  {suggestions.map((m) => (
                    <Chip key={m} role="button" icon="storefront-outline" label={m} selected={false} onPress={() => set("merchantName", m)} />
                  ))}
                </View>
              ) : null}
            </FormField>
            <FormField label="Payment method" required error={errors.paymentMethod}>
              <SegmentedControl
                wrap
                accessibilityLabel="Payment method"
                value={values.paymentMethod}
                onChange={(p) => set("paymentMethod", p)}
                segments={PAYMENT_METHODS.map((p) => ({ value: p, label: PAYMENT_METHOD_LABELS[p], icon: PAYMENT_ICONS[p] }))}
              />
            </FormField>
            <FormField label="Status" required error={errors.status} hint={STATUS_HINTS[values.status]}>
              <SegmentedControl
                accessibilityLabel="Status"
                value={values.status}
                onChange={(st) => set("status", st)}
                segments={STATUSES.map((st) => ({ value: st, label: STATUS_LABELS[st], testID: `status-${st}` }))}
              />
            </FormField>
          </>,
        )}

        {group(
          "Notes",
          <FormField label="Anything to remember" error={errors.notes}>
            <TextInput
              testID="notes-input"
              accessibilityLabel="Notes"
              value={values.notes}
              onChangeText={(t) => set("notes", t)}
              onFocus={() => setFocused("notes")}
              onBlur={() => setFocused(null)}
              placeholder="Optional"
              placeholderTextColor={colors.textFaint}
              multiline
              style={[notesStyle, { minHeight: 96, textAlignVertical: "top" }]}
              maxLength={1000}
            />
          </FormField>,
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          gap: spacing.md,
        }}
      >
        {props.onDelete ? (
          <Button testID="delete-button" variant="danger" icon="trash-outline" label="Delete" accessibilityLabel="Delete expense" onPress={props.onDelete} disabled={saving} style={{ paddingHorizontal: spacing.lg }} />
        ) : null}
        <Button
          testID="save-button"
          icon={saving ? undefined : "checkmark"}
          label={saving ? "Saving…" : props.submitLabel}
          accessibilityLabel={props.submitLabel}
          busy={saving}
          onPress={submit}
          style={{ flex: 1 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
