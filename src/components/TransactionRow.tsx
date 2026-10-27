import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { PAYMENT_METHOD_LABELS } from "../constants/categories";
import { TransactionWithDetails } from "../repo/transactions";
import { MONEY } from "../theme/tokens";
import { useTheme } from "../theme/useTheme";
import { formatPaise } from "../utils/money";
import { CategoryIcon } from "./CategoryIcon";
import { StatusBadge } from "./StatusBadge";

/** One expense in a list. Refunded amounts are struck through because they don't count. */
export const TransactionRow = memo(function TransactionRow({
  transaction: t,
  onPress,
}: {
  transaction: TransactionWithDetails;
  onPress: (id: string) => void;
}) {
  const { colors, spacing, type } = useTheme();
  const title = t.description || t.merchantName || t.categoryName;
  const subtitle = [t.description && t.merchantName ? t.merchantName : null, t.categoryName, PAYMENT_METHOD_LABELS[t.paymentMethod]]
    .filter(Boolean)
    .join(" · ");
  const refunded = t.status === "refunded";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatPaise(t.amountPaise)}${t.status !== "paid" ? `, ${t.status}` : ""}`}
      onPress={() => onPress(t.id)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md - 2,
        minHeight: 64,
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
      })}
    >
      <CategoryIcon icon={t.categoryIcon} color={t.categoryColor} size={42} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: type.body, fontWeight: "600", flexShrink: 1 }}>
            {title}
          </Text>
          <StatusBadge status={t.status} />
        </View>
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: type.small, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
      <Text
        style={{
          ...MONEY,
          color: refunded ? colors.textMuted : colors.text,
          fontSize: type.body,
          fontWeight: "600",
          marginLeft: spacing.sm,
          textDecorationLine: refunded ? "line-through" : "none",
        }}
      >
        {formatPaise(t.amountPaise)}
      </Text>
    </Pressable>
  );
});
