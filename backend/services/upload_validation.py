import os
from fastapi import HTTPException, UploadFile

ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


def validate_upload(file: UploadFile) -> None:
    """Reject uploads by extension/size before they're written to disk and
    re-served publicly as-is (StaticFiles content-sniffs by extension, so an
    unvalidated .html/.svg upload would be served back as live markup)."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '(none)'}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size / 1024 / 1024:.1f} MB). Max is {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
        )
