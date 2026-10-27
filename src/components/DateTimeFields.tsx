import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { useFormatDate } from "../state/AppSettings";
import { useTheme } from "../theme/useTheme";
import { addDays, isValidDateString, toDateString, todayLocal } from "../utils/date";
import { Chip } from "./Chip";
import { FONT_FAMILY } from "../theme/tokens";

function dateFromString(value: string): Date {
  if (!isValidDateString(value)) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Picked Date -> plain local calendar string (never UTC-shifted). */
export function dateToString(d: Date): string {
  return toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function useFieldStyle() {
  const { colors, spacing } = useTheme();
  return {
    minHeight: 52,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: spacing.lg - 2,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  };
}

/** Date with system picker plus Today / Yesterday shortcuts. Future dates are allowed (e.g. planned bills). */
export function DateField({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const { colors, spacing, type } = useTheme();
  const fieldStyle = useFieldStyle();
  const [iosOpen, setIosOpen] = useState(false);
  const formatDate = useFormatDate();
  const today = todayLocal();

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setIosOpen(false);
    if (event.type === "set" && date) onChange(dateToString(date));
  };
  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: dateFromString(value), mode: "date", onChange: handle });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Date, ${isValidDateString(value) ? formatDate(value) : "not set"}. Change`} onPress={open} style={fieldStyle}>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.body, marginLeft: spacing.sm, flex: 1 }}>
          {isValidDateString(value) ? formatDate(value) : "Pick a date"}
        </Text>
        <Text style={{ fontFamily: FONT_FAMILY, color: colors.primary, fontWeight: "600", fontSize: type.small }}>Change</Text>
      </Pressable>
      <View style={{ flexDirection: "row", marginTop: spacing.sm }}>
        <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
        <Chip label="Yesterday" selected={value === addDays(today, -1)} onPress={() => onChange(addDays(today, -1))} />
      </View>
      {iosOpen && Platform.OS !== "android" ? <DateTimePicker value={dateFromString(value)} mode="date" onChange={handle} /> : null}
    </View>
  );
}

/** Optional time (HH:MM) with system picker and a clear button. */
export function TimeField({ value, onChange }: { value: string; onChange: (time: string) => void }) {
  const { colors, spacing, type } = useTheme();
  const fieldStyle = useFieldStyle();
  const [iosOpen, setIosOpen] = useState(false);

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setIosOpen(false);
    if (event.type === "set" && date) {
      onChange(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
    }
  };
  const open = () => {
    const base = new Date();
    if (/^\d{2}:\d{2}$/.test(value)) base.setHours(Number(value.slice(0, 2)), Number(value.slice(3)), 0, 0);
    if (Platform.OS === "android") DateTimePickerAndroid.open({ value: base, mode: "time", is24Hour: true, onChange: handle });
    else setIosOpen(true);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={value ? `Time ${value}. Change` : "Add time"} onPress={open} style={[fieldStyle, { flex: 1 }]}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={{ fontFamily: FONT_FAMILY, color: value ? colors.text : colors.textMuted, fontSize: type.body, marginLeft: spacing.sm, flex: 1 }}>{value || "No time (optional)"}</Text>
          <Text style={{ fontFamily: FONT_FAMILY, color: colors.primary, fontWeight: "600", fontSize: type.small }}>{value ? "Change" : "Add"}</Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear time" hitSlop={8} onPress={() => onChange("")} style={{ padding: spacing.md }}>
            <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {iosOpen && Platform.OS !== "android" ? <DateTimePicker value={new Date()} mode="time" onChange={handle} /> : null}
    </View>
  );
}
