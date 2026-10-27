import { Text, View } from "react-native";

import { TransactionStatus } from "../constants/categories";
import { useTheme } from "../theme/useTheme";
import { FONT_FAMILY } from "../theme/tokens";

/** Small badge shown for pending and refunded expenses (paid shows nothing). */
export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { colors, spacing, radii, type } = useTheme();
  if (status === "paid") return null;
  const pending = status === "pending";
  return (
    <View
      style={{
        backgroundColor: pending ? colors.warningSurface : colors.surfaceAlt,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        marginLeft: spacing.xs + 2,
      }}
    >
      <Text style={{ fontFamily: FONT_FAMILY, fontSize: type.caption - 1, fontWeight: "600", color: pending ? colors.warning : colors.textMuted }}>
        {pending ? "Pending" : "Refunded"}
      </Text>
    </View>
  );
}
