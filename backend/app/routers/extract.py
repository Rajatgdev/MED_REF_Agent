"""Phase 2 API: parse an uploaded/pasted referral and extract the stated specialty.

Text-layer PDFs, .docx and pasted text are read locally (no egress). Image-only
PDFs and image uploads fall back to hosted OCR (Mistral) when MISTRAL_API_KEY is
set; otherwise they're rejected (no silent empty extraction). Either way the text
then goes through the same extraction + verbatim-span validator. The letter is
discarded after; only the small ExtractResult returns to the browser.
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.models.schemas import ExtractResult
from app.services import extraction, ocr, parsing

router = APIRouter(prefix="/api", tags=["extract"])

_IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif")


async def _ocr_or_422(filename: str, data: bytes) -> str:
    try:
        return await ocr.ocr_document(filename, data)
    except ocr.OcrError as e:
        raise HTTPException(422, str(e))


@router.post("/extract", response_model=ExtractResult)
async def extract(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    raw_text = (text or "").strip()

    if file is not None and file.filename:
        data = await file.read()
        if len(data) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(413, f"File too large (max {settings.max_upload_mb} MB).")
        name = file.filename.lower()

        if name.endswith(_IMAGE_EXT):
            # an image is never text-parseable — OCR or reject
            if not ocr.enabled():
                raise HTTPException(422, "Image files need OCR — set MISTRAL_API_KEY, or upload a text-layer PDF/.docx.")
            print("[extract] path=OCR (image upload)", flush=True)
            raw_text = await _ocr_or_422(file.filename, data)
        else:
            try:
                raw_text = parsing.parse_referral(file.filename, data)
                print("[extract] path=local parse (text layer)", flush=True)
            except parsing.ParseError as e:
                # image-only PDF: fall back to OCR if configured
                if name.endswith(".pdf") and ocr.enabled():
                    print("[extract] path=OCR (image-only PDF fallback)", flush=True)
                    raw_text = await _ocr_or_422(file.filename, data)
                else:
                    raise HTTPException(422, str(e))

    if not raw_text:
        raise HTTPException(400, "Provide a referral: upload a file or paste text.")

    return await extraction.extract_specialty(raw_text)