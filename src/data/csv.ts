import { TransactionWithDetails } from "../repo/transactions";

export const CSV_COLUMNS = [
  "id", "date", "time", "amount_rupees", "amount_paise", "description", "category", "merchant",
  "payment_method", "status", "counts_as_spending", "notes", "created_at", "updated_at",
] as const;

/**
 * Quotes a CSV cell when needed (RFC 4180): commas, quotes, line breaks or edge spaces.
 * Text that a spreadsheet would treat as a formula (= + - @ tab) gets a leading apostrophe,
 * so opening the file can never run a formula.
 */
export function escapeCsvCell(value: string, isFreeText = false): string {
  let v = value;
  if (isFreeText && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v) || /^\s|\s$/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Rupees with exactly two decimals, no grouping, computed from integer paise: 70350 -> "703.50". */
export function paiseToCsvRupees(paise: number): string {
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/** Transactions -> CSV text (UTF-8, CRLF line endings, header row). */
export function transactionsToCsv(rows: readonly TransactionWithDetails[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const t of rows) {
    lines.push(
      [
        escapeCsvCell(t.id),
        t.date,
        t.time ?? "",
        paiseToCsvRupees(t.amountPaise),
        String(t.amountPaise),
        escapeCsvCell(t.description, true),
        escapeCsvCell(t.categoryName, true),
        escapeCsvCell(t.merchantName ?? "", true),
        t.paymentMethod,
        t.status,
        t.status === "refunded" ? "no" : "yes",
        escapeCsvCell(t.notes, true),
        t.createdAt,
        t.updatedAt,
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Minimal RFC 4180 parser (used by tests to prove the export round-trips). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
