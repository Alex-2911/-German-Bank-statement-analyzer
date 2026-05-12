const crypto = require("node:crypto");

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const FIXED_CATEGORIES = new Set(["Insurance", "Subscriptions", "Utilities", "Real estate", "Rent"]);
const VARIABLE_CATEGORIES = new Set(["Cash", "Dining", "Groceries", "Shopping", "Gifts", "Household items", "Transport", "Health", "Sport", "Other"]);
const SAVING_WORDS = ["saving", "depot", "investment", "portfolio", "broker", "securities"];

function normalizeText(text) {
  return String(text || "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
}

function parseGermanAmount(value) {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const isNegative = /(^-|\bS\b|\bSoll\b|−|\(.*\)|\bred\b)/i.test(raw);
  const cleaned = raw.replace(/[^0-9,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned.replace(/[()−]/g, ""));
  if (!Number.isFinite(parsed)) return undefined;
  return (isNegative && parsed > 0 ? -parsed : parsed);
}

function toIsoDate(germanDate) {
  const match = String(germanDate || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function monthKeyFromDate(germanDate) {
  const iso = toIsoDate(germanDate);
  return iso ? iso.slice(0, 7) : "";
}

function monthEndDate(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
}

function previousMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return date.toISOString().slice(0, 7);
}

function inferPreviousStatementMonth(generatedDate) {
  const key = monthKeyFromDate(generatedDate);
  return key ? previousMonthKey(key) : "";
}

function deterministicId(parts) {
  return crypto.createHash("sha256").update(parts.filter(Boolean).join("|"), "utf8").digest("hex").slice(0, 24);
}

function categorize(description) {
  const lower = String(description || "").toLowerCase();
  const categoryRules = [
    ["Insurance", ["insurance", "premium"]],
    ["Subscriptions", ["subscription", "membership"]],
    ["Utilities", ["utility", "electric", "heating", "water"]],
    ["Real estate", ["real estate", "property"]],
    ["Rent", ["rent"]],
    ["Cash", ["cash", "atm"]],
    ["Dining", ["dining", "restaurant", "cafe"]],
    ["Groceries", ["grocery", "groceries", "supermarket"]],
    ["Shopping", ["shopping", "shop"]],
    ["Gifts", ["gift"]],
    ["Household items", ["household"]],
    ["Transport", ["transport", "fuel", "ticket"]],
    ["Saving", SAVING_WORDS],
    ["Income", ["salary", "income", "interest", "dividend", "refund"]]
  ];
  for (const [category, words] of categoryRules) {
    if (words.some((word) => lower.includes(word))) return category;
  }
  return "Other";
}

function tagFor(category, description) {
  const lower = String(description || "").toLowerCase();
  if (category === "Saving" || SAVING_WORDS.some((word) => lower.includes(word))) return "Saving";
  if (FIXED_CATEGORIES.has(category)) return "Fixed";
  if (VARIABLE_CATEGORIES.has(category)) return "Variable";
  return "Variable";
}

function parseBalances(text) {
  const openingMatch = text.match(/(?:opening balance|startsaldo|anfangssaldo|alter saldo|saldo vortrag)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i);
  const closingMatch = text.match(/(?:closing balance|endsaldo|neuer saldo|kontostand|schlussbestand)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i);
  return { openingBalance: parseGermanAmount(openingMatch?.[1]), closingBalance: parseGermanAmount(closingMatch?.[1]) };
}

function parseGiroText({ text, accountId, sourceFileId }) {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const transactions = [];
  const dateAmountPattern = /(\d{2}\.\d{2}\.\d{4})(?:\s+\d{2}\.\d{2}\.\d{4})?\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*(?:[SH]|Soll|Haben)?$/i;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const combined = `${current} ${lines[index + 1] || ""}`.trim();
    const match = current.match(dateAmountPattern) || combined.match(dateAmountPattern);
    if (!match) continue;
    const amount = parseGermanAmount(match[3]);
    if (!Number.isFinite(amount)) continue;
    const description = match[2].replace(/\s+/g, " ").trim();
    const category = amount > 0 ? "Income" : categorize(description);
    const tag = amount > 0 ? "Variable" : tagFor(category, description);
    const date = toIsoDate(match[1]);
    const monthKey = date.slice(0, 7);
    transactions.push({
      id: deterministicId([accountId, sourceFileId, date, description, amount.toFixed(2)]),
      accountId,
      sourceFileId,
      date,
      monthKey,
      description,
      amount,
      category,
      tag,
      kind: amount >= 0 ? "income" : "outcome"
    });
  }

  const months = [...new Set(transactions.map((tx) => tx.monthKey).filter(Boolean))];
  const balances = parseBalances(normalized);
  return { transactions, summaries: months.map((monthKey) => ({ monthKey, ...balances })), warnings: [] };
}

function parseDepotCsv({ text, accountId, sourceFileId }) {
  const rows = normalizeText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const summaries = [];
  for (const row of rows) {
    const cells = row.split(/[;,]/).map((cell) => cell.trim());
    const dateCell = cells.find((cell) => /\d{2}\.\d{2}\.\d{4}/.test(cell));
    if (!dateCell) continue;
    const monthKey = monthKeyFromDate(dateCell);
    const amounts = cells.map(parseGermanAmount).filter(Number.isFinite);
    if (!amounts.length) continue;
    summaries.push({
      monthKey,
      date: monthEndDate(monthKey),
      deposit: amounts[0] || 0,
      openingBalance: amounts[1],
      closingBalance: amounts[2] ?? amounts[amounts.length - 1],
      shares: amounts[3],
      pricePerShare: amounts[4],
      sourceFileId
    });
  }
  return { transactions: [], summaries, warnings: [] };
}

function parseDepotPdf({ text, accountId, sourceFileId }) {
  const normalized = normalizeText(text);
  const generated = normalized.match(/(?:generated|erstellt|datum)\D*(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  const explicit = normalized.match(/(?:month|monat|period|zeitraum)\D*(\d{2}\.\d{2}\.\d{4})/i)?.[1];
  const monthKey = explicit ? monthKeyFromDate(explicit) : inferPreviousStatementMonth(generated);
  if (!monthKey) return { transactions: [], summaries: [], warnings: ["Could not infer depot statement month."] };
  const openingBalance = parseGermanAmount(normalized.match(/(?:opening|start|previous|anfang|vorheriger)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i)?.[1]);
  const closingBalance = parseGermanAmount(normalized.match(/(?:closing|end|current|schluss|gesamtwert)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i)?.[1]);
  const deposit = parseGermanAmount(normalized.match(/(?:deposit|contribution|einzahlung|sparrate)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i)?.[1]) || 0;
  const shares = parseGermanAmount(normalized.match(/(?:shares|anteile)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i)?.[1]);
  const pricePerShare = parseGermanAmount(normalized.match(/(?:price per share|anteilpreis|kurs)[^\d-]*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})/i)?.[1]);
  return { transactions: [], summaries: [{ monthKey, date: monthEndDate(monthKey), openingBalance, closingBalance, deposit, shares, pricePerShare, sourceFileId }], warnings: [] };
}

function parseStatement({ text, fileName = "", accountId, sourceFileId }) {
  const lowerName = fileName.toLowerCase();
  if (accountId.endsWith("depot")) {
    return lowerName.endsWith(".csv") ? parseDepotCsv({ text, accountId, sourceFileId }) : parseDepotPdf({ text, accountId, sourceFileId });
  }
  return parseGiroText({ text, accountId, sourceFileId });
}

module.exports = { MONTH_NAMES, parseGermanAmount, parseStatement, monthEndDate, previousMonthKey, tagFor };
