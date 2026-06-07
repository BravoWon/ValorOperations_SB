# Knowledge Mining

`extract.py` harvests **units, cell labels, and structure** (and formulas for `.xlsx/.xlsm`) from
oilfield calculation spreadsheets / report templates into a raw JSON dump. The raw dump is written
to a temp path **outside the repo** and is never committed. Downstream synthesis produces a
**brand-scrubbed Domain Catalog** under `docs/superpowers/knowledge/`.

## Run
1. *(optional)* Create `targets.local.txt` next to this README (gitignored) — one glob per line,
   relative to the archive root — to narrow the scan. Without it, all spreadsheets under the root
   are scanned.
2. Run:
   ```bash
   MINING_ARCHIVE_ROOT="/path/to/archive" python tools/knowledge-mining/extract.py
   ```

## IP rule (non-negotiable)
Never commit raw output, source-specific paths, or any brand/product/personnel/client/well/location
names. Commit only the **scrubbed catalog**. Catalog formulas are standard, publicly-documented
industry math, restated independently — not copied from source files.

## Deps
`pip install openpyxl xlrd` (pandas optional). `.xls` formula bytes are intentionally not extracted.
