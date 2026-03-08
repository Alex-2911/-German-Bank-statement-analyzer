import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import pdf from "pdf-parse";
import { createDatabase } from "@german-bank/db";
import { GenericGermanGiroParser } from "@german-bank/parser";
import { applyRules } from "@german-bank/rules";

const parser = new GenericGermanGiroParser();

const defaultMapping = {
  Other: "Variable",
  "Real estate": "Fixed",
  Transport: "Variable",
  Saving: "Saving",
  Subscriptions: "Variable",
  Sport: "Variable",
  Cash: "Variable"
};

let store;

function computeMonthSummary(transactions, openingBalance, closingBalance) {
  const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const netTransactionBased = income - expense;
  const netBalanceBased = openingBalance !== undefined && closingBalance !== undefined ? closingBalance - openingBalance : undefined;
  const mismatch = netBalanceBased !== undefined ? netTransactionBased - netBalanceBased : 0;
  const monthKey = transactions[0]?.bookingDate?.split(".").reverse().slice(0, 2).join("-") ?? new Date().toISOString().slice(0, 7);
  const now = new Date().toISOString();

  return {
    monthKey,
    accountId: "default-giro",
    income,
    expense,
    netTransactionBased,
    netBalanceBased,
    openingBalance,
    closingBalance,
    hasBalanceMismatch: Math.abs(mismatch) > 0.01,
    balanceMismatchAmount: netBalanceBased !== undefined ? mismatch : undefined,
    isBalanceManualOverride: false,
    createdAt: now,
    updatedAt: now
  };
}

async function importTextAsStatement({ text, fileName, sourceFileId, fileHash }) {
  const importBatchId = crypto.randomUUID();
  const parsed = parser.parseText(text, fileName, importBatchId, sourceFileId);
  const userRules = store.listUserRules();
  const hydrated = parser.hydrateTransactionIds(parsed.transactions).map((tx) => {
    const decision = applyRules(tx, userRules, defaultMapping);
    return { ...tx, ...decision };
  });

  store.replaceTransactionsForFile(sourceFileId, hydrated);
  const summary = computeMonthSummary(hydrated, parsed.openingBalance, parsed.closingBalance);
  if (!(summary.income === 0 && summary.expense === 0 && summary.netTransactionBased === 0)) {
    store.upsertSummary(summary);
  }

  store.upsertImportFile({
    sourceFileId,
    fileName,
    fileHash,
    statementMonthGuess: summary.monthKey,
    importedAt: new Date().toISOString(),
    parserVersion: "0.1.0",
    parseStatus: parsed.warnings.length ? "warning" : "ok",
    warningCount: parsed.warnings.length
  });

  return { warnings: parsed.warnings, inserted: hydrated.length };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    webPreferences: {
      preload: path.join(app.getAppPath(), "src/preload/preload.mjs")
    }
  });

  win.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath("userData"), "german-bank-statement-analyzer.db");
  store = createDatabase(dbPath);

  ipcMain.handle("app:dbPath", () => dbPath);
  ipcMain.handle("data:transactions", () => store.listTransactions());
  ipcMain.handle("data:summaries", () => store.listSummaries());
  ipcMain.handle("data:rules", () => store.listUserRules());
  ipcMain.handle("rule:save", (_event, rule) => store.saveRule(rule));

  ipcMain.handle("import:pdf", async () => {
    const selected = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (selected.canceled) return [];
    const results = [];
    for (const filePath of selected.filePaths) {
      const fileBuffer = fs.readFileSync(filePath);
      const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      const sourceFileId = fileHash.slice(0, 24);
      let extractedText = "";
      try {
        const parsedPdf = await pdf(fileBuffer);
        extractedText = parsedPdf.text ?? "";
      } catch {
        extractedText = "";
      }
      const outcome = await importTextAsStatement({
        text: extractedText,
        fileName: path.basename(filePath),
        sourceFileId,
        fileHash
      });
      results.push({ fileName: path.basename(filePath), ...outcome });
    }
    return results;
  });

  ipcMain.handle("import:synthetic", async () => {
    const synthetic = `Opening Balance: 1.000,00\n01.01.2026 01.01.2026 Salary Demo 2.500,00\n03.01.2026 03.01.2026 Dauerauftrag WEG -850,00\n07.01.2026 07.01.2026 Bundeskasse Kfz-Steuer -50,00\n14.01.2026 14.01.2026 Depotgebuehren -100,00\nClosing Balance: 2.500,00`;
    return importTextAsStatement({ text: synthetic, fileName: "synthetic-january.pdf", sourceFileId: "synthetic-january", fileHash: "synthetic-january" });
  });

  createWindow();
});
