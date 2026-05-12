# v0.1 Spec Snapshot

## Product

German Bank Statement Analyzer is a local-first desktop app for importing German giro statements and depot summaries, categorizing transactions, and reviewing month/year financial analysis.

## Current implementation

- Plain JavaScript Electron shell.
- Static renderer loaded from local files.
- JSON storage in Electron `userData`.
- Four neutral account areas: Primary Giro, Primary Depot, Secondary Giro, Secondary Depot.
- Local PDF/CSV import from the desktop file picker.
- Generic parser helpers for German dates, German amounts, split lines, giro transactions, depot PDF summaries, and depot CSV summaries.
- Deterministic transaction IDs and same-file re-import handling.
- Default categories and exactly three tags: Fixed, Variable, Saving.

## Important limitation

The parser is generic and experimental. It does not claim complete support for every German bank layout. Users should manually validate parsed transactions, balances, tags, and categories.

## Next milestones

- Public synthetic parser fixtures.
- Stronger parser adapters for common neutral layout families.
- CSV/JSON export-import for backups.
- Rule suggestions and recurring transaction detection.
- Optional build tooling can be reconsidered after the local workflow stabilizes.
