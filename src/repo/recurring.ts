import { PAYMENT_METHODS, PaymentMethod } from "../constants/categories";
import { SqlDatabase, ValidationError, withTransaction } from "../db/types";
import { dueWindow, Frequency, occurrencesBetween } from "../features/recurring/schedule";
import { isValidDateString } from "../utils/date";
import { newId, nowIso } from "../utils/id";
import { isValidPaise, MAX_AMOUNT_PAISE } from "../utils/money";

export interface RecurringTemplate {
  id: string;
  description: string;
  amountPaise: number;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  merchantId: string | null;
  paymentMethod: PaymentMethod;
  frequency: Frequency;
  startDate: string;
  dayOfMonth: number | null;
  isPaused: boolean;
  notes: string;
}

export interface RecurringInput {
  description: string;
  amountPaise: number;
  categoryId: string;
  merchantId?: string | null;
  paymentMethod: PaymentMethod;
  frequency: Frequency;
  startDate: string;
  /** Monthly only; defaults to the start date's day. */
  dayOfMonth?: number | null;
  notes?: string;
}

export interface DueItem {
  template: RecurringTemplate;
  dueDate: string;
  overdue: boolean;
}

interface Row {
  id: string;
  description: string;
  amount_paise: number;
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  merchant_id: string | null;
  payment_method: PaymentMethod;
  frequency: Frequency;
  start_date: string;
  day_of_month: number | null;
  is_paused: number;
  notes: string;
}

const SELECT = `SELECT r.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM recurring_templates r JOIN categories c ON c.id = r.category_id`;

const toTemplate = (r: Row): RecurringTemplate => ({
  id: r.id,
  description: r.description,
  amountPaise: r.amount_paise,
  categoryId: r.category_id,
  categoryName: r.category_name,
  categoryColor: r.category_color,
  categoryIcon: r.category_icon,
  merchantId: r.merchant_id,
  paymentMethod: r.payment_method,
  frequency: r.frequency,
  startDate: r.start_date,
  dayOfMonth: r.day_of_month,
  isPaused: r.is_paused === 1,
  notes: r.notes,
});

function validate(input: RecurringInput): { dayOfMonth: number | null } {
  if (!input.description || !input.description.trim()) throw new ValidationError("description", "Enter a name, e.g. Rent or Gym.");
  if (!isValidPaise(input.amountPaise)) throw new ValidationError("amount", "Enter an amount above ₹0.");
  if (input.amountPaise > MAX_AMOUNT_PAISE) throw new ValidationError("amount", "That amount is too large.");
  if (!isValidDateString(input.startDate)) throw new ValidationError("startDate", "Pick a valid start date.");
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) throw new ValidationError("paymentMethod", "Pick a payment method.");
  if (input.frequency !== "weekly" && input.frequency !== "monthly") throw new ValidationError("frequency", "Pick weekly or monthly.");
  if (input.frequency === "weekly") return { dayOfMonth: null };
  const dom = input.dayOfMonth ?? Number(input.startDate.slice(8, 10));
  if (!Number.isInteger(dom) || dom < 1 || dom > 31) throw new ValidationError("dayOfMonth", "Day of month must be 1 to 31.");
  return { dayOfMonth: dom };
}

/** Deterministic expense ID for one occurrence, so recording twice can never make two expenses. */
export const occurrenceTransactionId = (templateId: string, dueDate: string) => `rec_${templateId}_${dueDate}`;

