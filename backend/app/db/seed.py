"""Load the three CSVs (data/*.csv) into Postgres. Idempotent: truncates and
re-inserts, so editing a CSV and re-running is the whole update path.

Run on the DIRECT url, after migrate:  python -m app.db.seed

The CSVs are the editable source of truth; this script is the only thing that
writes the tables. In production the same `waits` table is refilled monthly from
an authorised HSE export — same columns, different filler. Nothing here infers.
"""
import csv
import os

import psycopg

from app.core.config import settings


def _int_or_none(v: str) -> int | None:
    """A wait cell is either an integer number of days or the literal 'missing'.
    Missing stays NULL — never 0 — so a hospital with no data can't rank fastest."""
    v = (v or "").strip().lower()
    if v in ("", "missing", "none", "na", "n/a"):
        return None
    return int(v)


def _rows(name: str):
    path = os.path.join(settings.data_dir, name)
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def main() -> None:
    if not settings.database_url_direct:
        raise SystemExit("DATABASE_URL_DIRECT is not set — cannot seed")

    with psycopg.connect(settings.database_url_direct) as conn:
        # Order matters: waits references hospitals + specialties.
        conn.execute("TRUNCATE waits, hospitals, specialties RESTART IDENTITY CASCADE")

        for r in _rows("hospitals.csv"):
            conn.execute(
                "INSERT INTO hospitals (hospital, lat, lng) VALUES (%s, %s, %s)",
                (r["hospital"].strip(), float(r["lat"]), float(r["lng"])),
            )

        for r in _rows("specialties.csv"):
            conn.execute(
                "INSERT INTO specialties (specialty_id, display_name, aliases) "
                "VALUES (%s, %s, %s)",
                (r["specialty_id"].strip(), r["display_name"].strip(),
                 r.get("aliases", "").strip()),
            )

        for r in _rows("waits.csv"):
            conn.execute(
                "INSERT INTO waits (hospital, specialty, first_appt_days, "
                "inpatient_days, daycase_days, observation_date, source_url) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (r["hospital"].strip(), r["specialty"].strip(),
                 _int_or_none(r["first_appt_days"]),
                 _int_or_none(r["inpatient_days"]),
                 _int_or_none(r["daycase_days"]),
                 r["observation_date"].strip(), r["source_url"].strip()),
            )

        conn.commit()
    print("seed complete")


if __name__ == "__main__":
    main()
