import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "../../components/CategoryIcon";
import { Button } from "../../components/Button";
import { ListGroup, ListRow } from "../../components/ListRow";
import { SectionHeader } from "../../components/SectionHeader";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useRepositories } from "../../db/DatabaseProvider";
import { Category } from "../../repo/categories";
import { useDataVersion } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";

export function CategoriesScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, elevation } = useTheme();
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
      <View style={{ marginBottom: spacing.xl }}>
        <SectionHeader title={title} variant="group" />
        <ListGroup>
        {list.map(({ category: c, count }) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${count} ${count === 1 ? "expense" : "expenses"}`}
            left={<CategoryIcon icon={c.icon} color={c.color} size={36} />}
            onPress={() => router.push({ pathname: "/category/[id]", params: { id: c.id } })}
          />
        ))}
        </ListGroup>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Categories" onBack={() => router.back()} />
      {!rows ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} size="large" color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 112 + insets.bottom }}>
          {section("Active", rows.filter((r) => !r.category.isArchived))}
          {section("Archived · hidden when adding, kept in history", rows.filter((r) => r.category.isArchived))}
        </ScrollView>
      )}
      <View style={[{ position: "absolute", right: spacing.lg, bottom: spacing.lg + insets.bottom, borderRadius: 16 }, elevation]}>
        <Button icon="add" label="New category" onPress={() => router.push("/category/new")} />
      </View>
    </View>
  );
}
