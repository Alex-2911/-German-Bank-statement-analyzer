# Architecture

## Local-first modules

- **desktop app**: Electron shell + React views.
- **parser package**: statement text parsing pipeline.
- **db package**: SQLite schema and import-safe replace logic.
- **rules package**: layered category and tag assignment.
- **shared-types**: canonical typed contracts.

## Deterministic transaction identity

Stable transaction ID strategy:

`sha256(accountType + bookingDate + amount + normalizedDescription)`

Normalization:

- trim edges
- collapse repeated spaces and line breaks
- normalize umlauts and ß consistently
- lowercase for deterministic matching

## Re-import and dedupe

- Imports are additive by source file.
- Re-import of same file hash replaces rows from that file only.
- Existing rows from other files are preserved.
- Transaction IDs prevent duplicate insertion across repeated import of identical records.

## Rule precedence

1. Manual transaction override
2. User-defined rules (enabled, ascending priority)
3. Built-in defaults (ascending priority)
4. Fallback: `Other` + default tag mapping
