export type AccountType = "german-bank-giro";
export type TransactionTag = "Fixed" | "Variable" | "Saving";
export type RuleSource = "manual" | "user-rule" | "built-in" | "fallback";

export interface Transaction {
  id: string;
  accountId: string;
  accountType: AccountType;
  bookingDate: string;
  valueDate?: string;
  description: string;
  normalizedDescription: string;
  amount: number;
  currency: "EUR";
  category: string;
  tag: TransactionTag;
  categoryOverride?: string;
  tagOverride?: TransactionTag;
  ruleSource: RuleSource;
  sourceFileId: string;
  sourceFileName: string;
  importBatchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySummary {
  monthKey: string;
  accountId: string;
  income: number;
  expense: number;
  netTransactionBased: number;
  netBalanceBased?: number;
  openingBalance?: number;
  closingBalance?: number;
  openingDate?: string;
  closingDate?: string;
  hasBalanceMismatch: boolean;
  balanceMismatchAmount?: number;
  isBalanceManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImportFileRecord {
  sourceFileId: string;
  fileName: string;
  fileHash: string;
  statementMonthGuess?: string;
  importedAt: string;
  parserVersion: string;
  parseStatus: "ok" | "warning" | "failed";
  warningCount: number;
}

export interface Rule {
  id: string;
  name: string;
  matchType: "contains" | "regex" | "exact";
  pattern: string;
  category: string;
  defaultTag: TransactionTag;
  priority: number;
  isBuiltIn: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualBalanceOverride {
  id: string;
  accountId: string;
  monthKey: string;
  openingBalance?: number;
  closingBalance?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  currency: "EUR";
  dateFormat: "DD.MM.YYYY";
  locale: string;
  parserNormalizationOptions: {
    normalizeUmlauts: boolean;
    collapseWhitespace: boolean;
  };
  mismatchTolerance: number;
  categoryTagMapping: Record<string, TransactionTag>;
}
