"""The data shapes the API returns. Deterministic Python owns every number here;
nothing in this file is produced by a model.

Wait and travel are shown SEPARATELY — there is no hidden combined score. A
missing wait or an uncomputed route is None, surfaced to the UI as 'unavailable',
never as 0.
"""
from pydantic import BaseModel


class HospitalWait(BaseModel):
    """One hospital's wait + travel for a given specialty."""
    hospital: str
    lat: float
    lng: float
    first_appt_days: int | None = None      # None = missing (HSE has no data)
    inpatient_days: int | None = None
    daycase_days: int | None = None
    observation_date: str | None = None      # provenance: shown with the number
    source_url: str | None = None
    travel_minutes: int | None = None        # None = no route computed (Phase 1)


class RankedLists(BaseModel):
    """The two orderings the GP reviews: one wait-led, one travel-led.

    Each list holds the SAME hospitals in a different order. Hospitals whose
    sort key is missing are appended last (never treated as fastest)."""
    specialty_id: str
    pathway: str                             # which wait column ordered wait_led
    travel_mode: str                         # 'driving' | 'transit' — how travel_led was computed
    wait_led: list[HospitalWait]
    travel_led: list[HospitalWait]


class ExtractResult(BaseModel):
    """Phase 2: the specialty extraction result shown at the GP confirm gate.

    source 'model' = validated (specialty on the allowlist AND its evidence quote
    appears verbatim in the letter). source 'none' = abstained or failed — the GP
    selects manually; never a guess."""
    specialty_id: str | None = None
    display_name: str | None = None
    evidence_quote: str | None = None
    source: str                              # 'model' | 'none'
    detail: str = ""
