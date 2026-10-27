import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/useTheme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
type IconName = ComponentProps<typeof Ionicons>["name"];

/** Height of the bar above the safe-area inset (also used to keep the snackbar clear of it). */
export const TAB_BAR_HEIGHT = 64;

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: "home", off: "home-outline" },
  history: { on: "receipt", off: "receipt-outline" },
  reports: { on: "pie-chart", off: "pie-chart-outline" },
  settings: { on: "settings", off: "settings-outline" },
};

/** Custom bottom bar: four tabs with an active pill, and a prominent centred Add button that is always reachable. */
export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const { colors, spacing, type, dark } = useTheme();
  const router = useRouter();

  const tab = (route: (typeof state.routes)[number], index: number) => {
    const focused = state.index === index;
    const options = descriptors[route.key]?.options ?? {};
    const label = typeof options.title === "string" ? options.title : route.name;
    const icon = ICONS[route.name] ?? { on: "ellipse", off: "ellipse-outline" };
    const onPress = () => {
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        style={styles.tab}
      >
        <View style={[styles.pill, { backgroundColor: focused ? colors.primarySoft : "transparent" }]}>
          <Ionicons name={focused ? icon.on : icon.off} size={21} color={focused ? colors.onPrimarySoft : colors.textMuted} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: type.caption - 1, marginTop: 3, color: focused ? colors.text : colors.textMuted, fontWeight: focused ? "600" : "500" }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const items = state.routes.map(tab);
  const add = (
    <View key="add" style={styles.tab}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        onPress={() => router.push("/expense/new")}
        style={({ pressed }) => [
          styles.add,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.88 : 1,
            shadowColor: colors.primary,
            shadowOpacity: dark ? 0 : 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: dark ? 0 : 6,
          },
        ]}
      >
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
  items.splice(Math.min(2, items.length), 0, add);

  return (
    <View
      style={{
        backgroundColor: colors.tabBar,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        paddingHorizontal: spacing.sm,
      }}
    >
      <View style={{ height: TAB_BAR_HEIGHT, flexDirection: "row", alignItems: "center", maxWidth: 720, width: "100%", alignSelf: "center" }}>{items}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  add: { width: 54, height: 54, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: -14 },
});
