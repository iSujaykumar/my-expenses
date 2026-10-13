import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Largest backup file we will read (protects against picking a huge wrong file). */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

/**
 * Writes text to a file in the app's private cache and opens Android's share sheet,
 * so the user decides where it goes (Drive, email, Files...). Nothing is uploaded by the app.
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

/** Lets the user pick a JSON file; returns its text, or null if they cancelled. */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "application/octet-stream"], copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.size !== undefined && asset.size > MAX_IMPORT_BYTES) throw new Error("That file is too large to be a Meow backup.");
  const text = await new File(asset.uri).text();
  return { name: asset.name, text };
}

/** "meow-backup-2026-10-13-1530.json" */
export function timestampedName(prefix: string, ext: string, now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.${ext}`;
}
