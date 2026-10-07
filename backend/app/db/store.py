"""Database access for hospitals, specialties, and waits, against Neon Postgres.

Raw SQL over the async session (no ORM — the schema lives in the .sql migrations,
this file just queries it). Everything here is an EXACT keyed lookup; there is no
model, no fuzzy match, no inference. A missing wait comes back as None and stays
None all the way to the UI.
"""
from sqlalchemy import text

from app.db.session import SessionLocal


async def list_specialties() -> list[dict]:
    """The allowlist, for the GP's manual picker and for Phase 2's enum."""
    async with SessionLocal() as s:
        rows = await s.execute(
            text("SELECT specialty_id, display_name, aliases "
                 "FROM specialties ORDER BY display_name"))
        return [dict(r._mapping) for r in rows]


async def get_wait(hospital: str, specialty: str) -> dict | None:
    """One exact (hospital, specialty) wait row, or None if not stored."""
    async with SessionLocal() as s:
        row = await s.execute(
            text("SELECT hospital, specialty, first_appt_days, inpatient_days, "
                 "daycase_days, observation_date, source_url "
                 "FROM waits WHERE hospital = :h AND specialty = :sp"),
            {"h": hospital, "sp": specialty})
        r = row.first()
        return dict(r._mapping) if r else None


async def waits_for_specialty(specialty: str) -> list[dict]:
    """Every stored hospital wait for one specialty, joined to its coordinates.

    LEFT JOIN from hospitals so a hospital with a coordinate but no wait row still
    appears — with first_appt_days = NULL (missing), never dropped and never 0.
    """
    async with SessionLocal() as s:
        rows = await s.execute(
            text("SELECT h.hospital, h.lat, h.lng, "
                 "       w.first_appt_days, w.inpatient_days, w.daycase_days, "
                 "       w.observation_date, w.source_url "
                 "FROM hospitals h "
                 "LEFT JOIN waits w "
                 "  ON w.hospital = h.hospital AND w.specialty = :sp "
                 "ORDER BY h.hospital"),
            {"sp": specialty})
        out = []
        for r in rows:
            d = dict(r._mapping)
            if d["observation_date"] is not None:
                d["observation_date"] = d["observation_date"].isoformat()
            out.append(d)
        return out


async def record_signoff(thread_id: str, specialty_id: str, specialty_name: str,
                         specialty_source: str, origin: str | None, travel_mode: str | None,
                         chosen_hospital: str, snapshot: dict) -> int:
    """Write one sign-off audit row; returns its id. No patient letter is stored —
    only the decision + the reviewed snapshot of the orderings."""
    import json
    async with SessionLocal() as s:
        row = await s.execute(
            text("INSERT INTO referral_audit (thread_id, specialty_id, specialty_name, "
                 "specialty_source, origin, travel_mode, chosen_hospital, snapshot) "
                 "VALUES (:t, :sid, :sname, :src, :o, :m, :h, CAST(:snap AS JSONB)) "
                 "RETURNING id"),
            {"t": thread_id, "sid": specialty_id, "sname": specialty_name,
             "src": specialty_source, "o": origin, "m": travel_mode,
             "h": chosen_hospital, "snap": json.dumps(snapshot)})
        await s.commit()
        return row.scalar_one()
