const fs = require("node:fs");
const path = require("node:path");

const STORAGE_FILE_NAME = "german-bank-statement-analyzer-data.json";
const ACCOUNT_IDS = ["primary-giro", "primary-depot", "secondary-giro", "secondary-depot"];
const DEFAULT_CATEGORIES = [
  "Cash",
  "Dining",
  "Gifts",
  "Groceries",
  "Health",
  "Household items",
  "Income",
  "Insurance",
  "Other",
  "Real estate",
  "Rent",
  "Saving",
  "Shopping",
  "Sport",
  "Subscriptions",
  "Transport",
  "Utilities"
];
const DEFAULT_TAGS = ["Fixed", "Variable", "Saving"];

function createDefaultAccount(id) {
  const isDepot = id.endsWith("depot");
  return {
    id,
    transactions: [],
    summaries: {},
    categories: isDepot ? [] : [...DEFAULT_CATEGORIES],
    rules: isDepot
      ? []
      : [
          { id: "rule-insurance", keyword: "insurance", category: "Insurance", tag: "Fixed" },
          { id: "rule-subscription", keyword: "subscription", category: "Subscriptions", tag: "Fixed" },
          { id: "rule-utility", keyword: "utility", category: "Utilities", tag: "Fixed" },
          { id: "rule-real-estate", keyword: "real estate", category: "Real estate", tag: "Fixed" },
          { id: "rule-saving", keyword: "saving", category: "Saving", tag: "Saving" },
          { id: "rule-depot", keyword: "depot", category: "Saving", tag: "Saving" },
          { id: "rule-investment", keyword: "investment", category: "Saving", tag: "Saving" }
        ]
  };
}

function createEmptyData() {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    accounts: Object.fromEntries(ACCOUNT_IDS.map((id) => [id, createDefaultAccount(id)])),
    imports: []
  };
}

function ensureShape(data) {
  const shaped = data && typeof data === "object" ? data : createEmptyData();
  shaped.schemaVersion = 1;
  shaped.accounts = shaped.accounts && typeof shaped.accounts === "object" ? shaped.accounts : {};
  for (const id of ACCOUNT_IDS) {
    const defaults = createDefaultAccount(id);
    shaped.accounts[id] = { ...defaults, ...(shaped.accounts[id] || {}) };
    shaped.accounts[id].transactions = Array.isArray(shaped.accounts[id].transactions) ? shaped.accounts[id].transactions : [];
    shaped.accounts[id].summaries = shaped.accounts[id].summaries && typeof shaped.accounts[id].summaries === "object" ? shaped.accounts[id].summaries : {};
    shaped.accounts[id].categories = id.endsWith("depot")
      ? []
      : [...new Set([...(shaped.accounts[id].categories || []), ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b));
    shaped.accounts[id].rules = Array.isArray(shaped.accounts[id].rules) ? shaped.accounts[id].rules : defaults.rules;
  }
  shaped.imports = Array.isArray(shaped.imports) ? shaped.imports : [];
  return shaped;
}

function createStorage(userDataPath) {
  const filePath = path.join(userDataPath, STORAGE_FILE_NAME);

  function load() {
    try {
      return ensureShape(JSON.parse(fs.readFileSync(filePath, "utf8")));
    } catch {
      return createEmptyData();
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const shaped = ensureShape(data);
    shaped.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(shaped, null, 2));
    return shaped;
  }

  function update(mutator) {
    const data = load();
    const result = mutator(data) || data;
    return save(result);
  }

  return { filePath, load, save, update };
}

module.exports = { ACCOUNT_IDS, DEFAULT_CATEGORIES, DEFAULT_TAGS, STORAGE_FILE_NAME, createStorage };
