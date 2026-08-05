"""Bulk import helpers — parse a CSV or XLSX upload (exported from a
spreadsheet, another property management system, etc.) into plain row
dicts, so routes can validate/create records without caring which format
the user uploaded. Header names are normalized (lowercased, trimmed,
spaces/dashes to underscores) so "Unit Number", "unit number", and
"unit_number" all map the same way.
"""
import csv
import io
import re
from typing import List, Dict

import openpyxl
from fastapi import HTTPException, UploadFile

MAX_IMPORT_ROWS = 2000


def _normalize_header(h) -> str:
    h = str(h or "").strip().lower()
    h = re.sub(r"[\s\-]+", "_", h)
    return h


async def parse_uploaded_table(file: UploadFile) -> List[Dict[str, str]]:
    """Returns a list of row dicts with normalized header keys and
    stripped string values. Raises HTTPException(422) on anything that
    isn't a readable CSV/XLSX, or that has no data rows."""
    filename = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    rows: List[Dict[str, str]] = []

    if filename.endswith(".xlsx") or filename.endswith(".xlsm"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            rows_iter = ws.iter_rows(values_only=True)
            headers = [_normalize_header(h) for h in next(rows_iter, [])]
            for raw_row in rows_iter:
                if raw_row is None or all(v is None or str(v).strip() == "" for v in raw_row):
                    continue
                row = {headers[i]: ("" if v is None else str(v).strip()) for i, v in enumerate(raw_row) if i < len(headers)}
                rows.append(row)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Couldn't read this as an Excel file: {e}")
    else:
        # Default to CSV for .csv or anything unrecognized — most "export from
        # Excel/Sheets" workflows produce CSV anyway.
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = content.decode("latin-1")
            except Exception:
                raise HTTPException(status_code=422, detail="Couldn't read this file as CSV (unrecognized text encoding)")
        reader = csv.reader(io.StringIO(text))
        try:
            raw_headers = next(reader)
        except StopIteration:
            raise HTTPException(status_code=422, detail="File has no header row")
        headers = [_normalize_header(h) for h in raw_headers]
        for raw_row in reader:
            if not raw_row or all((v or "").strip() == "" for v in raw_row):
                continue
            row = {headers[i]: (raw_row[i].strip() if i < len(raw_row) else "") for i in range(len(headers))}
            rows.append(row)

    if not rows:
        raise HTTPException(status_code=422, detail="No data rows found in the file")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=422, detail=f"Too many rows ({len(rows)}) — max {MAX_IMPORT_ROWS} per import")

    return rows


def row_get(row: Dict[str, str], *keys: str, default: str = "") -> str:
    """Look up a value trying several possible header spellings, e.g.
    row_get(row, 'unit_number', 'unit', 'unit_#')."""
    for k in keys:
        if k in row and row[k] != "":
            return row[k]
    return default
