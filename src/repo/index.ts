import { SqlDatabase } from "../db/types";
import { createBudgetRepository } from "./budgets";
import { createCategoryRepository } from "./categories";
import { createMerchantRepository } from "./merchants";
import { createSettingsRepository } from "./settings";
import { createTransactionRepository } from "./transactions";

export function createRepositories(db: SqlDatabase) {
  return {
    categories: createCategoryRepository(db),
    merchants: createMerchantRepository(db),
    transactions: createTransactionRepository(db),
    budgets: createBudgetRepository(db),
    settings: createSettingsRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
