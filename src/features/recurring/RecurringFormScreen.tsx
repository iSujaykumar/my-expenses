import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { CategoryIcon } from "../../components/CategoryIcon";
import { CategoryPickerModal } from "../../components/CategoryPickerModal";
import { FormField } from "../../components/FormField";
import { useInputStyle } from "../../components/inputStyle";
import { SegmentedControl } from "../../components/SegmentedControl";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, PaymentMethod } from "../../constants/categories";
import { useRepositories } from "../../db/DatabaseProvider";
import { ValidationError } from "../../db/types";
import { Category } from "../../repo/categories";
import { useFormatDate } from "../../state/AppSettings";
import { notifyDataChanged } from "../../state/dataEvents";
import { MONEY } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { parseDateString, toDateString, todayLocal } from "../../utils/date";
import { paiseToInputString, parseRupeesToPaise } from "../../utils/money";
import { Frequency } from "./schedule";

export function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === "new";
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const formatDate = useFormatDate();
  const { colors, spacing, type } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(todayLocal());
  const [dayOfMonth, setDayOfMonth] = useState(String(parseDateString(todayLocal()).day));
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cats = await repos.categories.list();
      if (cancelled) return;
      setCategories(cats);
      if (!isNew) {
        const t = await repos.recurring.getById(id);
        if (cancelled || !t) return;
        setDescription(t.description);
        setAmount(paiseToInputString(t.amountPaise));
        setCategoryId(t.categoryId);
        setMethod(t.paymentMethod);
        setFrequency(t.frequency);
        setStartDate(t.startDate);
        setDayOfMonth(String(t.dayOfMonth ?? parseDateString(t.startDate).day));
        setNotes(t.notes);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repos, id, isNew]);

  const category = categories.find((c) => c.id === categoryId) ?? null;

  const save = async () => {
    const e: Record<string, string> = {};
    const parsed = parseRupeesToPaise(amount);
    if (!description.trim()) e.description = "Enter a name, e.g. Rent or Gym.";
    if (!parsed.ok) e.amount = parsed.error;
    if (!categoryId) e.category = "Pick a category.";
    const dom = Number(dayOfMonth);
    if (frequency === "monthly" && (!Number.isInteger(dom) || dom < 1 || dom > 31)) e.dayOfMonth = "Enter a day from 1 to 31.";
    setErrors(e);
    if (Object.keys(e).length || !parsed.ok || !categoryId) return;
    setSaving(true);
    try {
      const input = { description, amountPaise: parsed.paise, categoryId, paymentMethod: method, frequency, startDate, dayOfMonth: frequency === "monthly" ? dom : null, notes };
      if (isNew) await repos.recurring.create(input);
      else await repos.recurring.update(id, input);
      notifyDataChanged();
      showSnackbar({ message: isNew ? "Recurring expense added" : "Recurring expense saved" });
      router.back();
    } catch (err) {
      if (err instanceof ValidationError) setErrors({ [err.field]: err.message });
      else Alert.alert("Not saved", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const pickStart = () => {
    const { year, month, day } = parseDateString(startDate);
    DateTimePickerAndroid.open({
      value: new Date(year, month - 1, day),
      mode: "date",
      onChange: (ev, d) => {
        if (ev.type !== "set" || !d) return;
        const s = toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
        setStartDate(s);
        setDayOfMonth(String(d.getDate()));
      },
    });
  };

  const input = useInputStyle({});
  const invalid = useInputStyle({ invalid: true });
  const field = (err?: string) => (err ? invalid : input);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={isNew ? "New recurring expense" : "Edit recurring expense"} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <Card style={{ paddingBottom: 0, marginBottom: spacing.lg }}>
            <FormField label="Name" required error={errors.description}>
              <TextInput accessibilityLabel="Name" value={description} onChangeText={setDescription} placeholder="e.g. Rent, Gym, Netflix" placeholderTextColor={colors.textFaint} style={field(errors.description)} maxLength={120} />
            </FormField>
            <FormField label="Amount (₹)" required error={errors.amount}>
              <View style={[field(errors.amount), { flexDirection: "row", alignItems: "center" }]}>
                <Text style={{ ...MONEY, color: colors.textMuted, fontSize: type.bodyLarge, fontWeight: "600", marginRight: spacing.sm }}>Rs</Text>
                <TextInput
                  accessibilityLabel="Amount in rupees"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textFaint}
                  style={{ ...MONEY, flex: 1, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", paddingVertical: 0 }}
                />
              </View>
            </FormField>
            <FormField label="Category" required error={errors.category}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Category: ${category?.name ?? "none"}. Change`}
                onPress={() => setPicker(true)}
                style={[field(errors.category), { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs }]}
              >
                {category ? <CategoryIcon icon={category.icon} color={category.color} size={32} /> : <Ionicons name="pricetags-outline" size={20} color={colors.textMuted} />}
                <Text style={{ color: category ? colors.text : colors.textMuted, marginLeft: spacing.sm, flex: 1, fontSize: type.body }}>{category?.name ?? "Pick a category"}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            </FormField>
          </Card>

          <Card style={{ paddingBottom: 0, marginBottom: spacing.lg }}>
            <FormField label="Repeats">
              <SegmentedControl
                accessibilityLabel="Repeats"
                value={frequency}
                onChange={setFrequency}
                segments={[
                  { value: "monthly", label: "Monthly", icon: "calendar-outline" },
                  { value: "weekly", label: "Weekly", icon: "repeat-outline" },
                ]}
              />
            </FormField>
            <FormField label={frequency === "weekly" ? "First date (repeats on this weekday)" : "Start date"}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Start date ${formatDate(startDate)}. Change`} onPress={pickStart} style={[input, { flexDirection: "row", alignItems: "center" }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <Text style={{ color: colors.text, fontSize: type.body }}>{formatDate(startDate)}</Text>
              </Pressable>
            </FormField>
            {frequency === "monthly" ? (
              <FormField label="Day of month" error={errors.dayOfMonth} hint="29, 30 or 31: shorter months use their last day (e.g. 28 or 29 Feb).">
                <TextInput accessibilityLabel="Day of month" value={dayOfMonth} onChangeText={setDayOfMonth} keyboardType="number-pad" maxLength={2} style={field(errors.dayOfMonth)} />
              </FormField>
            ) : null}
            <FormField label="Payment method">
              <SegmentedControl
                wrap
                accessibilityLabel="Payment method"
                value={method}
                onChange={setMethod}
                segments={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
              />
            </FormField>
            <FormField label="Notes">
              <TextInput accessibilityLabel="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional" placeholderTextColor={colors.textFaint} style={[input, { minHeight: 80, textAlignVertical: "top" }]} maxLength={500} />
            </FormField>
          </Card>
          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.xs }}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textFaint} style={{ marginRight: spacing.sm, marginTop: 1 }} />
            <Text style={{ color: colors.textMuted, fontSize: type.small, lineHeight: 19, flex: 1 }}>
              Changes apply to future occurrences only. Expenses already recorded keep their values. No notifications are sent; check &quot;Due soon&quot; on Home.
            </Text>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md + insets.bottom, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <Button icon={saving ? undefined : "checkmark"} label={saving ? "Saving…" : "Save"} accessibilityLabel="Save" busy={saving} onPress={save} />
        </View>
      </KeyboardAvoidingView>
      <CategoryPickerModal visible={picker} title="Pick a category" categories={categories} onPick={(c) => { setCategoryId(c.id); setPicker(false); }} onClose={() => setPicker(false)} />
    </View>
  );
}
