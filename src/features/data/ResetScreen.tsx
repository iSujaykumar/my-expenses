import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useInputStyle } from "../../components/inputStyle";
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
  const [focused, setFocused] = useState(false);
  const inputStyle = useInputStyle({ focused });
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
          <View style={{ flexDirection: "row", alignItems: "flex-start", padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.dangerSurface, marginBottom: spacing.lg }}>
            <Ionicons name="warning" size={22} color={colors.danger} style={{ marginRight: spacing.md, marginTop: 1 }} />
            <Text style={{ flex: 1, color: colors.text, fontSize: type.body, lineHeight: 22 }}>
              This permanently deletes every expense, merchant, budget, custom category and setting on this phone. The starter categories come back. It cannot be undone.
            </Text>
          </View>
          <Button
            variant="secondary"
            icon="cloud-download-outline"
            label="Export a backup first"
            disabled={busy}
            onPress={() => exportBackup(repos).catch(() => Alert.alert("Backup failed", "Could not create the backup file."))}
          />
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: type.body, fontWeight: "700" }}>Type {RESET_CONFIRM_WORD} to confirm</Text>
            <TextInput
              testID="reset-input"
              accessibilityLabel={`Type ${RESET_CONFIRM_WORD} to confirm`}
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={RESET_CONFIRM_WORD}
              placeholderTextColor={colors.textFaint}
              style={[inputStyle, { marginTop: spacing.sm, letterSpacing: 2, fontWeight: "700" }]}
            />
            <Button
              testID="reset-button"
              variant="danger"
              icon="trash-outline"
              label={busy ? "Deleting…" : "Delete all data"}
              disabled={!ok || busy}
              onPress={reset}
              style={{ marginTop: spacing.lg }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
