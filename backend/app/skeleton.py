"""Run-me-first proof. No server, no Neon, no keys needed.

Reads the three CSVs straight from disk, does the exact keyed wait lookup and the
wait-led ordering in memory, and prints the result — so you can see the Phase 0
idea end to end before wiring Postgres.

    python -m app.skeleton                 # ranks orthopaedics from the CSVs
    python -m app.skeleton dermatology     # any specialty_id present in the data
    python -m app.skeleton --check-crypto  # exercise the Fernet encryption standard

The Phase 0 'done when': a keyed lookup returns the correct rows with date +
source, and the missing value shows as 'missing' (never 0, never fastest).
"""
import csv
import os
import sys

from app.core.config import settings


def _load(name: str) -> list[dict]:
    with open(os.path.join(settings.data_dir, name), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _days(v: str):
    v = (v or "").strip().lower()
    return None if v in ("", "missing", "none", "na", "n/a") else int(v)


def _missing_last(v):
    return (0, v) if v is not None else (1, 0)


def run(specialty: str) -> None:
    waits = [r for r in _load("waits.csv") if r["specialty"].strip() == specialty]
    if not waits:
        ids = sorted({r["specialty"] for r in _load("waits.csv")})
        print(f"No stored waits for '{specialty}'. Transcribed so far: {ids}")
        return

    rows = [{"hospital": r["hospital"].strip(),
             "first_appt_days": _days(r["first_appt_days"]),
             "date": r["observation_date"].strip(),
             "source": r["source_url"].strip()} for r in waits]
    rows.sort(key=lambda r: _missing_last(r["first_appt_days"]))

    print(f"\nWait-led ordering — {specialty} (first outpatient appointment)\n")
    for i, r in enumerate(rows, 1):
        wait = f"{r['first_appt_days']} days (HSE, {r['date']})" \
            if r["first_appt_days"] is not None else "missing"
        print(f"  {i}. {r['hospital']:<34} {wait}")
    print("\n  travel: unavailable until Phase 1 (OSRM / OTP2)\n")


def check_crypto() -> None:
    """Prove the encryption standard round-trips. Needs ENCRYPTION_KEY set."""
    from app.core import crypto
    token = crypto.encrypt("hello-at-rest")
    assert crypto.decrypt(token) == "hello-at-rest"
    print(f"crypto OK — {crypto.CRYPTO_VERSION}; ciphertext sample: {token[:24]}…")


def main() -> None:
    args = sys.argv[1:]
    if "--check-crypto" in args:
        check_crypto()
        return
    specialty = next((a for a in args if not a.startswith("-")), "orthopaedics")
    run(specialty)


if __name__ == "__main__":
    main()
