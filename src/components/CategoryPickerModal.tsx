import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Category } from "../repo/categories";
import { useReducedMotion } from "../theme/motion";
import { useTheme } from "../theme/useTheme";
import { CategoryIcon } from "./CategoryIcon";
import { FONT_FAMILY } from "../theme/tokens";

/** Pick one category from a list (Android back closes it). */
export function CategoryPickerModal(props: { visible: boolean; title: string; message?: string; categories: Category[]; onPick: (c: Category) => void; onClose: () => void }) {
  const { colors, spacing, type } = useTheme();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.visible} animationType={reduceMotion ? "none" : "slide"} onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg }}>
          <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.title, fontWeight: "700", flex: 1 }}>{props.title}</Text>
          <Pressable accessibilityRole="button" onPress={props.onClose} hitSlop={12}>
            <Text style={{ fontFamily: FONT_FAMILY, color: colors.primary, fontWeight: "600", fontSize: type.body }}>Cancel</Text>
          </Pressable>
        </View>
        {props.message ? <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.body, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>{props.message}</Text> : null}
        <ScrollView>
          {props.categories.length === 0 ? (
            <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, padding: spacing.lg }}>No categories available.</Text>
          ) : (
            props.categories.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                onPress={() => props.onPick(c)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: pressed ? colors.surfaceAlt : colors.background })}
              >
                <CategoryIcon icon={c.icon} color={c.color} size={40} />
                <Text style={{ fontFamily: FONT_FAMILY, color: colors.text, fontSize: type.body, fontWeight: "500", marginLeft: spacing.md }}>{c.name}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
