import { useLocalSearchParams } from "expo-router";

import { CategoryEditorScreen } from "../../src/features/categories/CategoryEditorScreen";

export default function EditCategoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryEditorScreen id={typeof id === "string" ? id : undefined} />;
}
