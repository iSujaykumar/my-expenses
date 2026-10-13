import { Text, View } from "react-native";

import { TransactionStatus } from "../constants/categories";
import { useTheme } from "../theme/useTheme";

/** Small badge shown for pending and refunded expenses (paid shows nothing). */
export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { colors, spacing, radii, type } = useTheme();
  if (status === "paid") return null;
  const pending = status === "pending";
  return (
    <View
      style={{
        backgroundColor: pending ? colors.warningSurface : colors.surfaceAlt,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 1,
        marginLeft: spacing.xs,
      }}
    >
      <Text style={{ fontSize: type.caption, fontWeight: "700", color: pending ? colors.warning : colors.textMuted }}>
        {pending ? "Pending" : "Refunded"}
      </Text>
    </View>
  );
}
