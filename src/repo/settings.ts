import { SqlDatabase, ValidationError } from "../db/types";
import { nowIso } from "../utils/id";

export const SETTING_OPTIONS = {
  theme: ["system", "light", "dark"],
  week_start: ["monday", "sunday"],
  date_format: ["DD MMM YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
} as const;

export type SettingKey = keyof typeof SETTING_OPTIONS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_OPTIONS)[K][number];
export type AppSettings = { [K in SettingKey]: SettingValue<K> };

const DEFAULTS: AppSettings = { theme: "system", week_start: "monday", date_format: "DD MMM YYYY" };

export function createSettingsRepository(db: SqlDatabase) {
  return {
    /** All settings, falling back to defaults for missing or invalid values. */
    async getAll(): Promise<AppSettings> {
      const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings");
      const result: AppSettings = { ...DEFAULTS };
      for (const { key, value } of rows) {
        if (key in SETTING_OPTIONS) {
          const options = SETTING_OPTIONS[key as SettingKey] as readonly string[];
          if (options.includes(value)) (result as Record<string, string>)[key] = value;
        }
      }
      return result;
    },

    async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
      const options = SETTING_OPTIONS[key] as readonly string[] | undefined;
      if (!options) throw new ValidationError("key", "Unknown setting.");
      if (!options.includes(value)) throw new ValidationError(key, "Invalid value for this setting.");
      const now = nowIso();
      await db.run(
        `INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, now, now],
      );
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
