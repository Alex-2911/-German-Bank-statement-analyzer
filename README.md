# German Bank Statement Analyzer

Local-first Electron desktop application for importing and analyzing German giro account statements and depot summaries.

The current app is a plain JavaScript Electron shell with a static renderer. It stores runtime data as JSON in Electron `userData` and uses a generic experimental parser for local PDF/CSV imports.

The project is intentionally generic for public release. It does not include specific bank names, personal names, real account numbers, IBANs, statement files, real merchant data, or real transaction descriptions.

## Privacy-first principles

- Everything runs locally on your machine.
- Core features require no cloud services.
- No telemetry, trackers, or auto-upload behavior.
- Imported files are read locally and are not committed to this repository.
- Runtime data is stored in Electron `userData` as `german-bank-statement-analyzer-data.json`.
- Demo and parser examples must stay synthetic and generic.

## Current desktop workflow

- Four neutral account areas:
  - Primary Giro
  - Primary Depot
  - Secondary Giro
  - Secondary Depot
- Two-row period navigation for year/month analysis and year/month transactions.
- Local PDF/CSV import via the **Import PDF / CSV** button.
- Summary cards for income, expense, net, opening balance, and closing balance.
- Giro transaction tables split into Outcome and Income columns.
- Generic category and tag assignment using exactly these tags: `Fixed`, `Variable`, `Saving`.
- Depot summary views with month-level deposits/income, opening balance, closing balance, net movement, and optional shares/price-per-share fields.

## Parser status

The parser is generic and experimental. It uses common German statement patterns, German amount/date formats, and generic keywords, but it is not guaranteed to parse every PDF or CSV layout correctly.

Users should manually validate parsed transactions, categories, tags, opening balances, closing balances, and depot movements before relying on analysis results.

## Repository structure

- `apps/desktop/main.js` – Electron main process, local import workflow, and summary merge logic.
- `apps/desktop/preload.js` – secure IPC bridge exposed as `window.bankAnalyzer`.
- `apps/desktop/data/storage.js` – JSON storage helper for Electron `userData`.
- `apps/desktop/services/pdfParser.js` – generic parser helpers for German dates, amounts, giro transactions, and depot summaries.
- `apps/desktop/renderer/app.js` – plain JavaScript static renderer.
- `apps/desktop/renderer/styles.css` – desktop UI styling.
- `docs/` – current architecture and product notes.

## Local setup

### Prerequisites

- Node.js 20+
- npm 10+

### Commands

```bash
npm install
npm run dev
```

The desktop app launches through Electron and loads the local renderer.

### Validation

```bash
node --check apps/desktop/main.js
node --check apps/desktop/preload.js
node --check apps/desktop/renderer/app.js
node --check apps/desktop/services/pdfParser.js
node --check apps/desktop/data/storage.js
npm run typecheck -w apps/desktop
```

## Security and data hygiene

Do not commit:

- Personal names.
- Real account numbers or IBANs.
- Real transaction descriptions.
- Real PDF/CSV content.
- Imported PDFs or CSVs.
- Debug extracted text.
- Local `userData` JSON files.

## Roadmap

- Stronger layout-specific parser adapters using generic public fixtures.
- CSV/CAMT/MT940 import support.
- Export/import backup controls.
- Rule suggestions and recurring transaction detection.
- Signed desktop packages.

## License

MIT.
