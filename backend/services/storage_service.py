"""File storage -- Cloudflare R2 (S3-compatible) when configured, falling
back to local disk otherwise.

Real bug this fixes: routes/documents.py and routes/inspections.py used to
write straight to local disk (/app/uploads/...). Render's local disk is
ephemeral -- wiped on every deploy or restart -- so every uploaded document
and inspection photo was silently lost the next time the app redeployed.
The database row survived (filename, extracted text, a file_path pointing
at nothing), so the UI kept showing the document as if it existed; only
actually opening/downloading it would reveal the file was gone.

Callers never need to know which backend is active: save_file() returns
whatever value should be stored in the DB's file_path column (an R2 object
key, or a local path as a fallback), and that same value round-trips
through load_file()/get_download_url()/delete_file() later. The local-disk
path stays fully supported so this is a no-op for any environment (e.g.
local dev) that hasn't set the four R2_* settings.
"""
import logging
import os
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# Fallback root only -- unrelated to the R2 bucket. Kept as the same path
# the routes used before this existed, so anything already on disk in an
# environment that never configures R2 keeps working unchanged.
_LOCAL_ROOT = "/app/uploads"

_client = None
_warned_unconfigured = False


def is_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY and settings.R2_BUCKET_NAME
    )


def _client_for_r2():
    global _client
    if _client is None:
        import boto3
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _client


def _is_local_path(stored_value: str) -> bool:
    # Local paths always start with _LOCAL_ROOT (an absolute path); R2 object
    # keys are always relative (e.g. "documents/{org_id}/{uuid}_{name}") and
    # never start with "/", so this is a reliable, cheap discriminator that
    # works for both old rows (written before R2 was configured) and new
    # ones, without needing a separate "backend" column.
    return stored_value.startswith(_LOCAL_ROOT)


def save_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Saves `data` and returns the value to persist in the DB's file_path
    column. `key` should be a relative path like
    "documents/{org_id}/{uuid}_{filename}" -- used as the R2 object key
    directly, or joined onto _LOCAL_ROOT for the local-disk fallback.

    Callers should run this via run_in_threadpool -- it's a synchronous
    network call (boto3), and calling it directly inside an async route
    handler stalls this server's entire single event loop for the R2
    round-trip, blocking every other concurrent user's request."""
    if is_configured():
        try:
            _client_for_r2().put_object(
                Bucket=settings.R2_BUCKET_NAME, Key=key, Body=data, ContentType=content_type,
            )
        except Exception:
            logger.exception(f"R2 put_object failed for key {key!r}")
            raise
        return key

    global _warned_unconfigured
    if not _warned_unconfigured:
        logger.warning(
            "R2 is not configured (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/"
            "R2_BUCKET_NAME) -- falling back to local disk, which does NOT persist "
            "across deploys or restarts on Render. Uploaded files will be lost on the "
            "next deploy until R2 is configured."
        )
        _warned_unconfigured = True

    local_path = os.path.join(_LOCAL_ROOT, key)
    # Same protection routes/documents.py and routes/inspections.py used to
    # each duplicate inline -- centralized here since this is now the only
    # place that actually touches the filesystem. `key` is built from
    # trusted UUIDs plus a caller-sanitized filename, but this stays as a
    # defense-in-depth backstop against a path-traversal key.
    if os.path.commonpath([os.path.abspath(local_path), os.path.abspath(_LOCAL_ROOT)]) != os.path.abspath(_LOCAL_ROOT):
        raise ValueError(f"Refusing to write outside {_LOCAL_ROOT!r}: {key!r}")
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(data)
    return local_path


def load_file(stored_value: str) -> bytes:
    """Reads back whatever save_file() returned earlier. Same
    run_in_threadpool requirement as save_file() -- synchronous boto3 call."""
    if _is_local_path(stored_value):
        if not os.path.exists(stored_value):
            raise FileNotFoundError(stored_value)
        with open(stored_value, "rb") as f:
            return f.read()
    try:
        obj = _client_for_r2().get_object(Bucket=settings.R2_BUCKET_NAME, Key=stored_value)
        return obj["Body"].read()
    except Exception:
        logger.exception(f"R2 get_object failed for key {stored_value!r}")
        raise


def get_download_url(stored_value: str, filename: str, expires_in: int = 300) -> Optional[str]:
    """A short-lived presigned R2 URL for direct client download, so the
    file is served straight from Cloudflare's edge instead of proxying the
    full bytes back through the backend. Returns None for a local-disk
    path (no presigned-URL concept there) -- caller should fall back to
    streaming the bytes itself via load_file() in that case. Same
    run_in_threadpool requirement as save_file()."""
    if _is_local_path(stored_value):
        return None
    try:
        return _client_for_r2().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.R2_BUCKET_NAME,
                "Key": stored_value,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=expires_in,
        )
    except Exception:
        logger.exception(f"R2 generate_presigned_url failed for key {stored_value!r}")
        raise


def delete_file(stored_value: str) -> None:
    """Best-effort delete -- callers already soft-delete the DB row and
    don't depend on this succeeding (matches the existing is_active=False
    pattern; a failure here shouldn't block the request)."""
    try:
        if _is_local_path(stored_value):
            if os.path.exists(stored_value):
                os.remove(stored_value)
        else:
            _client_for_r2().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=stored_value)
    except Exception:
        logger.exception(f"Failed to delete stored file {stored_value!r}")
