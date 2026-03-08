# German Bank PDF Statement Analyzer

Local-first desktop application for importing and analyzing **German giro account** PDF statements.

## Privacy-first principles

- Everything runs locally on your machine.
- Core features require no cloud services.
- No telemetry, trackers, or auto-upload behavior.
- Demo content in this repository is synthetic only.

## Features in v0.1 scaffold

- Electron desktop shell with React + TypeScript UI.
- SQLite local storage for transactions, imports, rules, and monthly summaries.
- Parser pipeline (`BaseGermanBankParser` + generic implementation).
- Deterministic transaction IDs based on normalized text and signed amount.
- Re-import behavior replacing records from same source file only.
- Layered categorization logic: manual override → user rule → built-in rule → fallback.
- Dashboard and analysis charts (monthly trend + tag split).

## Repository structure

- `apps/desktop` – Electron + React local app.
- `packages/shared-types` – typed domain models.
- `packages/parser` – parser interfaces and generic parser.
- `packages/db` – SQLite schema and storage operations.
- `packages/rules` – categorization rule engine.
- `docs/` – product and architecture notes.

## macOS local setup

### Prerequisites

- Node.js 20+
- npm 10+

### Commands

```bash
npm install
npm run dev
```

The desktop app will launch through Electron and open the local renderer.

### Local data locations

- Database file: Electron `userData` directory, file name `german-bank-statement-analyzer.db`.
- Imported source metadata: stored in SQLite `import_files` table.
- Transaction and summary records: stored in SQLite `transactions` and `monthly_summaries` tables.

## Import workflow

1. Open **Imports** section.
2. Use **Import PDF files** for local machine-generated PDFs.
3. Use **Import synthetic demo batch** for safe test data.
4. Review parsed transactions and chart summaries.

## Current limitations

- Generic parser supports common machine-generated statement layouts only.
- OCR is not included in v0.1.
- CSV/JSON export and restore UI controls are planned next.

## Roadmap

- Additional German statement layout adapters.
- CSV / CAMT / MT940 import.
- Rule suggestions and recurring transaction detection.
- Budget targets and multi-account support.
- Dark mode and signed macOS packaging.

## License

MIT.
