"""Document Intelligence Agent — text extraction and keyword field extraction.

Real text extraction for digital PDFs (via pypdf) and plain-text files. This
does NOT do OCR on scanned/image-based PDFs or photos — there's no OCR engine
wired up — and search is keyword/substring matching over the extracted text,
not vector-embedding semantic search, since no vector database is configured.
Both limitations are surfaced to the user rather than silently faked.
"""
import logging
import re
from datetime import datetime, date

logger = logging.getLogger(__name__)

SUPPORTED_TEXT_MIME = {"text/plain", "text/csv"}
SUPPORTED_PDF_MIME = {"application/pdf"}

# Looks for "$1,234.56" or "1234.56" immediately preceded by a keyword, e.g. "Rent: $1,850"
FIELD_PATTERNS = {
    "rent": re.compile(r"(?:monthly\s+)?rent[^\d$]{0,15}\$?\s*([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
    "deposit": re.compile(r"(?:security\s+)?deposit[^\d$]{0,15}\$?\s*([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
    "late_fee": re.compile(r"late\s+fee[^\d$]{0,15}\$?\s*([\d,]+(?:\.\d{2})?)", re.IGNORECASE),
}
DATE_PATTERNS = {
    "renewal_date": re.compile(r"renewal\s+date[:\s]{0,10}([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})", re.IGNORECASE),
    "expiration_date": re.compile(r"expir\w*\s+(?:date)?[:\s]{0,10}([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})", re.IGNORECASE),
}
BOOL_PATTERNS = {
    "pets_allowed": re.compile(r"pets?\s+(allowed|permitted)", re.IGNORECASE),
    "no_pets": re.compile(r"no\s+pets", re.IGNORECASE),
}


def extract_text(file_bytes: bytes, mime_type: str) -> tuple:
    """Returns (extracted_text_or_None, status) where status is one of
    'extracted', 'unsupported', 'failed'."""
    try:
        if mime_type in SUPPORTED_PDF_MIME:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(file_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(pages).strip()
            if not text:
                return None, "unsupported"  # likely a scanned/image-based PDF — no OCR available
            return text, "extracted"

        if mime_type in SUPPORTED_TEXT_MIME:
            return file_bytes.decode("utf-8", errors="replace"), "extracted"

        return None, "unsupported"
    except Exception as e:
        logger.warning(f"Text extraction failed: {e}")
        return None, "failed"


def extract_fields(text: str) -> dict:
    """Regex-based key-field extraction — a rule-based pass, not an NLP model."""
    if not text:
        return {}
    fields = {}
    for key, pattern in FIELD_PATTERNS.items():
        m = pattern.search(text)
        if m:
            fields[key] = m.group(1).replace(",", "")
    for key, pattern in DATE_PATTERNS.items():
        m = pattern.search(text)
        if m:
            fields[key] = m.group(1)
    if BOOL_PATTERNS["no_pets"].search(text):
        fields["pet_policy"] = "not allowed"
    elif BOOL_PATTERNS["pets_allowed"].search(text):
        fields["pet_policy"] = "allowed"
    return fields


def build_snippet(text: str, query: str, context_chars: int = 80) -> str:
    if not text:
        return ""
    idx = text.lower().find(query.lower())
    if idx == -1:
        return text[:160].strip() + "…"
    start = max(0, idx - context_chars)
    end = min(len(text), idx + len(query) + context_chars)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"
