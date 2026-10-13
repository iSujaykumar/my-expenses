import { SqlDatabase } from "../db/types";
import { createBudgetRepository } from "./budgets";
import { createCategoryRepository } from "./categories";
import { createMerchantRepository } from "./merchants";
import { createRecurringRepository } from "./recurring";
import { createSettingsRepository } from "./settings";
import { createTransactionRepository } from "./transactions";

export function createRepositories(db: SqlDatabase) {
  return {
    /** Raw database, for whole-database operations (backup, restore, reset). */
    db,
    categories: createCategoryRepository(db),
    merchants: createMerchantRepository(db),
    transactions: createTransactionRepository(db),
    budgets: createBudgetRepository(db),
    settings: createSettingsRepository(db),
    recurring: createRecurringRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
