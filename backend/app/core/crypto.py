"""Encrypt/decrypt sensitive at-rest values with Fernet (authenticated AES).

This is the same encryption standard as Jev_Scrapper, lifted deliberately so the
whole stack shares one scheme:

  - Fernet = AES-128-CBC + HMAC-SHA256 (authenticated symmetric encryption).
  - The master key(s) live in the ENCRYPTION_KEY env var (Railway backend + any
    worker/cron service only) — never in the database, Git, or the frontend.
    Postgres stores only ciphertext.
  - MultiFernet lets us rotate the master key later: put the NEW key first, keep
    old keys after it (comma-separated), re-encrypt rows, then drop the old one.
  - Fail loud if ENCRYPTION_KEY is missing — never silently store plaintext.

Where it is used in THIS app (see docs/architecture.md): the extract-never-infer
and letter-never-leaves-local rules mean the database holds NO patient data, so
there is nothing patient-identifying to encrypt in Phase 0. The standard is wired
and ready for the two places the design does persist sensitive state later:
  1. the LangGraph Postgres checkpointer (wrap it in EncryptedSerializer), and
  2. any future audit / clinician-entered field.
Keeping one vetted module means those later writes cannot drift to a weaker scheme.
"""
import os

from cryptography.fernet import Fernet, MultiFernet

CRYPTO_VERSION = "fernet-v1"


def _build() -> MultiFernet:
    raw = os.environ.get("ENCRYPTION_KEY", "").strip()
    if not raw:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set — cannot encrypt/decrypt. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\""
        )
    keys = [Fernet(k.strip().encode()) for k in raw.split(",") if k.strip()]
    return MultiFernet(keys)


# Built lazily on first use, not at import: Phase 0 boots DB-only without a key,
# and crypto callers (checkpointer, audit) fail loud the moment they actually run.
_fernet: MultiFernet | None = None


def _get() -> MultiFernet:
    global _fernet
    if _fernet is None:
        _fernet = _build()
    return _fernet


def encrypt(plaintext: str) -> str:
    return _get().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    return _get().decrypt(ciphertext.encode("utf-8")).decode("utf-8")


def last4(plaintext: str) -> str:
    """Last 4 chars, for a masked display hint. Computed before we discard the
    plaintext; never derived from ciphertext."""
    return plaintext[-4:] if len(plaintext) >= 4 else plaintext


def decrypt_safe(value: str) -> str:
    """Decrypt a value that MAY already be plaintext (legacy/seed rows written by
    plain SQL are not valid Fernet tokens). On any decrypt failure, return the
    value unchanged. New writes are always encrypted."""
    try:
        return decrypt(value)
    except Exception:
        return value
