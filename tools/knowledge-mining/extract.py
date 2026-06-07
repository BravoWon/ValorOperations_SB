#!/usr/bin/env python3
"""Knowledge-mining extractor (pilot).

Harvests *abstractable* operational knowledge from oilfield calculation
spreadsheets + report templates: cell labels, detected units, and (for
xlsx/xlsm) formula strings. It does NOT interpret or copy proprietary formula
logic — downstream synthesis expresses the generic industry math separately and
scrubs all brand/product/personnel names.

Stack: xlrd (legacy .xls cell values/labels), openpyxl (.xlsx/.xlsm incl.
formulas). Raw output is written OUTSIDE the repo (temp) so brand-bearing
content is never committed; only the scrubbed catalog is.

Config (keeps this file brand-free):
  - Archive root: env MINING_ARCHIVE_ROOT, or argv[1].
  - Targets: optional gitignored manifest `targets.local.txt` next to this file
    (one glob per line, relative to the archive root; '#' comments allowed).
    If absent, scans all spreadsheets under the root.
  - Output: env MINING_OUT, else %TEMP%/mining_raw.json.

Usage:
  MINING_ARCHIVE_ROOT="/path/to/archive" python tools/knowledge-mining/extract.py
"""
import os
import re
import sys
import json
import glob

ARCHIVE_ROOT = os.environ.get("MINING_ARCHIVE_ROOT") or (sys.argv[1] if len(sys.argv) > 1 else None)
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "targets.local.txt")
OUT = os.environ.get("MINING_OUT") or os.path.join(
    os.environ.get("TEMP") or os.environ.get("TMPDIR") or "/tmp", "mining_raw.json"
)

# Domain unit tokens (noise-prone English-ish tokens like bare 'in'/'md' omitted on purpose).
UNIT_TOKENS = [
    "ppg", "psi/ft", "psi", "gpm", "bpm", "bps", "spm", "bbls", "bbl", "bpf",
    "ft/hr", "feet", "ft", "klbf", "kips", "lbf", "ppf", "lb/ft", "rpm", "gal",
    "sx", "sks", "°/100ft", "deg", "°", "%",
]
UNIT_RE = re.compile(
    r"(?<![A-Za-z])(" + "|".join(re.escape(u) for u in UNIT_TOKENS) + r")(?![A-Za-z])",
    re.I,
)


def clip(s, n=80):
    return str(s).strip()[:n]


def tally_units(text, units):
    for m in UNIT_RE.findall(text):
        k = m.lower()
        units[k] = units.get(k, 0) + 1


def scan_xls(path):
    import xlrd
    out = {}
    try:
        wb = xlrd.open_workbook(path)
    except Exception as e:  # noqa: BLE001
        return {"_error": str(e)}
    for name in wb.sheet_names():
        sh = wb.sheet_by_name(name)
        rows, units = [], {}
        for r in range(min(sh.nrows, 300)):
            cells = []
            for c in range(min(sh.ncols, 14)):
                v = sh.cell_value(r, c)
                sv = "" if v is None else str(v).strip()
                if not sv:
                    continue
                cells.append(clip(sv))
                tally_units(sv, units)
            if cells:
                rows.append(cells)
        out[name] = {"rows": rows[:200], "units": units}
    return out


def scan_xlsx(path):
    import openpyxl
    out = {}
    try:
        wb = openpyxl.load_workbook(path, data_only=False, read_only=True)
    except Exception as e:  # noqa: BLE001
        return {"_error": str(e)}
    for ws in wb.worksheets:
        rows, units, formulas, n = [], {}, [], 0
        for row in ws.iter_rows(values_only=True):
            cells = []
            for v in row:
                sv = "" if v is None else str(v).strip()
                if not sv:
                    continue
                cells.append(clip(sv))
                if sv.startswith("="):
                    formulas.append(clip(sv, 120))
                tally_units(sv, units)
            if cells:
                rows.append(cells)
                n += 1
            if n >= 200:
                break
        out[ws.title] = {"rows": rows, "units": units, "formulas": formulas[:50]}
    return out


def collect_targets():
    if not ARCHIVE_ROOT:
        sys.exit("Set MINING_ARCHIVE_ROOT (env) or pass the archive root as argv[1].")
    patterns = []
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as fh:
            patterns = [ln.strip() for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    if not patterns:
        patterns = ["**/*.xls", "**/*.XLS", "**/*.xlsx", "**/*.xlsm"]
    targets, seen = [], set()
    for pat in patterns:
        for p in glob.glob(os.path.join(ARCHIVE_ROOT, pat), recursive=True):
            if p not in seen:
                seen.add(p)
                targets.append(p)
    return targets


def main():
    targets = collect_targets()
    files, all_units = {}, {}
    for p in targets:
        ext = os.path.splitext(p)[1].lower()
        data = scan_xls(p) if ext == ".xls" else scan_xlsx(p)
        files[os.path.basename(p)] = {"ext": ext, "sheets": data}
        if isinstance(data, dict):
            for sd in data.values():
                if isinstance(sd, dict):
                    for u, ct in sd.get("units", {}).items():
                        all_units[u] = all_units.get(u, 0) + ct
    out = {
        "files": files,
        "unit_frequency": dict(sorted(all_units.items(), key=lambda kv: -kv[1])),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)

    print("files scanned:", len(files))
    print("\n=== unit frequency (top 30) ===")
    for u, ct in list(out["unit_frequency"].items())[:30]:
        print("  %5d  %s" % (ct, u))
    print("\n=== per-file: ext + sheet names ===")
    for fn, fd in files.items():
        sheets = fd["sheets"]
        names = list(sheets.keys()) if isinstance(sheets, dict) else []
        print("  [%s] %s  ->  %s" % (fd["ext"], fn, ", ".join(names)[:140]))
    print("\nwrote", OUT)


if __name__ == "__main__":
    main()
