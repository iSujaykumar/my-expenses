import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { IconTile, withAlpha } from "../../components/IconTile";
import { useInputStyle } from "../../components/inputStyle";
import { ValidationError } from "../../db/types";
import { categoryColor, categoryIcons, categoryPalette } from "../../theme/tokens";
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
  const inputStyle = useInputStyle({ invalid: !!errors.name });
  const shownColor = categoryColor(values.color);

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
      <View style={{ alignItems: "center", marginBottom: spacing.xl }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <IconTile icon={values.icon} color={shownColor} size={64} />
        <Text numberOfLines={1} style={{ color: values.name.trim() ? colors.text : colors.textMuted, fontSize: type.bodyLarge, fontWeight: "600", marginTop: spacing.sm }}>
          {values.name.trim() || "New category"}
        </Text>
      </View>
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
          placeholderTextColor={colors.textFaint}
          style={inputStyle}
        />
      </FormField>
      <FormField label="Colour" error={errors.color}>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {categoryPalette.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: shownColor === c }}
              onPress={() => setValues((v) => ({ ...v, color: c }))}
              style={{ width: 44, height: 44, borderRadius: 22, margin: spacing.xs, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: shownColor === c ? colors.text : "transparent" }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>
                {shownColor === c ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
              </View>
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
              style={{ width: 48, height: 48, margin: spacing.xs, borderRadius: radii.md + 2, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: values.icon === icon ? shownColor : "transparent", backgroundColor: values.icon === icon ? withAlpha(shownColor, 0.14) : colors.surfaceAlt }}
            >
              <Ionicons name={icon as ComponentProps<typeof Ionicons>["name"]} size={22} color={values.icon === icon ? shownColor : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </FormField>
      <Button testID="category-save" label={saving ? "Saving…" : props.submitLabel} accessibilityLabel={props.submitLabel} disabled={saving} onPress={submit} style={{ marginTop: spacing.sm }} />
    </View>
  );
}
