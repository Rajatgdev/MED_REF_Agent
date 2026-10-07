"""Read-only API for Phase 0: the approved specialty list and the two ranked
orderings for a specialty.

No upload, no extraction, no booking — those are later phases with their own
clinician gates. An unknown specialty is a 404, not a guess.
"""
from fastapi import APIRouter, HTTPException, Query

from app.db import store
from app.models.schemas import RankedLists
from app.services import ranking

router = APIRouter(prefix="/api", tags=["referrals"])


@router.get("/specialties")
async def specialties():
    """The allowlist. The GP picks from this; Phase 2's extractor is bound to it."""
    return await store.list_specialties()


@router.get("/rank", response_model=RankedLists)
async def rank(
    specialty: str = Query(..., description="specialty_id from /api/specialties"),
    lat: float | None = Query(None, description="coarse origin latitude (Phase 1)"),
    lng: float | None = Query(None, description="coarse origin longitude (Phase 1)"),
):
    known = {s["specialty_id"] for s in await store.list_specialties()}
    if specialty not in known:
        raise HTTPException(404, f"Unknown specialty '{specialty}'. Pick one from /api/specialties.")
    rows = await store.waits_for_specialty(specialty)
    origin = (lat, lng) if lat is not None and lng is not None else None
    return ranking.build(specialty, rows, origin)
