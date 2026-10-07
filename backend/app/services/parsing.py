"""Local referral parsing: text-layer PDF (pdfplumber), DOCX (python-docx), or
plain text. Runs on the backend only — no OCR, no egress. Encrypted, scanned, or
empty files are rejected rather than guessed at.
"""
import io

import pdfplumber
from docx import Document


class ParseError(ValueError):
    """The file couldn't be read as a typed referral (encrypted/scanned/corrupt/
    unsupported). Surfaced to the GP as a 422, never a silent empty extraction."""


def parse_referral(filename: str, data: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text = _pdf(data)
    elif name.endswith(".docx"):
        text = _docx(data)
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise ParseError("Unsupported file type. Upload a text-layer PDF or .docx, or paste text.")
    text = text.strip()
    if not text:
        raise ParseError("No readable text found. Scanned/image PDFs are not supported (no OCR).")
    return text


def _pdf(data: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception as e:
        raise ParseError("Could not read the PDF (encrypted, corrupt, or no text layer).") from e


def _docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        raise ParseError("Could not read the Word file (corrupt or not a .docx).") from e