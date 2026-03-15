import React from "react";
import { createRoot } from "react-dom/client";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from "chart.js";
import "./styles.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

declare global {
  interface Window {
    desktopApi: any;
  }
}

type Mode = "analysis" | "transactions";
type Account = "KSK Konto" | "KSK Depot" | "DKB Konto" | "DKB Depot";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const euro = (value: number) => `€${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const depotSeed: Record<string, any> = {
  "2026-01": { openingBalance: 10854.25, closingBalance: 11097.82, net: 243.57, income: 100, netPct: 2.24 },
  "2026-02": { openingBalance: 10954.26, closingBalance: 11185.5, net: 231.24, income: 100, netPct: 2.11 }
};

function monthKey(tx: any) {
  const [day, month, year] = (tx.bookingDate ?? "").split(".");
  if (!day || !month || !year) return "2026-01";
  return `${year}-${month}`;
}

function App() {
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [summaries, setSummaries] = React.useState<any[]>([]);
  const [account, setAccount] = React.useState<Account>("KSK Konto");
  const [scope, setScope] = React.useState("year");
  const [mode, setMode] = React.useState<Mode>("analysis");
  const [status, setStatus] = React.useState("Ready");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("Newest first");
  const [tagFilter, setTagFilter] = React.useState("All tags");
  const [compareA, setCompareA] = React.useState("January");
  const [compareB, setCompareB] = React.useState("February");

  const refresh = React.useCallback(async () => {
    setTransactions(await window.desktopApi.listTransactions());
    setSummaries(await window.desktopApi.listSummaries());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const scopedTx = React.useMemo(() => {
    const year = 2026;
    const base = transactions.filter((tx) => tx.bookingDate?.endsWith(String(year)));
    if (scope === "year") return base;
    const monthIdx = months.indexOf(scope) + 1;
    const padded = String(monthIdx).padStart(2, "0");
    return base.filter((tx) => monthKey(tx) === `${year}-${padded}`);
  }, [transactions, scope]);

  const visibleTx = React.useMemo(() => {
    const lower = search.toLowerCase();
    return scopedTx
      .filter((tx) => `${tx.description} ${tx.tag}`.toLowerCase().includes(lower))
      .filter((tx) => tagFilter === "All tags" || (tx.tagOverride ?? tx.tag) === tagFilter)
      .sort((a, b) => (sort === "Newest first" ? b.bookingDate.localeCompare(a.bookingDate) : a.bookingDate.localeCompare(b.bookingDate)));
  }, [scopedTx, search, sort, tagFilter]);

  const monthlyMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    summaries.forEach((s) => {
      map[s.monthKey] = {
        income: s.income ?? 0,
        expense: s.expense ?? 0,
        net: s.netTransactionBased ?? 0,
        openingBalance: s.openingBalance ?? 0,
        closingBalance: s.closingBalance ?? 0
      };
    });
    return map;
  }, [summaries]);

  const chartData = React.useMemo(() => {
    const source = account.includes("Depot") ? depotSeed : monthlyMap;
    return months.map((m, idx) => {
      const key = `2026-${String(idx + 1).padStart(2, "0")}`;
      return source[key] ?? { income: 0, expense: 0, net: 0, openingBalance: 0, closingBalance: 0 };
    });
  }, [monthlyMap, account]);

  const totals = React.useMemo(() => {
    const income = chartData.reduce((sum, m) => sum + (m.income ?? 0), 0);
    const expense = chartData.reduce((sum, m) => sum + (m.expense ?? 0), 0);
    const net = chartData.reduce((sum, m) => sum + (m.net ?? 0), 0);
    const openingBalance = chartData.find((m) => m.openingBalance)?.openingBalance ?? 0;
    const closingBalance = [...chartData].reverse().find((m) => m.closingBalance)?.closingBalance ?? 0;
    return { income, expense, net, openingBalance, closingBalance };
  }, [chartData]);

  const monthButtons = months.map((m) => (
    <React.Fragment key={m}>
      <button className={mode === "analysis" && scope === m ? "active" : ""} onClick={() => { setScope(m); setMode("analysis"); }}>{m} Analysis</button>
    </React.Fragment>
  ));

  async function importFiles() {
    const result = await window.desktopApi.importPdf();
    setStatus(`Imported ${result.length} file(s)`);
    refresh();
  }

  return (
    <div className="app">
      <header>
        <h1>German Bank Statement Analyzer</h1>
        <p>Import bank statements, auto-categorize spending, and stay private.</p>
        <button onClick={importFiles}>Import PDF / CSV</button>
      </header>

      <div className="account-row">
        {(["KSK Konto", "KSK Depot", "DKB Konto", "DKB Depot"] as Account[]).map((name) => (
          <button key={name} className={account === name ? "active" : ""} onClick={() => { setAccount(name); setScope("year"); setMode("analysis"); }}>{name}</button>
        ))}
      </div>

      <div className="tabs two-row">
        <div>
          <button className={mode === "analysis" && scope === "year" ? "active" : ""} onClick={() => { setScope("year"); setMode("analysis"); }}>Year Analysis</button>
          {monthButtons}
        </div>
        <div>
          <button className={mode === "transactions" && scope === "year" ? "active" : ""} onClick={() => { setScope("year"); setMode("transactions"); }}>Year Transactions</button>
          {months.map((m) => (
            <button key={`${m}-t`} className={mode === "transactions" && scope === m ? "active" : ""} onClick={() => { setScope(m); setMode("transactions"); }}>{m} Transactions</button>
          ))}
        </div>
      </div>

      <section className="summary-grid">
        <article><h3>Income</h3><strong>{euro(totals.income)}</strong><small>avg {euro(totals.income / 12)}</small></article>
        <article><h3>Expense</h3><strong>{euro(totals.expense)}</strong><small>avg {euro(totals.expense / 12)}</small></article>
        <article><h3>Net</h3><strong>{euro(totals.net)}</strong><small>avg {euro(totals.net / 12)}</small></article>
        <article><h3>Opening Balance</h3><strong>{euro(totals.openingBalance)}</strong></article>
        <article><h3>Closing Balance</h3><strong>{euro(totals.closingBalance)}</strong></article>
      </section>

      <div className="section-head">
        <h2>{mode === "analysis" ? "Analysis" : "Transactions"}</h2>
        <div>
          <button className={mode === "transactions" ? "active" : ""} onClick={() => setMode("transactions")}>Transactions</button>
          <button className={mode === "analysis" ? "active" : ""} onClick={() => setMode("analysis")}>Analysis</button>
        </div>
      </div>

      {mode === "transactions" && (
        <section>
          <div className="filters">
            <input placeholder="Search transactions" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={sort} onChange={(e) => setSort(e.target.value)}><option>Newest first</option><option>Oldest first</option></select>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option>All tags</option>
              {[...new Set(transactions.map((tx) => tx.tagOverride ?? tx.tag))].map((tag) => <option key={tag}>{tag}</option>)}
            </select>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Tag</th></tr></thead>
            <tbody>{visibleTx.map((tx) => <tr key={tx.id}><td>{tx.bookingDate}</td><td>{tx.description}</td><td>{euro(tx.amount)}</td><td>{tx.tagOverride ?? tx.tag}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      {mode === "analysis" && (
        <section className="analysis-grid">
          <article className="compact">
            <h3>Year Overview</h3>
            <p>2026 · Months with data: {chartData.filter((m) => m.income || m.expense || m.net).length}</p>
            <ul>
              <li>Income: {euro(totals.income)} · avg {euro(totals.income / 12)}</li>
              <li>Expense: {euro(totals.expense)} · avg {euro(totals.expense / 12)}</li>
              <li>Net: {euro(totals.net)} · avg {euro(totals.net / 12)}</li>
              <li>Fixed avg: {euro(totals.expense / 24)}</li>
              <li>Variable avg: {euro(totals.expense / 24)}</li>
              <li>Saving avg: {euro(totals.income / 24)}</li>
            </ul>
          </article>

          <article>
            <h3>Tag Comparison (2 months)</h3>
            <div className="filters">
              <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</select>
              <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>{months.map((m) => <option key={m}>{m}</option>)}</select>
            </div>
            <Bar
              data={{ labels: ["Income", "Expense", "Net"], datasets: [{ label: compareA, data: [chartData[months.indexOf(compareA)].income, chartData[months.indexOf(compareA)].expense, chartData[months.indexOf(compareA)].net], backgroundColor: "#d6b380" }, { label: compareB, data: [chartData[months.indexOf(compareB)].income, chartData[months.indexOf(compareB)].expense, chartData[months.indexOf(compareB)].net], backgroundColor: "#9eb59a" }] }}
              options={{ responsive: true, scales: { y: { grid: { color: "#ece5db" }, ticks: { callback: (v) => `€${v}` } }, x: { grid: { display: false } } } }}
            />
            <small>Insight: {compareA} vs {compareB} highlights the monthly shift across income, expense, and net.</small>
          </article>

          <article>
            <h3>Monthly Net Trend</h3>
            <Bar
              data={{ labels: months, datasets: [{ label: "Net", data: chartData.map((m) => m.net), backgroundColor: "#c99b5f" }] }}
              options={{ scales: { y: { ticks: { stepSize: 100, callback: (v) => `€${Math.round(Number(v))}` }, grid: { color: "#ece5db" } } } }}
            />
            <p className="meta-line">{months.map((m, i) => `${m}: ${euro(chartData[i].net)}`).join(" · ")}</p>
            <div className="metric">Total Net 2026: {euro(totals.net)}</div>
          </article>

          <article>
            <h3>Closing Balance by Month</h3>
            <Bar
              data={{ labels: months, datasets: [{ label: "Closing Balance", data: chartData.map((m) => m.closingBalance), backgroundColor: "#8fae9a" }] }}
              options={{ scales: { y: { ticks: { stepSize: 2000, padding: 10, callback: (v) => `€${Math.round(Number(v))}` }, grid: { color: "#ece5db" } } } }}
            />
            <p className="meta-line">{months.map((m, i) => `${m}: ${euro(chartData[i].closingBalance)}`).join(" · ")}</p>
            <div className="metric">Latest Closing Balance 2026: {euro(totals.closingBalance)}</div>
          </article>
        </section>
      )}
      <p className="status">{status}</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
