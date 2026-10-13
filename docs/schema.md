# Meow database schema

Local-only SQLite database `meow.db` (expo-sqlite). No network, no sync.
Schema version is stored in `PRAGMA user_version` (current: **1**). Migrations live in
`src/db/migrations.ts`, run in order at app start, and each one runs inside a transaction:
if it fails, it is rolled back and the version is not bumped. Released migrations are never
edited. Changes always go in a new migration with the next number. If the database is newer
than the app, the app refuses to open it and asks you to update, instead of corrupting it.
`PRAGMA foreign_keys = ON` is set on every open.

## Conventions

- **Money** is `INTEGER` **paise** (Rs 703.50 = `70350`). SQL `CHECK` rejects non-integers and values ≤ 0. Floats are never stored.
- **Expense date** is a plain calendar string `YYYY-MM-DD`, so time zones can never move it. The optional time is stored separately as `HH:MM`.
- **IDs** are unique text IDs (`txn_…`, `cat_…`, `mer_…`, `bud_…`). Starter categories have fixed IDs.
- **created_at / updated_at** are ISO-8601 UTC timestamps on every record. Updates bump `updated_at` only.
- Booleans are stored as `INTEGER` 0/1.

## Status rule (used identically everywhere)

| status | counts as spending? | UI |
| --- | --- | --- |
| `paid` | yes | normal |
| `pending` | yes | "pending" badge |
| `refunded` | **no**, never in any total, chart or budget | still listed |

Defined once in `src/constants/categories.ts` (`COUNTED_STATUSES`, `COUNTED_STATUS_SQL`).

## Tables

### transactions
| column | type | notes |
| --- | --- | --- |
| id | TEXT PK | |
| amount_paise | INTEGER NOT NULL | integer and > 0 (CHECK) |
| description | TEXT NOT NULL DEFAULT '' | max 200 chars (app validation) |
| date | TEXT NOT NULL | `YYYY-MM-DD` (CHECK on shape; app validates real calendar dates, e.g. Feb 29 only in leap years) |
| time | TEXT NULL | `HH:MM` 24h |
| category_id | TEXT NOT NULL | FK → categories.id, ON DELETE RESTRICT |
| merchant_id | TEXT NULL | FK → merchants.id, ON DELETE SET NULL |
| payment_method | TEXT NOT NULL | `cash`, `upi`, `debit_card`, `credit_card`, `bank_transfer`, `other` |
| status | TEXT NOT NULL | `paid`, `pending`, `refunded` |
| notes | TEXT NOT NULL DEFAULT '' | max 1000 chars |
| created_at, updated_at | TEXT NOT NULL | |

Indexes: `date`, `category_id`, `status`.

### categories
| column | type | notes |
| --- | --- | --- |
| id | TEXT PK | |
| name | TEXT NOT NULL | unique (case-insensitive, app validation), max 40 chars |
| color | TEXT NOT NULL | `#RRGGBB` |
| icon | TEXT NOT NULL | Ionicons name |
| is_archived | INTEGER 0/1 | archived = hidden from pickers only |
| sort_order | INTEGER | |
| created_at, updated_at | TEXT NOT NULL | |

Transactions point to a category **by id**, so:
- **Renaming** changes only the display name. Amounts, dates and category links are untouched.
- **Archiving** hides the category from the "add expense" picker. Its past transactions stay
  linked, and they still show in lists, totals, reports and filters. New expenses cannot use an
  archived category, but existing expenses in it can still be edited.
- A category with any transactions **cannot be deleted** (the app refuses, and the FK uses `RESTRICT`).

Starter categories (seeded by migration 1, fixed ids): Shopping, Groceries, Food, Transport,
Bills & Utilities, Electronics, Clothing, Health & Fitness, Pets, Home, Gifts, Travel,
Education, Other. **No sample transactions are ever seeded.**

### merchants
| column | type | notes |
| --- | --- | --- |
| id | TEXT PK | |
| name | TEXT NOT NULL | unique case-insensitive (index on `lower(name)`) |
| created_at, updated_at | TEXT NOT NULL | |

### budgets
| column | type | notes |
| --- | --- | --- |
| id | TEXT PK | |
| scope | TEXT NOT NULL | `overall` or `category` |
| category_id | TEXT NULL | required when scope = category, NULL when overall (CHECK); FK ON DELETE CASCADE |
| monthly_amount_paise | INTEGER NOT NULL | integer > 0 |
| enabled | INTEGER 0/1 | |
| created_at, updated_at | TEXT NOT NULL | |

At most one overall budget and one budget per category (partial unique indexes).
Budget progress uses the same status rule as everything else.

### settings
| column | type | notes |
| --- | --- | --- |
| key | TEXT PK | `theme`, `week_start`, `date_format` |
| value | TEXT NOT NULL | |
| created_at, updated_at | TEXT NOT NULL | |

Allowed values (defaults first): `theme` = system / light / dark, `week_start` = monday / sunday,
`date_format` = `DD MMM YYYY` / `DD/MM/YYYY` / `YYYY-MM-DD`. Unknown or invalid stored values fall back to the default.

## Code map

- `src/db/types.ts`: `SqlDatabase` adapter interface, errors, transaction helper
- `src/db/migrations.ts`: migrations, `initDatabase`
- `src/db/expoAdapter.ts`: expo-sqlite implementation (app)
- `src/db/DatabaseProvider.tsx`: opens the DB at startup, shows loading / error + "Try again"
- `src/repo/*.ts`: repositories (CRUD, search/filter, aggregations)
- `test-utils/nodeDb.ts`: in-memory better-sqlite3 implementation (tests only; real SQL is executed)