export function createRecurringRepository(db: SqlDatabase) {
  const repo = {
    async list(): Promise<RecurringTemplate[]> {
      const rows = await db.all<Row>(`${SELECT} ORDER BY r.is_paused, lower(r.description)`);
      return rows.map(toTemplate);
    },
    async getById(id: string): Promise<RecurringTemplate | null> {
      const row = await db.first<Row>(`${SELECT} WHERE r.id = ?`, [id]);
      return row ? toTemplate(row) : null;
    },
    async create(input: RecurringInput): Promise<RecurringTemplate> {
      const { dayOfMonth } = validate(input);
      const id = newId();
      const now = nowIso();
      await db.run(
        `INSERT INTO recurring_templates (id, description, amount_paise, category_id, merchant_id, payment_method, frequency, start_date, day_of_month, is_paused, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        [id, input.description.trim(), input.amountPaise, input.categoryId, input.merchantId ?? null, input.paymentMethod, input.frequency, input.startDate, dayOfMonth, (input.notes ?? "").trim(), now, now],
      );
      return (await repo.getById(id))!;
    },
    /** Edits apply to future confirmations only; already recorded expenses are not changed. */
    async update(id: string, input: RecurringInput): Promise<RecurringTemplate> {
      const { dayOfMonth } = validate(input);
      const r = await db.run(
        `UPDATE recurring_templates SET description = ?, amount_paise = ?, category_id = ?, merchant_id = ?, payment_method = ?, frequency = ?, start_date = ?, day_of_month = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [input.description.trim(), input.amountPaise, input.categoryId, input.merchantId ?? null, input.paymentMethod, input.frequency, input.startDate, dayOfMonth, (input.notes ?? "").trim(), nowIso(), id],
      );
      if (r.changes === 0) throw new ValidationError("id", "This recurring expense no longer exists.");
      return (await repo.getById(id))!;
    },
    async setPaused(id: string, paused: boolean): Promise<void> {
      await db.run("UPDATE recurring_templates SET is_paused = ?, updated_at = ? WHERE id = ?", [paused ? 1 : 0, nowIso(), id]);
    },
    /** Deletes the template. Expenses it already recorded stay. */
    async delete(id: string): Promise<boolean> {
      const r = await db.run("DELETE FROM recurring_templates WHERE id = ?", [id]);
      return r.changes > 0;
    },
    /** Unhandled occurrences of active templates from 60 days ago to 7 days ahead, soonest first. */
    async due(today: string): Promise<DueItem[]> {
      const { from, to } = dueWindow(today);
      const templates = (await repo.list()).filter((t) => !t.isPaused);
      if (!templates.length) return [];
      const handled = new Set(
        (await db.all<{ template_id: string; due_date: string }>("SELECT template_id, due_date FROM recurring_occurrences WHERE due_date >= ?", [from])).map(
          (o) => `${o.template_id}|${o.due_date}`,
        ),
      );
      const items: DueItem[] = [];
      for (const t of templates) {
        for (const d of occurrencesBetween(t, from, to)) {
          if (!handled.has(`${t.id}|${d}`)) items.push({ template: t, dueDate: d, overdue: d < today });
        }
      }
      return items.sort((a, b) => (a.dueDate === b.dueDate ? a.template.description.localeCompare(b.template.description) : a.dueDate < b.dueDate ? -1 : 1));
    },
    /**
     * Records one occurrence as an expense dated on its due date (status Paid).
     * Idempotent: the (template, due date) pair is the primary key and the expense ID is derived
     * from it, so a double tap or a repeat call returns "already" and adds nothing.
     */
    async confirm(templateId: string, dueDate: string): Promise<"recorded" | "already"> {
      if (!isValidDateString(dueDate)) throw new ValidationError("dueDate", "Invalid due date.");
      return withTransaction(db, async () => {
        const t = await repo.getById(templateId);
        if (!t) throw new ValidationError("id", "This recurring expense no longer exists.");
        const now = nowIso();
        const occ = await db.run(
          "INSERT OR IGNORE INTO recurring_occurrences (template_id, due_date, outcome, transaction_id, created_at) VALUES (?, ?, 'recorded', NULL, ?)",
          [templateId, dueDate, now],
        );
        if (occ.changes === 0) return "already" as const;
        const txId = occurrenceTransactionId(templateId, dueDate);
        const ins = await db.run(
          `INSERT OR IGNORE INTO transactions (id, amount_paise, description, date, time, category_id, merchant_id, payment_method, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'paid', ?, ?, ?)`,
          [txId, t.amountPaise, t.description, dueDate, t.categoryId, t.merchantId, t.paymentMethod, t.notes ? `${t.notes} (recurring)` : "Recurring", now, now],
        );
        if (ins.changes === 1) await db.run("UPDATE recurring_occurrences SET transaction_id = ? WHERE template_id = ? AND due_date = ?", [txId, templateId, dueDate]);
        return "recorded" as const;
      });
    },
    /** Marks an occurrence as skipped so it leaves "Due soon" without recording anything. */
    async skip(templateId: string, dueDate: string): Promise<void> {
      await db.run("INSERT OR IGNORE INTO recurring_occurrences (template_id, due_date, outcome, transaction_id, created_at) VALUES (?, ?, 'skipped', NULL, ?)", [templateId, dueDate, nowIso()]);
    },
  };
  return repo;
}

export type RecurringRepository = ReturnType<typeof createRecurringRepository>;
