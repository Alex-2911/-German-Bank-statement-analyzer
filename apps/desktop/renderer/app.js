const ACCOUNT_LABELS = {
  "primary-giro": "Primary Giro",
  "primary-depot": "Primary Depot",
  "secondary-giro": "Secondary Giro",
  "secondary-depot": "Secondary Depot"
};
const ACCOUNT_IDS = Object.keys(ACCOUNT_LABELS);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TAGS = ["Fixed", "Variable", "Saving"];
const DEFAULT_CATEGORIES = ["Cash", "Dining", "Gifts", "Groceries", "Health", "Household items", "Income", "Insurance", "Other", "Real estate", "Rent", "Saving", "Shopping", "Sport", "Subscriptions", "Transport", "Utilities"];

const state = {
  data: null,
  storageFile: "",
  accountId: "primary-giro",
  mode: "analysis",
  monthIndex: null,
  search: "",
  sort: "newest",
  tagFilter: "All tags",
  compareA: 0,
  compareB: 1,
  categoriesOpen: false,
  rulesOpen: false
};

const euro = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const monthKey = (index) => `2026-${String(index + 1).padStart(2, "0")}`;
const byMonth = (tx) => state.monthIndex === null || tx.monthKey === monthKey(state.monthIndex);
const isDepot = () => state.accountId.endsWith("depot");
const app = document.querySelector("#app");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\'": "&#39;" })[char]);

function account() {
  return state.data.accounts[state.accountId];
}

function monthSummary(index) {
  const acct = account();
  const key = monthKey(index);
  const summary = acct.summaries[key] || { monthKey: key };
  if (isDepot()) return summary;
  const transactions = acct.transactions.filter((tx) => tx.monthKey === key);
  const income = transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expense = transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  return { ...summary, income, expense, net: income - expense };
}

function selectedSummaries() {
  if (state.monthIndex !== null) return [monthSummary(state.monthIndex)];
  return MONTHS.map((_, index) => monthSummary(index));
}

function selectedSummary() {
  const summaries = selectedSummaries();
  const withData = summaries.filter((item) => item.income || item.expense || item.net || item.openingBalance || item.closingBalance);
  const opening = withData[0]?.openingBalance;
  const closing = [...withData].reverse()[0]?.closingBalance;
  return {
    income: summaries.reduce((sum, item) => sum + Number(item.income || item.deposit || 0), 0),
    expense: summaries.reduce((sum, item) => sum + Number(item.expense || 0), 0),
    net: summaries.reduce((sum, item) => sum + Number(item.net || 0), 0),
    openingBalance: state.monthIndex === null ? opening : summaries[0]?.openingBalance,
    closingBalance: state.monthIndex === null ? closing : summaries[0]?.closingBalance,
    monthsWithData: withData.length
  };
}

