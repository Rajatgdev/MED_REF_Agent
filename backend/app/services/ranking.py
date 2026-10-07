"""Produce the two ranked orderings. Plain deterministic code — no model, no
hidden weights, no combined score.

The one rule that matters for safety: a missing sort key (wait is None, or travel
is None) sorts LAST, never first. A hospital with no data must never present as
the fastest option.
"""
from app.core.config import settings
from app.models.schemas import HospitalWait, RankedLists
from app.services import travel


def _missing_last(value: int | None) -> tuple[int, int]:
    """Sort key: present values ascending first, None values all after them."""
    return (0, value) if value is not None else (1, 0)


async def build(specialty_id: str, rows: list[dict],
                origin: tuple[float, float] | None = None,
                mode: str | None = None) -> RankedLists:
    """rows = store.waits_for_specialty(...). origin = (lat, lng) or None.

    Wait-led orders by the configured wait pathway; travel-led by travel minutes
    for the chosen mode. Both lists contain the same hospitals."""
    mode = mode or settings.default_mode
    tmap = await travel.matrix(origin, rows, mode)

    pathway = settings.wait_pathway
    items = [
        HospitalWait(
            hospital=r["hospital"], lat=r["lat"], lng=r["lng"],
            first_appt_days=r.get("first_appt_days"),
            inpatient_days=r.get("inpatient_days"),
            daycase_days=r.get("daycase_days"),
            observation_date=r.get("observation_date"),
            source_url=r.get("source_url"),
            travel_minutes=tmap.get(r["hospital"]),
        )
        for r in rows
    ]

    wait_led = sorted(items, key=lambda i: _missing_last(getattr(i, pathway)))
    travel_led = sorted(items, key=lambda i: _missing_last(i.travel_minutes))

    return RankedLists(specialty_id=specialty_id, pathway=pathway,
                       travel_mode=mode, wait_led=wait_led, travel_led=travel_led)