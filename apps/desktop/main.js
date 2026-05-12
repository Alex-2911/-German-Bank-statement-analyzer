const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const pdf = require("pdf-parse");
const { createStorage } = require("./data/storage.js");
const { parseStatement, previousMonthKey, monthEndDate } = require("./services/pdfParser.js");

let mainWindow;
let storage;

function createWindow() {
  const { width, height } = require("electron").screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1200,
    minHeight: 760,
    title: "German Bank Statement Analyzer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function computeGiroSummary(account, monthKey, importedSummary = {}) {
  const transactions = account.transactions.filter((tx) => tx.monthKey === monthKey);
  const income = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expense = transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const previousClose = account.summaries[previousMonthKey(monthKey)]?.closingBalance;
  const openingBalance = Number.isFinite(previousClose) ? previousClose : importedSummary.openingBalance;
  const closingBalance = importedSummary.closingBalance ?? account.summaries[monthKey]?.closingBalance;
  return { ...account.summaries[monthKey], ...importedSummary, monthKey, income, expense, net: income - expense, openingBalance, closingBalance };
}

function computeDepotSummary(account, importedSummary) {
  const monthKey = importedSummary.monthKey;
  const previousClose = account.summaries[previousMonthKey(monthKey)]?.closingBalance;
  const openingBalance = Number.isFinite(previousClose) ? previousClose : importedSummary.openingBalance;
  const closingBalance = importedSummary.closingBalance;
  const income = importedSummary.deposit || 0;
  const net = Number.isFinite(openingBalance) && Number.isFinite(closingBalance) ? closingBalance - openingBalance - income : 0;
  const percent = Number.isFinite(openingBalance) && openingBalance !== 0 ? (net / openingBalance) * 100 : 0;
  return { ...account.summaries[monthKey], ...importedSummary, monthKey, income, expense: 0, openingBalance, closingBalance, net, percent };
}


function refreshSequentialSummaries(account, isDepotAccount) {
  const keys = Object.keys(account.summaries).sort();
  for (const key of keys) {
    account.summaries[key] = isDepotAccount ? computeDepotSummary(account, account.summaries[key]) : computeGiroSummary(account, key, account.summaries[key]);
  }
}

function mergeImport(accountId, parsed, sourceFileId, fileHash, displayName) {
  return storage.update((data) => {
    const account = data.accounts[accountId];
    if (!account) throw new Error("Unknown account.");
    if (accountId.endsWith("depot")) {
      for (const summary of parsed.summaries) {
        account.summaries[summary.monthKey] = computeDepotSummary(account, summary);
      }
    } else {
      account.transactions = account.transactions.filter((tx) => tx.sourceFileId !== sourceFileId);
      const existingIds = new Set(account.transactions.map((tx) => tx.id));
      for (const tx of parsed.transactions) {
        if (!existingIds.has(tx.id)) account.transactions.push(tx);
      }
      for (const summary of parsed.summaries) {
        account.summaries[summary.monthKey] = computeGiroSummary(account, summary.monthKey, summary);
      }
      const changedMonths = [...new Set(parsed.transactions.map((tx) => tx.monthKey))];
      for (const monthKey of changedMonths) account.summaries[monthKey] = computeGiroSummary(account, monthKey, account.summaries[monthKey]);
    }
    refreshSequentialSummaries(account, accountId.endsWith("depot"));
    data.imports = data.imports.filter((entry) => entry.sourceFileId !== sourceFileId);
    data.imports.push({ sourceFileId, fileHash, accountId, displayName, importedAt: new Date().toISOString(), warningCount: parsed.warnings.length });
    return data;
  });
}

async function extractText(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (path.extname(filePath).toLowerCase() === ".csv") return { buffer, text: buffer.toString("utf8") };
  const parsed = await pdf(buffer);
  return { buffer, text: parsed.text || "" };
}

app.whenReady().then(() => {
  storage = createStorage(app.getPath("userData"));

  ipcMain.handle("data:load", () => ({ data: storage.load(), storageFile: storage.filePath }));
  ipcMain.handle("data:save", (_event, data) => storage.save(data));
  ipcMain.handle("data:update", (_event, data) => storage.save(data));
  ipcMain.handle("import:files", async (_event, accountId) => {
    const selected = await dialog.showOpenDialog(mainWindow, {
      title: "Import PDF / CSV",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "PDF / CSV", extensions: ["pdf", "csv"] }]
    });
    if (selected.canceled) return [];
    const results = [];
    for (const filePath of selected.filePaths) {
      const { buffer, text } = await extractText(filePath);
      const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
      const sourceFileId = fileHash.slice(0, 24);
      const parsed = parseStatement({ text, fileName: path.basename(filePath), accountId, sourceFileId });
      mergeImport(accountId, parsed, sourceFileId, fileHash, path.extname(filePath).toLowerCase().replace(".", "").toUpperCase());
      results.push({ sourceFileId, inserted: parsed.transactions.length, summaries: parsed.summaries.length, warnings: parsed.warnings });
    }
    return results;
  });

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

module.exports = { computeDepotSummary, computeGiroSummary, monthEndDate };
