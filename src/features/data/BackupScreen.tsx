import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ButtonVariant } from "../../components/Button";
import { Card } from "../../components/Card";
import { IconTile } from "../../components/IconTile";
import { SegmentedControl } from "../../components/SegmentedControl";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useSnackbar } from "../../components/Snackbar";
import { BackupData, InvalidRecord, parseAndValidateBackup } from "../../data/backup";
import { exportBackup, exportCsv } from "../../data/exporters";
import { pickTextFile } from "../../data/files";
import { applyImport, ImportMode, ImportPlan, planImport } from "../../data/importBackup";
import { useRepositories } from "../../db/DatabaseProvider";
import { notifyDataChanged } from "../../state/dataEvents";
import { categoryPalette, FONT_FAMILY } from "../../theme/tokens";
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

  const card = (title: string, body: string, icon: string, tint: string, children: React.ReactNode) => (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconTile icon={icon} color={tint} size={40} />
        <Text accessibilityRole="header" style={{ fontFamily: FONT_FAMILY, flex: 1, color: colors.text, fontSize: type.bodyLarge, fontWeight: "700", marginLeft: spacing.md }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.small, lineHeight: 19, marginTop: spacing.md, marginBottom: spacing.sm }}>{body}</Text>
      {children}
    </Card>
  );
  const button = (label: string, onPress: () => void, variant: "primary" | "outline" | "danger" = "primary", disabled = false, icon?: ComponentProps<typeof Ionicons>["name"]) => {
    const v: ButtonVariant = variant === "outline" ? "secondary" : variant;
    return <Button label={label} icon={icon} variant={v} onPress={onPress} disabled={disabled || !!busy} style={{ marginTop: spacing.sm }} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Backup & export" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}>
        {busy ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primarySoft }}>
            <ActivityIndicator color={colors.onPrimarySoft} />
            <Text style={{ fontFamily: FONT_FAMILY, color: colors.onPrimarySoft, marginLeft: spacing.sm, fontWeight: "600" }}>{busy}</Text>
          </View>
        ) : null}
        {card(
          "Export expenses (CSV)",
          "A spreadsheet file of every expense: date, amount in rupees and paise, category, merchant, payment method, status and notes. Good for Excel or Google Sheets. It cannot be imported back; use a backup for that.",
          "document-text-outline",
          categoryPalette[2],
          button("Export CSV", doExportCsv, "primary", false, "share-outline"),
        )}
        {card(
          "Full backup (JSON)",
          "Everything: expenses, categories, merchants, budgets and settings. Use it to restore on this or a new phone. You choose where to save it from the share menu; the app never uploads anything.",
          "cloud-download-outline",
          categoryPalette[1],
          button("Export backup", doExportBackup, "primary", false, "download-outline"),
        )}
        {card(
          "Restore from backup",
          "Pick a Meow backup file. It is fully checked before anything is changed, and you'll see a preview first.",
          "refresh-outline",
          categoryPalette[4],
          <>
            {button(loaded ? "Pick a different file" : "Choose backup file", pick, loaded ? "outline" : "primary", false, "folder-open-outline")}
            {fileError ? (
              <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.dangerSurface }}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: spacing.sm }} />
                <Text style={{ fontFamily: FONT_FAMILY, flex: 1, color: colors.danger, fontWeight: "600" }}>{fileError}</Text>
              </View>
            ) : null}
            {loaded ? (
              <View style={{ marginTop: spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
                  <Ionicons name="document-attach-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
                  <Text style={{ fontFamily: FONT_FAMILY, flex: 1, color: colors.text, fontSize: type.small }}>
                    {loaded.fileName} · made {loaded.exportedAt.slice(0, 10)} · app {loaded.appVersion}
                  </Text>
                </View>
                <SegmentedControl
                  accessibilityLabel="Import mode"
                  value={loaded.plan.mode}
                  onChange={(m) => void setMode(m)}
                  segments={[
                    { value: "merge", label: "Merge (add new)" },
                    { value: "replace", label: "Replace everything" },
                  ]}
                />
                <Text style={{ fontFamily: FONT_FAMILY, color: colors.textMuted, fontSize: type.caption, lineHeight: 17, marginVertical: spacing.md }}>
                  {loaded.plan.mode === "merge" ? DEDUPE_EXPLANATION : "Replace deletes everything on this phone and restores the backup exactly. It happens in one step: if anything fails, nothing changes."}
                </Text>
                <ImportPreview plan={loaded.plan} />
                {button(loaded.plan.mode === "merge" ? "Merge now" : "Replace all data", confirm, loaded.plan.mode === "merge" ? "primary" : "danger", !!loaded.plan.blockedReason, loaded.plan.mode === "merge" ? "git-merge-outline" : "swap-horizontal-outline")}
                {button("Cancel", () => setLoaded(null), "outline")}
              </View>
            ) : null}
          </>,
        )}
      </ScrollView>
    </View>
  );
}
