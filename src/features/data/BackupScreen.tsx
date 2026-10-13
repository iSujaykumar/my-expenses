import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { BackupData, InvalidRecord, parseAndValidateBackup } from "../../data/backup";
import { exportBackup, exportCsv } from "../../data/exporters";
import { pickTextFile } from "../../data/files";
import { applyImport, ImportMode, ImportPlan, planImport } from "../../data/importBackup";
import { useRepositories } from "../../db/DatabaseProvider";
import { notifyDataChanged } from "../../state/dataEvents";
import { useTheme } from "../../theme/useTheme";
import { DEDUPE_EXPLANATION, ImportPreview } from "./ImportPreview";

interface Loaded {
  fileName: string;
  exportedAt: string;
  appVersion: string;
  valid: BackupData;
  invalid: InvalidRecord[];
  plan: ImportPlan;
}

export function BackupScreen() {
  const repos = useRepositories();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const { colors, spacing, radii, type } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const doExportCsv = () =>
    run("Preparing CSV…", async () => {
      try {
        const n = await exportCsv(repos);
        showSnackbar({ message: `CSV with ${n} ${n === 1 ? "expense" : "expenses"} ready to share` });
      } catch {
        Alert.alert("Export failed", "Could not create the CSV file. Please try again.");
      }
    });

  const doExportBackup = () =>
    run("Preparing backup…", async () => {
      try {
        await exportBackup(repos);
        showSnackbar({ message: "Backup ready to share. Save it somewhere safe." });
      } catch {
        Alert.alert("Backup failed", "Could not create the backup file. Please try again.");
      }
    });

  const pick = () =>
    run("Checking file…", async () => {
      setFileError(null);
      setLoaded(null);
      try {
        const picked = await pickTextFile();
        if (!picked) return;
        const v = parseAndValidateBackup(picked.text);
        if (!v.ok) {
          setFileError(v.fileError);
          return;
        }
        const plan = await planImport(repos.db, v.valid, v.invalid, "merge");
        setLoaded({ fileName: picked.name, exportedAt: v.file.exported_at, appVersion: String(v.file.app_version ?? "?"), valid: v.valid, invalid: v.invalid, plan });
      } catch (e) {
        setFileError(e instanceof Error && e.message.includes("too large") ? e.message : "Could not read that file.");
      }
    });

  const setMode = (mode: ImportMode) =>
    loaded &&
    run("Checking…", async () => {
      const plan = await planImport(repos.db, loaded.valid, loaded.invalid, mode);
      setLoaded({ ...loaded, plan });
    });

  const apply = () =>
    loaded &&
    run(loaded.plan.mode === "replace" ? "Replacing all data…" : "Merging…", async () => {
      try {
        await applyImport(repos.db, loaded.plan);
        notifyDataChanged();
        const n = loaded.plan.counts.transactions.new;
        showSnackbar({ message: loaded.plan.mode === "replace" ? "All data replaced from backup" : `Imported ${n} new ${n === 1 ? "expense" : "expenses"}` });
        setLoaded(null);
      } catch {
        Alert.alert("Import failed", "Nothing was changed. Your data is exactly as before.");
      }
    });

  const confirm = () => {
    if (!loaded) return;
    const { plan } = loaded;
    if (plan.mode === "merge") {
      const total = Object.values(plan.counts).reduce((s, c) => s + c.new, 0);
      if (total === 0) {
        Alert.alert("Nothing new", "Everything in this backup is already on this phone.");
        return;
      }
      Alert.alert("Merge backup?", `Add ${plan.counts.transactions.new} new expenses (and ${total - plan.counts.transactions.new} other new records). Nothing on this phone is changed or deleted.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Merge", onPress: () => void apply() },
      ]);
      return;
    }
    Alert.alert(
      "Replace ALL data?",
      "Every expense, category, merchant, budget, setting and recurring template on this phone will be deleted and replaced by the backup (backups do not contain recurring templates). This cannot be undone. Export a backup of the current data first if you might need it.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Back up current data first", onPress: () => void doExportBackup() },
        { text: "Replace", style: "destructive", onPress: () => void apply() },
      ],
    );
  };

  const card = (title: string, body: string, children: React.ReactNode) => (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.md }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: type.bodyLarge, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: type.small, marginTop: spacing.xs, marginBottom: spacing.md }}>{body}</Text>
      {children}
    </View>
  );
  const button = (label: string, onPress: () => void, variant: "primary" | "outline" | "danger" = "primary", disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !!busy }}
      disabled={disabled || !!busy}
      onPress={onPress}
      style={{
        height: 48,
        borderRadius: radii.md,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.sm,
        backgroundColor: variant === "primary" ? colors.primary : colors.surface,
        borderWidth: variant === "primary" ? 0 : 1,
        borderColor: variant === "danger" ? colors.danger : colors.primary,
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      <Text style={{ color: variant === "primary" ? colors.onPrimary : variant === "danger" ? colors.danger : colors.primary, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Backup & export" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, marginLeft: spacing.sm }}>{busy}</Text>
          </View>
        ) : null}
        {card("Export expenses (CSV)", "A spreadsheet file of every expense: date, amount in rupees and paise, category, merchant, payment method, status and notes. Good for Excel or Google Sheets. It cannot be imported back; use a backup for that.", button("Export CSV", doExportCsv))}
        {card("Full backup (JSON)", "Everything: expenses, categories, merchants, budgets and settings. Use it to restore on this or a new phone. You choose where to save it from the share menu; the app never uploads anything.", button("Export backup", doExportBackup))}
        {card(
          "Restore from backup",
          "Pick a Meow backup file. It is fully checked before anything is changed, and you'll see a preview first.",
          <>
            {button(loaded ? "Pick a different file" : "Choose backup file", pick, loaded ? "outline" : "primary")}
            {fileError ? <Text style={{ color: colors.danger, marginTop: spacing.md }}>{fileError}</Text> : null}
            {loaded ? (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ color: colors.text, fontSize: type.small }}>
                  {loaded.fileName} · made {loaded.exportedAt.slice(0, 10)} · app {loaded.appVersion}
                </Text>
                <View style={{ flexDirection: "row", marginVertical: spacing.md }}>
                  {(["merge", "replace"] as const).map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: loaded.plan.mode === m }}
                      onPress={() => void setMode(m)}
                      style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1.5, borderColor: loaded.plan.mode === m ? colors.primary : colors.border, backgroundColor: loaded.plan.mode === m ? colors.surfaceAlt : colors.surface, marginRight: m === "merge" ? spacing.sm : 0 }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{m === "merge" ? "Merge (add new)" : "Replace everything"}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: type.caption, marginBottom: spacing.md }}>
                  {loaded.plan.mode === "merge" ? DEDUPE_EXPLANATION : "Replace deletes everything on this phone and restores the backup exactly. It happens in one step: if anything fails, nothing changes."}
                </Text>
                <ImportPreview plan={loaded.plan} />
                {button(loaded.plan.mode === "merge" ? "Merge now" : "Replace all data", confirm, loaded.plan.mode === "merge" ? "primary" : "danger", !!loaded.plan.blockedReason)}
                {button("Cancel", () => setLoaded(null), "outline")}
              </View>
            ) : null}
          </>,
        )}
      </ScrollView>
    </View>
  );
}