function selectedTransactions() {
  if (isDepot()) {
    return selectedSummaries()
      .filter((summary) => summary.income || summary.deposit || summary.closingBalance)
      .map((summary) => ({
        id: `${state.accountId}-${summary.monthKey}-summary`,
        date: new Date(`${summary.monthKey}-01T00:00:00Z`).toISOString().slice(0, 8) + String(new Date(Number(summary.monthKey.slice(0, 4)), Number(summary.monthKey.slice(5, 7)), 0).getDate()).padStart(2, "0"),
        description: `${MONTHS[Number(summary.monthKey.slice(5, 7)) - 1]} ${summary.monthKey.slice(0, 4)} depot summary`,
        amount: Number(summary.income || summary.deposit || 0),
        category: "Saving",
        tag: "Saving",
        kind: "income"
      }));
  }
  const query = state.search.trim().toLowerCase();
  return account().transactions
    .filter(byMonth)
    .filter((tx) => !query || tx.description.toLowerCase().includes(query) || tx.category.toLowerCase().includes(query))
    .filter((tx) => state.tagFilter === "All tags" || tx.tag === state.tagFilter)
    .sort((a, b) => state.sort === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
}

function saveAndRender(data = state.data) {
  state.data = data;
  return window.bankAnalyzer.updateData(state.data).then(render);
}

function updateTx(id, field, value) {
  const tx = account().transactions.find((item) => item.id === id);
  if (!tx) return;
  tx[field] = field === "amount" ? Number(value) : value;
  saveAndRender();
}

function addCategory() {
  const acct = account();
  state.categoriesOpen = true;
  acct.categories = [...new Set([...(acct.categories || []), "New Category"])].sort((a, b) => a.localeCompare(b));
  saveAndRender().then(() => setTimeout(() => document.querySelector("[data-new-category]")?.focus(), 0));
}

function addRule() {
  state.rulesOpen = true;
  account().rules.push({ id: `rule-${Date.now()}`, keyword: "", category: "Other", tag: "Variable" });
  saveAndRender().then(() => setTimeout(() => document.querySelector("[data-new-rule]")?.focus(), 0));
}

function renderSummaryCards() {
  const summary = selectedSummary();
  const cards = [
    ["Income", euro(summary.income)],
    ["Expense", euro(summary.expense)],
    ["Net", euro(summary.net)],
    ["Opening Balance", euro(summary.openingBalance)],
    ["Closing Balance", euro(summary.closingBalance)]
  ];
  const averages = state.monthIndex === null ? `<div class="averages">Average income ${euro(summary.income / 12)} · Average expense ${euro(summary.expense / 12)} · Average net ${euro(summary.net / 12)}</div>` : "";
  return `<section class="summary-grid">${cards.map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("")}</section>${averages}`;
}

function renderNavigation() {
  const analysis = [`<button class="${state.mode === "analysis" && state.monthIndex === null ? "active" : ""}" data-view="analysis-year">Year Analysis</button>`]
    .concat(MONTHS.map((month, index) => `<button class="${state.mode === "analysis" && state.monthIndex === index ? "active" : ""}" data-view="analysis" data-month="${index}">${month} Analysis</button>`));
  const transactions = [`<button class="${state.mode === "transactions" && state.monthIndex === null ? "active" : ""}" data-view="transactions-year">Year Transactions</button>`]
    .concat(MONTHS.map((month, index) => `<button class="${state.mode === "transactions" && state.monthIndex === index ? "active" : ""}" data-view="transactions" data-month="${index}">${month} Transactions</button>`));
  return `<nav class="tabs"><div>${analysis.join("")}</div><div>${transactions.join("")}</div></nav>`;
}

function renderTransactions() {
  const transactions = selectedTransactions();
  const outcome = transactions.filter((tx) => tx.amount < 0);
  const income = transactions.filter((tx) => tx.amount >= 0);
  const filters = isDepot() ? "" : `<div class="filters"><input id="search" placeholder="Search descriptions" value="${state.search}"><select id="sort"><option value="newest">newest first</option><option value="oldest" ${state.sort === "oldest" ? "selected" : ""}>oldest first</option></select><select id="tag-filter"><option>All tags</option>${TAGS.map((tag) => `<option ${state.tagFilter === tag ? "selected" : ""}>${tag}</option>`).join("")}</select><button id="add-category">Add category</button><button id="add-rule">Add rule</button></div>`;
  return `<section class="wide-card"><h2>${state.monthIndex === null ? "Year" : MONTHS[state.monthIndex]} Transactions</h2>${filters}<div class="split-table"><article><h3>Outcome</h3>${renderTable(outcome)}</article><article><h3>Income</h3>${renderTable(income)}</article></div>${isDepot() ? "" : renderConfigPanels()}</section>`;
}

function renderTable(rows) {
  const categories = [...new Set([...(account().categories || DEFAULT_CATEGORIES), ...DEFAULT_CATEGORIES])].sort((a, b) => a.localeCompare(b));
  return `<table><thead><tr><th>Date</th><th class="description-col">Description</th><th>Amount</th><th>Category</th><th>Tag</th></tr></thead><tbody>${rows.map((tx) => `<tr><td>${tx.date}</td><td class="description-col">${esc(tx.description)}</td><td>${euro(tx.amount)}</td><td>${isDepot() ? `<span class="pill">Saving</span>` : `<select data-tx="${tx.id}" data-field="category">${categories.map((cat) => `<option ${tx.category === cat ? "selected" : ""}>${esc(cat)}</option>`).join("")}</select>`}</td><td>${isDepot() ? `<span class="pill saving">Saving</span>` : `<select data-tx="${tx.id}" data-field="tag">${TAGS.map((tag) => `<option ${tx.tag === tag ? "selected" : ""}>${tag}</option>`).join("")}</select>`}</td></tr>`).join("") || `<tr><td colspan="5">No local data imported for this view.</td></tr>`}</tbody></table>`;
}

function renderConfigPanels() {
  const categories = [...new Set(account().categories || DEFAULT_CATEGORIES)].sort((a, b) => a.localeCompare(b));
  return `<details ${state.categoriesOpen ? "open" : ""}><summary>Categories</summary>${categories.map((cat) => `<input ${cat === "New Category" ? "data-new-category" : ""} value="${esc(cat)}" aria-label="Category">`).join("")}</details><details ${state.rulesOpen ? "open" : ""}><summary>Rules</summary>${account().rules.map((rule, index) => `<div class="rule-row"><input ${index === account().rules.length - 1 ? "data-new-rule" : ""} value="${esc(rule.keyword)}" placeholder="keyword"><select><option>${esc(rule.category)}</option></select><span class="pill">${esc(rule.tag)}</span></div>`).join("")}</details>`;
}

function bar(value, max, label, extra = "") {
  const width = max ? Math.min(100, Math.abs(value) / max * 100) : 0;
  return `<div class="bar-row"><span>${label}</span><div class="bar"><i class="${extra}" style="width:${width}%"></i></div><strong>${euro(value)}</strong></div>`;
}

function renderAnalysis() {
  const summaries = selectedSummaries();
  const max = Math.max(100, ...summaries.map((item) => Math.abs(item.net || 0)), ...summaries.map((item) => Math.abs(item.closingBalance || 0)));
  const tx = selectedTransactions();
  const expenses = tx.filter((item) => item.amount < 0);
  const income = tx.filter((item) => item.amount > 0);
  const fixed = expenses.filter((item) => item.tag === "Fixed").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const variable = expenses.filter((item) => item.tag === "Variable").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const saving = expenses.filter((item) => item.tag === "Saving").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  return `<section class="analysis-grid">${state.monthIndex === null ? renderYearOverview(summaries, fixed, variable, saving) : renderMonthOverview(expenses, income, fixed, variable, saving)}<article><h3>Monthly Net Trend</h3>${summaries.map((item, index) => bar(item.net || 0, max, state.monthIndex === null ? MONTHS[index].slice(0, 3) : MONTHS[state.monthIndex], (item.net || 0) < 0 ? "negative" : "")).join("")}<p class="text-list">${summaries.map((item, index) => `${state.monthIndex === null ? MONTHS[index].slice(0, 3) : MONTHS[state.monthIndex]}: ${euro(item.net)}`).join(" · ")}</p><div class="metric">Total Net: ${euro(summaries.reduce((sum, item) => sum + Number(item.net || 0), 0))}</div></article><article><h3>Closing Balance by Month</h3>${summaries.map((item, index) => bar(item.closingBalance || 0, max, state.monthIndex === null ? MONTHS[index].slice(0, 3) : MONTHS[state.monthIndex])).join("")}<p class="text-list">${summaries.map((item, index) => `${state.monthIndex === null ? MONTHS[index].slice(0, 3) : MONTHS[state.monthIndex]}: ${euro(item.closingBalance)}`).join(" · ")}</p><div class="metric">Closing Balance 2026: ${euro(selectedSummary().closingBalance)}</div></article>${isDepot() ? renderDepotDetails(summaries) : ""}</section>`;
}

function renderYearOverview(summaries, fixed, variable, saving) {
  const summary = selectedSummary();
  const avg = (value) => euro(value / 12);
  return `<article><h3>Year Overview</h3><p>Months with data: ${summary.monthsWithData}</p><ul><li>Income total ${euro(summary.income)} · monthly average ${avg(summary.income)}</li><li>Expense total ${euro(summary.expense)} · monthly average ${avg(summary.expense)}</li><li>Net total ${euro(summary.net)} · monthly average ${avg(summary.net)}</li><li>Fixed total ${euro(fixed)} · monthly average ${avg(fixed)}</li><li>Variable total ${euro(variable)} · monthly average ${avg(variable)}</li><li>Saving total ${euro(saving)} · monthly average ${avg(saving)}</li></ul></article><article><h3>Tag Comparison</h3><div class="filters"><select id="compare-a">${MONTHS.map((m, i) => `<option value="${i}" ${state.compareA === i ? "selected" : ""}>${m}</option>`)}</select><select id="compare-b">${MONTHS.map((m, i) => `<option value="${i}" ${state.compareB === i ? "selected" : ""}>${m}</option>`)}</select></div><div class="grid-chart">${TAGS.map((tag) => `<span>${tag}</span><b>${MONTHS[state.compareA]} ${euro(tagTotal(state.compareA, tag))}</b><b>${MONTHS[state.compareB]} ${euro(tagTotal(state.compareB, tag))}</b>`).join("")}</div><p class="text-list">${MONTHS[state.compareA]} to ${MONTHS[state.compareB]} changed mainly through Fixed, Variable, and Saving expense buckets.</p></article>`;
}

function tagTotal(monthIndex, tag) {
  return account().transactions.filter((tx) => tx.monthKey === monthKey(monthIndex) && tx.amount < 0 && tx.tag === tag).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
}

function renderMonthOverview(expenses, income, fixed, variable, saving) {
  const maxExpense = Math.max(100, fixed, variable, saving, ...expenses.map((tx) => Math.abs(tx.amount)));
  return `<article><h3>Expense Tags</h3>${bar(fixed, maxExpense, "Fixed")}${bar(variable, maxExpense, "Variable")}${bar(saving, maxExpense, "Saving")}</article><article><h3>Expense by Category</h3>${categoryTotals(expenses).map(([category, total]) => bar(total, maxExpense, category)).join("") || "No expenses."}</article><article><h3>Income vs Expense</h3>${bar(income.reduce((sum, tx) => sum + tx.amount, 0), maxExpense, "Income")}${bar(fixed, maxExpense, "Outcome Fixed")}${bar(variable, maxExpense, "Outcome Variable")}${bar(saving, maxExpense, "Outcome Saving")}${bar(selectedSummary().net, maxExpense, "Difference", selectedSummary().net < 0 ? "negative" : "")}</article><article><h3>Top Expenses</h3>${expenses.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5).map((tx) => `<p>${esc(tx.description)} · ${euro(tx.amount)}</p>`).join("") || "No expenses."}<h3>Top Income</h3>${income.sort((a, b) => b.amount - a.amount).slice(0, 5).map((tx) => `<p>${esc(tx.description)} · ${euro(tx.amount)}</p>`).join("") || "No income."}</article>`;
}

function categoryTotals(expenses) {
  const totals = new Map();
  expenses.forEach((tx) => totals.set(tx.category, (totals.get(tx.category) || 0) + Math.abs(tx.amount)));
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function renderDepotDetails(summaries) {
  return `<article><h3>Depot Details</h3>${summaries.filter((item) => item.shares || item.pricePerShare).map((item) => `<p>${item.monthKey}: shares ${item.shares || "—"}, price/share ${item.pricePerShare ? euro(item.pricePerShare) : "—"}</p>`).join("") || "Shares and price/share appear here when extracted by the local parser."}</article>`;
}

function render() {
  if (!state.data) return;
  app.innerHTML = `<main><header><div><h1>German Bank Statement Analyzer</h1><p>Local-only desktop workflow. Data stays in Electron userData JSON.</p></div><button id="import">Import PDF / CSV</button></header><section class="account-row">${ACCOUNT_IDS.map((id) => `<button class="${state.accountId === id ? "active" : ""}" data-account="${id}">${ACCOUNT_LABELS[id]}</button>`).join("")}</section>${renderNavigation()}${renderSummaryCards()}${state.mode === "transactions" ? renderTransactions() : renderAnalysis()}<p class="status">Storage: ${state.storageFile}</p></main>`;
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-account]").forEach((button) => button.addEventListener("click", () => { state.accountId = button.dataset.account; state.mode = "analysis"; state.monthIndex = null; render(); }));
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.mode = button.dataset.view.includes("transactions") ? "transactions" : "analysis"; state.monthIndex = button.dataset.month === undefined ? null : Number(button.dataset.month); render(); }));
  document.querySelector("#import")?.addEventListener("click", async () => { await window.bankAnalyzer.importFiles(state.accountId); const loaded = await window.bankAnalyzer.loadData(); state.data = loaded.data; render(); });
  document.querySelector("#search")?.addEventListener("input", (event) => { state.search = event.target.value; render(); });
  document.querySelector("#sort")?.addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  document.querySelector("#tag-filter")?.addEventListener("change", (event) => { state.tagFilter = event.target.value; render(); });
  document.querySelector("#add-category")?.addEventListener("click", addCategory);
  document.querySelector("#add-rule")?.addEventListener("click", addRule);
  document.querySelector("#compare-a")?.addEventListener("change", (event) => { state.compareA = Number(event.target.value); render(); });
  document.querySelector("#compare-b")?.addEventListener("change", (event) => { state.compareB = Number(event.target.value); render(); });
  document.querySelectorAll("[data-tx]").forEach((control) => control.addEventListener("change", () => updateTx(control.dataset.tx, control.dataset.field, control.value)));
}

window.bankAnalyzer.loadData().then((loaded) => { state.data = loaded.data; state.storageFile = loaded.storageFile; render(); });
