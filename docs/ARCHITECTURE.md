# Architecture

## Current local desktop app

German Bank Statement Analyzer currently ships as a plain JavaScript Electron app with a static local renderer.

- **Electron main process**: creates the desktop window, reads selected local PDF/CSV files, extracts PDF text locally, computes file hashes, and merges parsed data.
- **Preload bridge**: exposes a small `window.bankAnalyzer` IPC API for loading, saving, and importing local data.
- **Static renderer**: renders account navigation, summary cards, transaction tables, and analysis views without a browser build step.
- **JSON storage helper**: persists data in Electron `userData` as `german-bank-statement-analyzer-data.json`.
- **Generic parser helper**: parses common German amount/date patterns and simple giro/depot summary text layouts.

## Deterministic transaction identity

Stable transaction IDs are generated from neutral import and transaction fields:

`sha256(accountId + sourceFileId + bookingDate + amount + normalizedDescription)`

Normalization focuses on local parser inputs:

- trim edges
- collapse repeated spaces and line breaks
- parse German `dd.mm.yyyy` dates
- parse German amounts such as `1.234,56`

## Re-import and dedupe

- Imports are local-only.
- Re-import of the same file hash replaces or skips records from that file.
- Existing rows from other files are preserved.
- Transaction IDs prevent duplicate insertion across repeated import of identical records.

## Parser status

The parser is generic and experimental. Users must validate transactions, balances, categories, tags, and depot summary values manually after import.
