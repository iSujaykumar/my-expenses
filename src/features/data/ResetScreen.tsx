import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { exportBackup } from "../../data/exporters";
import { RESET_CONFIRM_WORD, resetAllData } from "../../data/reset";
import { useRepositories } from "../../db/DatabaseProvider";
import { notifyDataChanged } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";

export function isResetConfirmed(text: string): boolean {
  return text.trim() === RESET_CONFIRM_WORD;
}

export function ResetScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const { colors, spacing, radii, type } = useTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = isResetConfirmed(text);

  const reset = async () => {
    setBusy(true);
    try {
      await resetAllData(repos.db);
      notifyDataChanged();
      setText("");
      showSnackbar({ message: "All data deleted. Starter categories restored." });
      router.back();
    } catch {
      Alert.alert("Reset failed", "Nothing was deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Reset all data" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
          <Text style={{ color: colors.text, fontSize: type.body }}>
            This permanently deletes every expense, merchant, budget, custom category and setting on this phone. The starter categories come back. It cannot be undone.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => exportBackup(repos).catch(() => Alert.alert("Backup failed", "Could not create the backup file."))}
            style={{ height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg }}
          >
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Export a backup first</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700", marginTop: spacing.xl }}>Type {RESET_CONFIRM_WORD} to confirm</Text>
          <TextInput
            testID="reset-input"
            accessibilityLabel={`Type ${RESET_CONFIRM_WORD} to confirm`}
            value={text}
            onChangeText={setText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={RESET_CONFIRM_WORD}
            placeholderTextColor={colors.textMuted}
            style={{ marginTop: spacing.sm, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: type.body }}
          />
          <Pressable
            testID="reset-button"
            accessibilityRole="button"
            accessibilityState={{ disabled: !ok || busy }}
            disabled={!ok || busy}
            onPress={reset}
            style={{ height: 52, borderRadius: radii.md, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", marginTop: spacing.lg, opacity: ok && !busy ? 1 : 0.4 }}
          >
            <Text style={{ color: colors.onDanger, fontWeight: "700", fontSize: type.bodyLarge }}>{busy ? "Deleting…" : "Delete all data"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
