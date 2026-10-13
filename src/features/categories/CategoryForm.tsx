import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { FormField } from "../../components/FormField";
import { ValidationError } from "../../db/types";
import { categoryIcons, categoryPalette } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

export interface CategoryFormValues {
  name: string;
  color: string;
  icon: string;
}

export function validateCategoryName(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter a name.";
  if (n.length > 40) return "Keep the name to 40 characters or fewer.";
  return null;
}

/** Name + colour palette + icon grid. Shows inline errors and keeps typed values on failure. */
export function CategoryForm(props: { initial: CategoryFormValues; submitLabel: string; onSubmit: (v: CategoryFormValues) => Promise<void> }) {
  const { colors, spacing, radii, type } = useTheme();
  const [values, setValues] = useState(props.initial);
  const [errors, setErrors] = useState<{ name?: string; color?: string; general?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const nameError = validateCategoryName(values.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await props.onSubmit({ ...values, name: values.name.trim() });
    } catch (e) {
      if (e instanceof ValidationError && (e.field === "name" || e.field === "color")) setErrors({ [e.field]: e.message });
      else setErrors({ general: "Could not save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      {errors.general ? <Text style={{ color: colors.danger, marginBottom: spacing.md }}>{errors.general}</Text> : null}
      <FormField label="Name" required error={errors.name}>
        <TextInput
          testID="category-name-input"
          accessibilityLabel="Category name"
          value={values.name}
          onChangeText={(name) => {
            setValues((v) => ({ ...v, name }));
            if (errors.name) setErrors({});
          }}
          maxLength={40}
          placeholder="e.g. Coffee"
          placeholderTextColor={colors.textMuted}
          style={{ minHeight: 48, borderWidth: 1, borderColor: errors.name ? colors.danger : colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: type.body }}
        />
      </FormField>
      <FormField label="Colour" error={errors.color}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {categoryPalette.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: values.color === c }}
              onPress={() => setValues((v) => ({ ...v, color: c }))}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, margin: spacing.xs, alignItems: "center", justifyContent: "center", borderWidth: values.color === c ? 3 : 0, borderColor: colors.text }}
            >
              {values.color === c ? <Ionicons name="checkmark" size={20} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      </FormField>
      <FormField label="Icon">
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {categoryIcons.map((icon) => (
            <Pressable
              key={icon}
              accessibilityRole="radio"
              accessibilityLabel={`Icon ${icon.replace(/-outline$/, "").replace(/-/g, " ")}`}
              accessibilityState={{ selected: values.icon === icon }}
              onPress={() => setValues((v) => ({ ...v, icon }))}
              style={{ width: 44, height: 44, margin: spacing.xs, borderRadius: radii.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: values.icon === icon ? values.color : colors.border, backgroundColor: values.icon === icon ? `${values.color}22` : colors.surface }}
            >
              <Ionicons name={icon as ComponentProps<typeof Ionicons>["name"]} size={22} color={values.icon === icon ? values.color : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </FormField>
      <Pressable
        testID="category-save"
        accessibilityRole="button"
        disabled={saving}
        onPress={submit}
        style={{ height: 52, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: type.bodyLarge }}>{saving ? "Saving…" : props.submitLabel}</Text>
      </Pressable>
    </View>
  );
}
