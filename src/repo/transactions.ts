import {
  COUNTED_STATUS_SQL,
  PAYMENT_METHODS,
  PaymentMethod,
  STATUSES,
  TransactionStatus,
} from "../constants/categories";
import { SqlDatabase, SqlParams, ValidationError } from "../db/types";
import { DateRange, isValidDateString, isValidTimeString, monthKey, YearMonth, addMonths } from "../utils/date";
import { newId, nowIso } from "../utils/id";
import { isValidPaise, MAX_AMOUNT_PAISE } from "../utils/money";
import { escapeLike } from "./merchants";

export interface Transaction {
  id: string;
  amountPaise: number;
  description: string;
  date: string;
  time: string | null;
  categoryId: string;
  merchantId: string | null;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Transaction joined with display info (category + merchant names). */
export interface TransactionWithDetails extends Transaction {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  categoryArchived: boolean;
  merchantName: string | null;
}

export interface TransactionInput {
  amountPaise: number;
  description?: string;
  date: string;
  time?: string | null;
  categoryId: string;
  merchantId?: string | null;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes?: string;
}

export interface TransactionFilter {
  range?: DateRange;
  categoryIds?: string[];
  statuses?: TransactionStatus[];
  paymentMethods?: PaymentMethod[];
  merchantId?: string;
  merchantIds?: string[];
  /** Text search in description, notes and merchant name (case-insensitive). */
  search?: string;
  minPaise?: number;
  maxPaise?: number;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  limit?: number;
  offset?: number;
}

interface Row {
  id: string;
  amount_paise: number;
  description: string;
  date: string;
  time: string | null;
  category_id: string;
  merchant_id: string | null;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  category_archived: number;
  merchant_name: string | null;
}

const toTx = (r: Row): TransactionWithDetails => ({
  id: r.id,
  amountPaise: r.amount_paise,
  description: r.description,
  date: r.date,
  time: r.time,
  categoryId: r.category_id,
  merchantId: r.merchant_id,
  paymentMethod: r.payment_method,
  status: r.status,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  categoryName: r.category_name,
  categoryColor: r.category_color,
  categoryIcon: r.category_icon,
  categoryArchived: r.category_archived === 1,
  merchantName: r.merchant_name,
});

const SELECT_DETAILS = `
SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
       c.is_archived AS category_archived, m.name AS merchant_name
FROM transactions t
JOIN categories c ON c.id = t.category_id
LEFT JOIN merchants m ON m.id = t.merchant_id`;

const SORTS: Record<NonNullable<TransactionFilter["sort"]>, string> = {
  date_desc: "t.date DESC, t.time DESC, t.created_at DESC",
  date_asc: "t.date ASC, t.time ASC, t.created_at ASC",
  amount_desc: "t.amount_paise DESC, t.date DESC",
  amount_asc: "t.amount_paise ASC, t.date DESC",
};

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

/** Builds a WHERE clause (on alias t / m) from a filter. */
function buildWhere(filter: TransactionFilter): { sql: string; params: SqlParams } {
  const parts: string[] = [];
  const params: SqlParams = [];
  if (filter.range) {
    parts.push("t.date BETWEEN ? AND ?");
    params.push(filter.range.start, filter.range.end);
  }
  if (filter.categoryIds?.length) {
    parts.push(`t.category_id IN (${placeholders(filter.categoryIds.length)})`);
    params.push(...filter.categoryIds);
  }
  if (filter.statuses?.length) {
    parts.push(`t.status IN (${placeholders(filter.statuses.length)})`);
    params.push(...filter.statuses);
  }
  if (filter.paymentMethods?.length) {
    parts.push(`t.payment_method IN (${placeholders(filter.paymentMethods.length)})`);
    params.push(...filter.paymentMethods);
  }
  if (filter.merchantId) {
    parts.push("t.merchant_id = ?");
    params.push(filter.merchantId);
  }
  if (filter.merchantIds?.length) {
    parts.push(`t.merchant_id IN (${placeholders(filter.merchantIds.length)})`);
    params.push(...filter.merchantIds);
  }
  const search = filter.search?.trim();
  if (search) {
    const like = `%${escapeLike(search)}%`;
    parts.push("(t.description LIKE ? ESCAPE '\\' OR t.notes LIKE ? ESCAPE '\\' OR m.name LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  if (filter.minPaise !== undefined) {
    parts.push("t.amount_paise >= ?");
    params.push(filter.minPaise);
  }
  if (filter.maxPaise !== undefined) {
    parts.push("t.amount_paise <= ?");
    params.push(filter.maxPaise);
  }
  return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  totalPaise: number;
  count: number;
}

export interface MonthTotal {
  month: string; // YYYY-MM
  totalPaise: number;
  count: number;
}

export interface SpendingSummary {
  totalPaise: number;
  count: number;
  paidPaise: number;
  pendingPaise: number;
  pendingCount: number;
  refundedPaise: number;
  refundedCount: number;
}

/** Hard cap for one list query (History loads all matches up to this). */
export const MAX_LIST_LIMIT = 50000;

export function createTransactionRepository(db: SqlDatabase) {
  async function validate(input: TransactionInput, existing?: Transaction): Promise<Required<TransactionInput>> {
    if (!isValidPaise(input.amountPaise)) {
      throw new ValidationError(
        "amountPaise",
        input.amountPaise > MAX_AMOUNT_PAISE ? "That amount is too large." : "Amount must be more than zero.",
      );
    }
    if (!isValidDateString(input.date)) throw new ValidationError("date", "Pick a valid date.");
    const time = input.time ?? null;
    if (time !== null && !isValidTimeString(time)) throw new ValidationError("time", "Time must be HH:MM.");
    if (!PAYMENT_METHODS.includes(input.paymentMethod)) throw new ValidationError("paymentMethod", "Pick a payment method.");
    if (!STATUSES.includes(input.status)) throw new ValidationError("status", "Pick a status.");
    const description = (input.description ?? "").trim();
    if (description.length > 200) throw new ValidationError("description", "Description must be 200 characters or fewer.");
    const notes = (input.notes ?? "").trim();
    if (notes.length > 1000) throw new ValidationError("notes", "Notes must be 1000 characters or fewer.");
    const cat = await db.first<{ is_archived: number }>("SELECT is_archived FROM categories WHERE id = ?", [input.categoryId]);
    if (!cat) throw new ValidationError("categoryId", "Pick a category.");
    // New expenses can't go into archived categories; existing ones may keep theirs.
    if (cat.is_archived === 1 && existing?.categoryId !== input.categoryId) {
      throw new ValidationError("categoryId", "This category is archived. Pick another one.");
    }
    const merchantId = input.merchantId ?? null;
    if (merchantId !== null) {
      const m = await db.first<{ id: string }>("SELECT id FROM merchants WHERE id = ?", [merchantId]);
      if (!m) throw new ValidationError("merchantId", "Merchant not found.");
    }
    return {
      amountPaise: input.amountPaise,
      description,
      date: input.date,
      time,
      categoryId: input.categoryId,
      merchantId,
      paymentMethod: input.paymentMethod,
      status: input.status,
      notes,
    };
  }

  const repo = {
    async getById(id: string): Promise<TransactionWithDetails | null> {
      const row = await db.first<Row>(`${SELECT_DETAILS} WHERE t.id = ?`, [id]);
      return row ? toTx(row) : null;
    },

    async create(input: TransactionInput): Promise<TransactionWithDetails> {
      const v = await validate(input);
      const now = nowIso();
      const id = newId("txn_");
      await db.run(
        `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id,
           payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, v.amountPaise, v.description, v.date, v.time, v.categoryId, v.merchantId, v.paymentMethod, v.status, v.notes, now, now],
      );
      return (await repo.getById(id)) as TransactionWithDetails;
    },

    async update(id: string, patch: Partial<TransactionInput>): Promise<TransactionWithDetails> {
      const existing = await repo.getById(id);
      if (!existing) throw new ValidationError("id", "Expense not found.");
      const v = await validate({ ...existing, ...patch }, existing);
      await db.run(
        `UPDATE transactions SET amount_paise = ?, description = ?, date = ?, time = ?, category_id = ?,
           merchant_id = ?, payment_method = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [v.amountPaise, v.description, v.date, v.time, v.categoryId, v.merchantId, v.paymentMethod, v.status, v.notes, nowIso(), id],
      );
      return (await repo.getById(id)) as TransactionWithDetails;
    },

    /**
     * Re-inserts a previously deleted record exactly as it was (same id, created_at, updated_at).
     * Used by "Undo" after delete.
     */
    async restore(t: Transaction): Promise<TransactionWithDetails> {
      if (!isValidPaise(t.amountPaise) || !isValidDateString(t.date)) throw new ValidationError("id", "Cannot restore this expense.");
      await db.run(
        `INSERT INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id,
           payment_method, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.amountPaise, t.description, t.date, t.time, t.categoryId, t.merchantId, t.paymentMethod, t.status, t.notes, t.createdAt, t.updatedAt],
      );
      return (await repo.getById(t.id)) as TransactionWithDetails;
    },

    async delete(id: string): Promise<boolean> {
      const r = await db.run("DELETE FROM transactions WHERE id = ?", [id]);
      return r.changes > 0;
    },

    /** List / search / filter. Shows ALL statuses unless filtered (refunded rows are visible, just never counted). */
    async list(filter: TransactionFilter = {}): Promise<TransactionWithDetails[]> {
      const { sql, params } = buildWhere(filter);
      const limit = Math.max(1, Math.min(filter.limit ?? 500, MAX_LIST_LIMIT));
      const offset = Math.max(0, filter.offset ?? 0);
      const rows = await db.all<Row>(
        `${SELECT_DETAILS} ${sql} ORDER BY ${SORTS[filter.sort ?? "date_desc"]} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return rows.map(toTx);
    },

    async count(filter: TransactionFilter = {}): Promise<number> {
      const { sql, params } = buildWhere(filter);
      const row = await db.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id ${sql}`,
        params,
      );
      return row?.n ?? 0;
    },

    /** Spending summary for a filter. totalPaise follows the status rule (paid + pending; refunded excluded). */
    async summary(filter: TransactionFilter = {}): Promise<SpendingSummary> {
      const { sql, params } = buildWhere(filter);
      const row = await db.first<{
        total: number | null; cnt: number | null; paid: number | null; pending: number | null;
        pending_cnt: number | null; refunded: number | null; refunded_cnt: number | null;
      }>(
        `SELECT
           SUM(CASE WHEN t.${COUNTED_STATUS_SQL} THEN t.amount_paise ELSE 0 END) AS total,
           SUM(CASE WHEN t.${COUNTED_STATUS_SQL} THEN 1 ELSE 0 END) AS cnt,
           SUM(CASE WHEN t.status = 'paid' THEN t.amount_paise ELSE 0 END) AS paid,
           SUM(CASE WHEN t.status = 'pending' THEN t.amount_paise ELSE 0 END) AS pending,
           SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_cnt,
           SUM(CASE WHEN t.status = 'refunded' THEN t.amount_paise ELSE 0 END) AS refunded,
           SUM(CASE WHEN t.status = 'refunded' THEN 1 ELSE 0 END) AS refunded_cnt
         FROM transactions t LEFT JOIN merchants m ON m.id = t.merchant_id ${sql}`,
        params,
      );
      return {
        totalPaise: row?.total ?? 0,
        count: row?.cnt ?? 0,
        paidPaise: row?.paid ?? 0,
        pendingPaise: row?.pending ?? 0,
        pendingCount: row?.pending_cnt ?? 0,
        refundedPaise: row?.refunded ?? 0,
        refundedCount: row?.refunded_cnt ?? 0,
      };
    },

    /** Total spending (paid + pending) in a date range. */
    async totalSpending(range: DateRange): Promise<number> {
      return (await repo.summary({ range })).totalPaise;
    },

    /** Spending per category, largest first. Archived categories still appear with their history. */
    async totalsByCategory(range: DateRange): Promise<CategoryTotal[]> {
      const rows = await db.all<{
        category_id: string; name: string; color: string; icon: string; is_archived: number; total: number; cnt: number;
      }>(
        `SELECT t.category_id, c.name, c.color, c.icon, c.is_archived, SUM(t.amount_paise) AS total, COUNT(*) AS cnt
         FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.date BETWEEN ? AND ? AND t.${COUNTED_STATUS_SQL}
         GROUP BY t.category_id ORDER BY total DESC, c.name`,
        [range.start, range.end],
      );
      return rows.map((r) => ({
        categoryId: r.category_id, name: r.name, color: r.color, icon: r.icon,
        isArchived: r.is_archived === 1, totalPaise: r.total, count: r.cnt,
      }));
    },

    /** Spending for each of `count` months ending at `last` (inclusive), oldest first; months with nothing are 0. */
    async totalsByMonth(last: YearMonth, count = 12): Promise<MonthTotal[]> {
      const first = addMonths(last, -(count - 1));
      const start = `${monthKey(first)}-01`;
      const end = `${monthKey(last)}-31`;
      const rows = await db.all<{ month: string; total: number; cnt: number }>(
        `SELECT substr(date, 1, 7) AS month, SUM(amount_paise) AS total, COUNT(*) AS cnt
         FROM transactions WHERE date BETWEEN ? AND ? AND ${COUNTED_STATUS_SQL}
         GROUP BY month`,
        [start, end],
      );
      const byMonth = new Map(rows.map((r) => [r.month, r]));
      return Array.from({ length: count }, (_, i) => {
        const key = monthKey(addMonths(first, i));
        const r = byMonth.get(key);
        return { month: key, totalPaise: r?.total ?? 0, count: r?.cnt ?? 0 };
      });
    },

    /** Spending per day in a range (only days that have spending). */
    async totalsByDay(range: DateRange): Promise<{ date: string; totalPaise: number }[]> {
      const rows = await db.all<{ date: string; total: number }>(
        `SELECT date, SUM(amount_paise) AS total FROM transactions
         WHERE date BETWEEN ? AND ? AND ${COUNTED_STATUS_SQL} GROUP BY date ORDER BY date`,
        [range.start, range.end],
      );
      return rows.map((r) => ({ date: r.date, totalPaise: r.total }));
    },

    async totalsByPaymentMethod(range: DateRange): Promise<{ paymentMethod: PaymentMethod; totalPaise: number; count: number }[]> {
      const rows = await db.all<{ payment_method: PaymentMethod; total: number; cnt: number }>(
        `SELECT payment_method, SUM(amount_paise) AS total, COUNT(*) AS cnt FROM transactions
         WHERE date BETWEEN ? AND ? AND ${COUNTED_STATUS_SQL} GROUP BY payment_method ORDER BY total DESC`,
        [range.start, range.end],
      );
      return rows.map((r) => ({ paymentMethod: r.payment_method, totalPaise: r.total, count: r.cnt }));
    },

    async totalsByMerchant(range: DateRange, limit = 10): Promise<{ merchantId: string; name: string; totalPaise: number; count: number }[]> {
      const rows = await db.all<{ merchant_id: string; name: string; total: number; cnt: number }>(
        `SELECT t.merchant_id, m.name, SUM(t.amount_paise) AS total, COUNT(*) AS cnt
         FROM transactions t JOIN merchants m ON m.id = t.merchant_id
         WHERE t.date BETWEEN ? AND ? AND t.${COUNTED_STATUS_SQL}
         GROUP BY t.merchant_id ORDER BY total DESC LIMIT ?`,
        [range.start, range.end, limit],
      );
      return rows.map((r) => ({ merchantId: r.merchant_id, name: r.name, totalPaise: r.total, count: r.cnt }));
    },
  };
  return repo;
}

export type TransactionRepository = ReturnType<typeof createTransactionRepository>;
