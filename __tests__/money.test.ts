import { formatPaise, groupIndian, isValidPaise, MAX_AMOUNT_PAISE, paiseToInputString, parseRupeesToPaise, sumPaise } from "../src/utils/money";

const ok = (text: string) => {
  const r = parseRupeesToPaise(text);
  if (!r.ok) throw new Error(`expected ok for "${text}": ${r.error}`);
  return r.paise;
};
const err = (text: string) => {
  const r = parseRupeesToPaise(text);
  if (r.ok) throw new Error(`expected error for "${text}"`);
  return r.error;
};

describe("parseRupeesToPaise", () => {
  it("parses whole, 1 and 2 decimal amounts exactly", () => {
    expect(ok("703.50")).toBe(70350);
    expect(ok("703.5")).toBe(70350);
    expect(ok("703")).toBe(70300);
    expect(ok("0.01")).toBe(1);
    expect(ok(".5")).toBe(50);
    expect(ok("12.")).toBe(1200);
  });
  it("accepts Indian commas, spaces and a Rs/₹ prefix", () => {
    expect(ok("1,24,56,789.99")).toBe(1245678999);
    expect(ok("Rs 250")).toBe(25000);
    expect(ok("rs. 99.9")).toBe(9990);
    expect(ok("₹1,000")).toBe(100000);
    expect(ok("  42  ")).toBe(4200);
  });
  it("avoids float errors: 0.1 + 0.2 is exactly 30 paise", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the float problem we avoid
    expect(ok("0.1") + ok("0.2")).toBe(30);
    expect(formatPaise(ok("0.1") + ok("0.2"))).toBe("Rs 0.30");
    // the float result itself has too many decimals and is rejected
    expect(err(String(0.1 + 0.2))).toMatch(/2 decimal/);
    expect(ok("1.15")).toBe(115);
    expect(ok("4.35")).toBe(435);
    expect(ok("19.99") * 3).toBe(5997);
  });
  it("rejects empty, zero, negative, >2 decimals, junk and huge amounts", () => {
    expect(err("")).toMatch(/Enter an amount/);
    expect(err("   ")).toMatch(/Enter an amount/);
    expect(err("0")).toMatch(/more than zero/);
    expect(err("0.00")).toMatch(/more than zero/);
    expect(err("-5")).toMatch(/more than zero/);
    expect(err("1.234")).toMatch(/2 decimal/);
    expect(err("abc")).toMatch(/valid number/);
    expect(err("1.2.3")).toMatch(/valid number/);
    expect(err("1e5")).toMatch(/valid number/);
    expect(err(".")).toMatch(/valid number/);
    expect(err("100000001")).toMatch(/too large/);
    expect(err("99999999999999999999")).toMatch(/too large/);
  });
  it("accepts the maximum and rejects one paisa more", () => {
    expect(ok("10,00,00,000")).toBe(MAX_AMOUNT_PAISE);
    expect(err("100000000.01")).toMatch(/too large/);
  });
});

describe("formatPaise (Indian format)", () => {
  it("formats Rs 1,24,56,789.99", () => {
    expect(formatPaise(1245678999)).toBe("Rs 1,24,56,789.99");
  });
  it("handles small, round and boundary values", () => {
    expect(formatPaise(0)).toBe("Rs 0.00");
    expect(formatPaise(1)).toBe("Rs 0.01");
    expect(formatPaise(70350)).toBe("Rs 703.50");
    expect(formatPaise(99999)).toBe("Rs 999.99");
    expect(formatPaise(100000)).toBe("Rs 1,000.00");
    expect(formatPaise(12345600)).toBe("Rs 1,23,456.00");
    expect(formatPaise(10000000000)).toBe("Rs 10,00,00,000.00");
    expect(formatPaise(-250050)).toBe("-Rs 2,500.50");
    expect(formatPaise(100000, { hideZeroPaise: true })).toBe("Rs 1,000");
    expect(formatPaise(100050, { symbol: "₹" })).toBe("₹ 1,000.50");
  });
  it("refuses non-integer paise", () => {
    expect(() => formatPaise(1.5)).toThrow(RangeError);
  });
  it("groups digits the Indian way", () => {
    expect(groupIndian("1")).toBe("1");
    expect(groupIndian("123")).toBe("123");
    expect(groupIndian("1234")).toBe("1,234");
    expect(groupIndian("123456")).toBe("1,23,456");
    expect(groupIndian("1234567")).toBe("12,34,567");
  });
});

describe("other money helpers", () => {
  it("round-trips to editable text", () => {
    expect(paiseToInputString(70350)).toBe("703.50");
    expect(ok(paiseToInputString(1245678999))).toBe(1245678999);
  });
  it("validates stored paise", () => {
    expect(isValidPaise(1)).toBe(true);
    expect(isValidPaise(0)).toBe(false);
    expect(isValidPaise(-1)).toBe(false);
    expect(isValidPaise(1.5)).toBe(false);
    expect(isValidPaise(MAX_AMOUNT_PAISE + 1)).toBe(false);
    expect(isValidPaise("100")).toBe(false);
  });
  it("sums integers exactly and refuses floats", () => {
    expect(sumPaise([10, 20, 30])).toBe(60);
    expect(() => sumPaise([0.1, 0.2])).toThrow(RangeError);
  });
});
