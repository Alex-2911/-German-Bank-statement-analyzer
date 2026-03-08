import React from "react";
import { createRoot } from "react-dom/client";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from "chart.js";
import "./styles.css";

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

declare global {
  interface Window {
    desktopApi: any;
  }
}

function App() {
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [summaries, setSummaries] = React.useState<any[]>([]);
  const [activeSection, setActiveSection] = React.useState("Dashboard");
  const [status, setStatus] = React.useState("Ready");

  const refresh = React.useCallback(async () => {
    setTransactions(await window.desktopApi.listTransactions());
    setSummaries(await window.desktopApi.listSummaries());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const tagBuckets = transactions.reduce((acc, tx) => {
    acc[tx.tag] = (acc[tx.tag] ?? 0) + Math.abs(Math.min(tx.amount, 0));
    return acc;
  }, {} as Record<string, number>);

  async function importSynthetic() {
    const result = await window.desktopApi.importSynthetic();
    setStatus(`Synthetic import complete (${result.inserted} transactions, ${result.warnings.length} warnings)`);
    refresh();
  }

  async function importPdf() {
    const result = await window.desktopApi.importPdf();
    setStatus(`Imported ${result.length} file(s)`);
    refresh();
  }

  return (
    <div className="layout">
      <aside>
        <h1>German Bank PDF Statement Analyzer</h1>
        {['Dashboard','Imports','Transactions','Analysis','Rules','Settings'].map((item) => (
          <button key={item} className={activeSection === item ? 'active' : ''} onClick={() => setActiveSection(item)}>{item}</button>
        ))}
        <p>{status}</p>
      </aside>
      <main>
        {activeSection === 'Dashboard' && (
          <section>
            <h2>Year overview</h2>
            <Line data={{ labels: summaries.map((s) => s.monthKey), datasets: [{ label: 'Net trend', data: summaries.map((s) => s.netTransactionBased) }] }} />
          </section>
        )}
        {activeSection === 'Imports' && (
          <section>
            <h2>Imports</h2>
            <button onClick={importPdf}>Import PDF files</button>
            <button onClick={importSynthetic}>Import synthetic demo batch</button>
            <p>Re-import of same file hash replaces records from that file only.</p>
          </section>
        )}
        {activeSection === 'Transactions' && (
          <section>
            <h2>Transactions</h2>
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th><th>Tag</th><th>Rule source</th><th>File</th></tr></thead>
              <tbody>
                {transactions.map((tx) => <tr key={tx.id}><td>{tx.bookingDate}</td><td>{tx.description}</td><td>{tx.amount.toFixed(2)}</td><td>{tx.categoryOverride ?? tx.category}</td><td>{tx.tagOverride ?? tx.tag}</td><td>{tx.ruleSource}</td><td>{tx.sourceFileName}</td></tr>)}
              </tbody>
            </table>
          </section>
        )}
        {activeSection === 'Analysis' && (
          <section>
            <h2>Month analysis</h2>
            <div className="charts">
              <Doughnut data={{ labels: Object.keys(tagBuckets), datasets: [{ data: Object.values(tagBuckets) }] }} />
              <Bar data={{ labels: summaries.map((s) => s.monthKey), datasets: [{ label: 'Income', data: summaries.map((s) => s.income) }, { label: 'Expense', data: summaries.map((s) => s.expense) }] }} />
            </div>
          </section>
        )}
        {activeSection === 'Rules' && <section><h2>Rules</h2><p>User-defined priority rules are stored locally and applied before built-in rules.</p></section>}
        {activeSection === 'Settings' && <section><h2>Settings</h2><p>Local database backup/export hooks are documented in README and planned for next milestone.</p></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
