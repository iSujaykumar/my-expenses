import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "../../components/CategoryIcon";
import { ListRow } from "../../components/ListRow";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useRepositories } from "../../db/DatabaseProvider";
import { Category } from "../../repo/categories";
import { useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";

export function CategoriesScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, type } = useTheme();
  const dataVersion = useDataVersion();
  const [rows, setRows] = useState<{ category: Category; count: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cats = await repos.categories.list({ includeArchived: true });
      const counts = await Promise.all(cats.map((c) => repos.categories.transactionCount(c.id)));
      if (!cancelled) setRows(cats.map((category, i) => ({ category, count: counts[i] })));
    })().catch(() => {
      if (!cancelled) setRows([]);
    });
    return () => {
      cancelled = true;
    };
  }, [repos, dataVersion]);

  const section = (title: string, list: { category: Category; count: number }[]) =>
    list.length ? (
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: type.small, fontWeight: "700", paddingHorizontal: spacing.lg, marginBottom: spacing.xs }}>{title}</Text>
        {list.map(({ category: c, count }) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${count} ${count === 1 ? "expense" : "expenses"}`}
            left={<CategoryIcon icon={c.icon} color={c.color} size={36} />}
            onPress={() => router.push({ pathname: "/category/[id]", params: { id: c.id } })}
          />
        ))}
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Categories" onBack={() => router.back()} />
      {!rows ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 96 + insets.bottom }}>
          {section("ACTIVE", rows.filter((r) => !r.category.isArchived))}
          {section("ARCHIVED (hidden when adding expenses, kept in history)", rows.filter((r) => r.category.isArchived))}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/category/new")}
        style={{ position: "absolute", right: spacing.lg, bottom: spacing.lg + insets.bottom, height: 56, paddingHorizontal: spacing.xl, borderRadius: radii.pill, backgroundColor: colors.primary, justifyContent: "center", elevation: 4 }}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: type.bodyLarge }}>New category</Text>
      </Pressable>
    </View>
  );
}
