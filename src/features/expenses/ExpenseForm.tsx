import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip } from "../../components/Chip";
import { DateField, TimeField } from "../../components/DateTimeFields";
import { FormField } from "../../components/FormField";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, STATUSES } from "../../constants/categories";
import { ValidationError } from "../../db/types";
import { Category } from "../../repo/categories";
import { useTheme } from "../../theme/useTheme";
import { ExpenseFormErrors, ExpenseFormValues, validateExpenseForm, ValidatedExpense } from "./form";

const STATUS_LABELS = { paid: "Paid", pending: "Pending", refunded: "Refunded" } as const;
const STATUS_HINTS = {
  paid: "Counts as spending.",
  pending: "Counts as spending, marked “Pending”.",
  refunded: "Does not count as spending anywhere.",
} as const;

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
    } catch (e) {
      if (e instanceof ValidationError && FIELD_MAP[e.field]) setErrors({ [FIELD_MAP[e.field]]: e.message });
      else setGeneralError("Could not save this expense. Your entries are kept. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const input = (error?: string) => ({
    minHeight: 48,
    borderWidth: 1,
    borderColor: error ? colors.danger : colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: type.body,
  });

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {generalError ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, marginBottom: spacing.md, fontSize: type.body }}>
            {generalError}
          </Text>
        ) : null}

        <FormField label="Amount (Rs)" required error={errors.amount}>
          <View style={[input(errors.amount), { flexDirection: "row", alignItems: "center" }]}>
            <Text style={{ color: colors.textMuted, fontSize: type.title, marginRight: spacing.sm }}>Rs</Text>
            <TextInput
              testID="amount-input"
              accessibilityLabel="Amount in rupees"
              value={values.amount}
              onChangeText={(t) => set("amount", t)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              style={{ flex: 1, fontSize: type.headline, fontWeight: "700", color: colors.text, paddingVertical: spacing.sm }}
              maxLength={16}
            />
          </View>
        </FormField>

        <FormField label="Description" error={errors.description}>
          <TextInput
            testID="description-input"
            accessibilityLabel="Description"
            value={values.description}
            onChangeText={(t) => set("description", t)}
            placeholder="e.g. Lunch with team"
            placeholderTextColor={colors.textMuted}
            style={input(errors.description)}
            maxLength={200}
          />
        </FormField>

        <FormField label="Date" required error={errors.date}>
          <DateField value={values.date} onChange={(d) => set("date", d)} />
        </FormField>

        <FormField label="Time" error={errors.time}>
          <TimeField value={values.time} onChange={(t) => set("time", t)} />
        </FormField>

        <FormField label="Category" required error={errors.categoryId}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {props.categories.map((c) => (
              <Chip
                key={c.id}
                testID={`category-${c.id}`}
                label={c.isArchived ? `${c.name} (archived)` : c.name}
                color={c.color}
                selected={values.categoryId === c.id}
                onPress={() => set("categoryId", c.id)}
              />
            ))}
          </View>
        </FormField>

        <FormField label="Merchant" error={errors.merchantName} hint="Optional. Recent merchants appear as suggestions.">
          <TextInput
            testID="merchant-input"
            accessibilityLabel="Merchant"
            value={values.merchantName}
            onChangeText={(t) => set("merchantName", t)}
            onFocus={() => setMerchantFocused(true)}
            onBlur={() => setMerchantFocused(false)}
            placeholder="e.g. Swiggy"
            placeholderTextColor={colors.textMuted}
            style={input(errors.merchantName)}
            maxLength={80}
          />
          {(merchantFocused || values.merchantName === "") && suggestions.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm }}>
              {suggestions.map((m) => (
                <Chip key={m} role="button" label={m} selected={false} onPress={() => set("merchantName", m)} />
              ))}
            </View>
          ) : null}
        </FormField>

        <FormField label="Payment method" required error={errors.paymentMethod}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map((p) => (
              <Chip key={p} label={PAYMENT_METHOD_LABELS[p]} selected={values.paymentMethod === p} onPress={() => set("paymentMethod", p)} />
            ))}
          </View>
        </FormField>

        <FormField label="Status" required error={errors.status} hint={STATUS_HINTS[values.status]}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {STATUSES.map((s) => (
              <Chip key={s} testID={`status-${s}`} label={STATUS_LABELS[s]} selected={values.status === s} onPress={() => set("status", s)} />
            ))}
          </View>
        </FormField>

        <FormField label="Notes" error={errors.notes}>
          <TextInput
            testID="notes-input"
            accessibilityLabel="Notes"
            value={values.notes}
            onChangeText={(t) => set("notes", t)}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[input(errors.notes), { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md }]}
            maxLength={1000}
          />
        </FormField>
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          padding: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {props.onDelete ? (
          <Pressable
            testID="delete-button"
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
            onPress={props.onDelete}
            disabled={saving}
            style={{ height: 52, paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger, justifyContent: "center", marginRight: spacing.md }}
          >
            <Text style={{ color: colors.danger, fontWeight: "700", fontSize: type.body }}>Delete</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="save-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1, height: 52, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: type.bodyLarge }}>{saving ? "Saving…" : props.submitLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
