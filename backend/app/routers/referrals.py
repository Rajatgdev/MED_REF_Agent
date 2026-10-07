"""Read-only API for Phases 0-1: the approved specialty list and the two ranked
orderings for a specialty, from a coarse origin.

No upload, no extraction, no booking — those are later phases with their own
clinician gates. An unknown specialty is a 404, not a guess. The origin is a
coarse TOWN (geocoded locally) or an explicit lat/lng; a town that can't be
resolved is a 422, never a silent fallback.
"""
from fastapi import APIRouter, HTTPException, Query

from app.db import store
from app.models.schemas import RankedLists
from app.services import geocode, ranking

router = APIRouter(prefix="/api", tags=["referrals"])


@router.get("/specialties")
async def specialties():
    """The allowlist. The GP picks from this; Phase 2's extractor is bound to it."""
    return await store.list_specialties()


@router.get("/rank", response_model=RankedLists)
async def rank(
    specialty: str = Query(..., description="specialty_id from /api/specialties"),
    origin: str | None = Query(None, description="coarse town, geocoded locally"),
    lat: float | None = Query(None, description="origin latitude (alternative to town)"),
    lng: float | None = Query(None, description="origin longitude (alternative to town)"),
    mode: str = Query("driving", pattern="^(driving|transit)$"),
):
    known = {s["specialty_id"] for s in await store.list_specialties()}
    if specialty not in known:
        raise HTTPException(404, f"Unknown specialty '{specialty}'. Pick one from /api/specialties.")

    point: tuple[float, float] | None = None
    if lat is not None and lng is not None:
        point = (lat, lng)
    elif origin and len(origin.strip()) >= 3:
        try:
            point = await geocode.geocode_town(origin)
        except geocode.GeocodeError as e:
            raise HTTPException(503, str(e))
        if point is None:
            raise HTTPException(422, f"Could not resolve origin '{origin}'. Try a nearby town.")

    rows = await store.waits_for_specialty(specialty)
    return await ranking.build(specialty, rows, point, mode)