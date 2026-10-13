/**
 * Money helpers. Money is ALWAYS stored as integer paise (Rs 703.50 = 70350).
 * Parsing works on the text digits, never through floating point.
 */

/** Largest single amount accepted: Rs 10,00,00,000.00 (10 crore). */
export const MAX_AMOUNT_PAISE = 10_000_000_000;

export type ParseResult = { ok: true; paise: number } | { ok: false; error: string };

/**
 * Parses user text like "703.5", "1,24,567.89", "Rs 250" or "₹ 99" into paise.
 * Rejects empty, zero, negative, more than 2 decimals, and absurdly large amounts.
 */
export function parseRupeesToPaise(input: string): ParseResult {
  if (typeof input !== "string") return { ok: false, error: "Enter an amount." };
  let text = input.trim().replace(/^(rs\.?|inr|₹)\s*/i, "").replace(/[,\s]/g, "");
  if (text === "") return { ok: false, error: "Enter an amount." };
  if (text.startsWith("-")) return { ok: false, error: "Amount must be more than zero." };
  if (text.startsWith("+")) text = text.slice(1);
  if (!/^\d*\.?\d*$/.test(text) || text === ".") return { ok: false, error: "Enter a valid number, like 250 or 99.50." };
  const [whole = "", frac = ""] = text.split(".");
  if (frac.length > 2) return { ok: false, error: "Use at most 2 decimal places (paise)." };
  const wholeDigits = whole.replace(/^0+(?=\d)/, "") || "0";
  if (wholeDigits.length > 9) return { ok: false, error: "That amount is too large." };
  const paise = Number(wholeDigits) * 100 + Number(frac.padEnd(2, "0"));
  if (paise <= 0) return { ok: false, error: "Amount must be more than zero." };
  if (paise > MAX_AMOUNT_PAISE) return { ok: false, error: "That amount is too large." };
  return { ok: true, paise };
}

/** True when value is a valid stored amount: a positive safe integer within the limit. */
export function isValidPaise(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT_PAISE;
}

/** Groups an integer-digit string the Indian way: 12456789 -> 1,24,56,789. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

export interface FormatOptions {
  /** Prefix symbol, default "Rs". */
  symbol?: string;
  /** Hide ".00" for whole rupees. Default false. */
  hideZeroPaise?: boolean;
}

/** Formats paise as Indian rupees: 1245678999 -> "Rs 1,24,56,789.99". Works for 0 and negatives (differences). */
export function formatPaise(paise: number, options: FormatOptions = {}): string {
  if (!Number.isSafeInteger(paise)) throw new RangeError("formatPaise expects integer paise");
  const symbol = options.symbol ?? "Rs";
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  let text = groupIndian(String(rupees));
  if (!(options.hideZeroPaise && rem === 0)) text += `.${String(rem).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${symbol ? `${symbol} ` : ""}${text}`;
}

/** Converts paise to an editable plain string: 70350 -> "703.50". */
export function paiseToInputString(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new RangeError("paiseToInputString expects integer paise");
  const abs = Math.abs(paise);
  return `${paise < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Sums integer paise values exactly. */
export function sumPaise(values: readonly number[]): number {
  let total = 0;
  for (const v of values) {
    if (!Number.isSafeInteger(v)) throw new RangeError("sumPaise expects integer paise");
    total += v;
  }
  return total;
}
