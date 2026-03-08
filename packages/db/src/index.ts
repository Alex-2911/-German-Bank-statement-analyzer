import Database from "better-sqlite3";
import type { ImportFileRecord, MonthlySummary, Rule, Transaction } from "@german-bank/shared-types";

export function createDatabase(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_files (
      sourceFileId TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      fileHash TEXT NOT NULL,
      statementMonthGuess TEXT,
      importedAt TEXT NOT NULL,
      parserVersion TEXT NOT NULL,
      parseStatus TEXT NOT NULL,
      warningCount INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      accountType TEXT NOT NULL,
      bookingDate TEXT NOT NULL,
      valueDate TEXT,
      description TEXT NOT NULL,
      normalizedDescription TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      category TEXT NOT NULL,
      tag TEXT NOT NULL,
      categoryOverride TEXT,
      tagOverride TEXT,
      ruleSource TEXT NOT NULL,
      sourceFileId TEXT NOT NULL,
      sourceFileName TEXT NOT NULL,
      importBatchId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_summaries (
      monthKey TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      income REAL NOT NULL,
      expense REAL NOT NULL,
      netTransactionBased REAL NOT NULL,
      netBalanceBased REAL,
      openingBalance REAL,
      closingBalance REAL,
      openingDate TEXT,
      closingDate TEXT,
      hasBalanceMismatch INTEGER NOT NULL,
      balanceMismatchAmount REAL,
      isBalanceManualOverride INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      matchType TEXT NOT NULL,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      defaultTag TEXT NOT NULL,
      priority INTEGER NOT NULL,
      isBuiltIn INTEGER NOT NULL,
      isEnabled INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  return {
    db,
    upsertImportFile(file: ImportFileRecord) {
      db.prepare(`INSERT OR REPLACE INTO import_files VALUES (@sourceFileId,@fileName,@fileHash,@statementMonthGuess,@importedAt,@parserVersion,@parseStatus,@warningCount)`).run(file);
    },
    replaceTransactionsForFile(sourceFileId: string, rows: Transaction[]) {
      db.prepare("DELETE FROM transactions WHERE sourceFileId = ?").run(sourceFileId);
      const insert = db.prepare(`INSERT OR REPLACE INTO transactions VALUES (@id,@accountId,@accountType,@bookingDate,@valueDate,@description,@normalizedDescription,@amount,@currency,@category,@tag,@categoryOverride,@tagOverride,@ruleSource,@sourceFileId,@sourceFileName,@importBatchId,@createdAt,@updatedAt)`);
      const tx = db.transaction((items: Transaction[]) => items.forEach((item) => insert.run(item)));
      tx(rows);
    },
    listTransactions(): Transaction[] {
      return db.prepare("SELECT * FROM transactions ORDER BY bookingDate DESC").all() as Transaction[];
    },
    upsertSummary(summary: MonthlySummary) {
      db.prepare(`INSERT OR REPLACE INTO monthly_summaries VALUES (@monthKey,@accountId,@income,@expense,@netTransactionBased,@netBalanceBased,@openingBalance,@closingBalance,@openingDate,@closingDate,@hasBalanceMismatch,@balanceMismatchAmount,@isBalanceManualOverride,@createdAt,@updatedAt)`).run({
        ...summary,
        hasBalanceMismatch: Number(summary.hasBalanceMismatch),
        isBalanceManualOverride: Number(summary.isBalanceManualOverride)
      });
    },
    listSummaries(): MonthlySummary[] {
      return db.prepare("SELECT * FROM monthly_summaries ORDER BY monthKey DESC").all().map((row: any) => ({
        ...row,
        hasBalanceMismatch: Boolean(row.hasBalanceMismatch),
        isBalanceManualOverride: Boolean(row.isBalanceManualOverride)
      })) as MonthlySummary[];
    },
    saveRule(rule: Rule) {
      db.prepare(`INSERT OR REPLACE INTO rules VALUES (@id,@name,@matchType,@pattern,@category,@defaultTag,@priority,@isBuiltIn,@isEnabled,@createdAt,@updatedAt)`).run({
        ...rule,
        isBuiltIn: Number(rule.isBuiltIn),
        isEnabled: Number(rule.isEnabled)
      });
    },
    listUserRules(): Rule[] {
      return db.prepare("SELECT * FROM rules WHERE isBuiltIn = 0 ORDER BY priority ASC").all().map((row: any) => ({
        ...row,
        isBuiltIn: Boolean(row.isBuiltIn),
        isEnabled: Boolean(row.isEnabled)
      }));
    }
  };
}
