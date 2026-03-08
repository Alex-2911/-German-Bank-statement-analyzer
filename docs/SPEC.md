# v0.1 Spec Snapshot

## Product

German Bank PDF Statement Analyzer is a local-first app for importing German giro statement PDFs, categorizing transactions, and reviewing month/year financial analysis.

## Implemented in this scaffold

- Typed models for transactions, monthly summaries, import files, rules, settings.
- SQLite schema for imports, transactions, summaries, and rules.
- Parser abstraction with generic parser and warning/confidence output.
- Deterministic transaction identity and same-file replacement imports.
- Rule precedence implementation and default category/tag mappings.
- Desktop UI sections for dashboard, imports, transactions, analysis, rules, settings.

## Next milestones

- Manual category/tag override editing UI.
- Rule management table with reorder and preview.
- CSV/JSON export-import for backups.
- Additional parser adapters for more layout families.
