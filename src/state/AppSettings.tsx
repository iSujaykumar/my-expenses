import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useRepositories } from "../db/DatabaseProvider";
import { AppSettings, SettingKey, SettingValue } from "../repo/settings";
import { formatDisplayDate } from "../utils/date";
import { subscribeDataChanged } from "./dataEvents";

export const DEFAULT_APP_SETTINGS: AppSettings = { theme: "system", week_start: "monday", date_format: "DD MMM YYYY" };

interface AppSettingsContextValue {
  settings: AppSettings;
  setSetting: <K extends SettingKey>(key: K, value: SettingValue<K>) => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_APP_SETTINGS,
  setSetting: async () => {},
});

/** Loads saved settings (theme, week start, date format) and shares them app-wide. */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const repos = useRepositories();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      repos.settings
        .getAll()
        .then((s) => !cancelled && setSettings(s))
        .catch(() => {});
    load();
    // Reload after import / reset, which can change settings.
    const unsubscribe = subscribeDataChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [repos]);

  const setSetting = useCallback(
    async <K extends SettingKey>(key: K, value: SettingValue<K>) => {
      await repos.settings.set(key, value);
      setSettings((s) => ({ ...s, [key]: value }));
    },
    [repos],
  );

  const value = useMemo(() => ({ settings, setSetting }), [settings, setSetting]);
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

/** Date formatter that follows the user's date format setting. */
export function useFormatDate(): (date: string) => string {
  const { settings } = useAppSettings();
  return useCallback((date: string) => formatDisplayDate(date, settings.date_format), [settings.date_format]);
}
