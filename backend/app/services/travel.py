"""Travel time from a coarse origin to each hospital, self-hosted.

Driving  -> OSRM Table service (one source, N destinations, durations only).
Transit  -> OpenTripPlanner 2 (NTA/TFI GTFS), one plan per hospital, Dublin time.

Both engines run locally (infra/ stack) so no patient-derived coordinate reaches
a third party. The one rule that never bends: a missing or unroutable leg is
None, surfaced as 'unavailable' — NEVER zero minutes. If an engine URL is not
configured, every hospital is None (nothing is guessed).
"""
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.core.config import settings


# ---- pure parsers ---------------------------------------------------------

def parse_osrm_table(payload: dict, n_dest: int) -> list[int | None]:
    """OSRM /table with sources=0: durations[0] is [source, dest1..destN] in
    seconds. Return N destination minutes (source entry dropped). null -> None."""
    durations = (payload.get("durations") or [[]])[0]
    legs = durations[1:]  # drop the source->source 0
    out: list[int | None] = []
    for i in range(n_dest):
        sec = legs[i] if i < len(legs) else None
        out.append(round(sec / 60) if isinstance(sec, (int, float)) else None)
    return out


def parse_otp2_duration(payload: dict) -> int | None:
    """OTP2 plan response: shortest itinerary duration (seconds) -> minutes.
    No itinerary -> None."""
    itineraries = (((payload.get("data") or {}).get("plan") or {})
                   .get("itineraries") or [])
    durs = [it["duration"] for it in itineraries if it.get("duration") is not None]
    return round(min(durs) / 60) if durs else None


# ---- engine calls ---------------------------------------------------------

async def _driving(origin: tuple[float, float],
                   hospitals: list[dict]) -> dict[str, int | None]:
    if not settings.osrm_url:
        return {h["hospital"]: None for h in hospitals}
    # OSRM wants lng,lat; source first, then the hospitals in order.
    coords = [f"{origin[1]},{origin[0]}"] + [f"{h['lng']},{h['lat']}" for h in hospitals]
    url = (settings.osrm_url.rstrip("/") + "/table/v1/driving/" + ";".join(coords))
    async with httpx.AsyncClient(timeout=settings.routing_timeout_seconds) as c:
        r = await c.get(url, params={"sources": "0", "annotations": "duration"})
        r.raise_for_status()
        minutes = parse_osrm_table(r.json(), len(hospitals))
    return {h["hospital"]: m for h, m in zip(hospitals, minutes)}


def _next_weekday_morning() -> str:
    """A representative transit departure: today 09:00 in the configured tz
    (ISO-8601). Deterministic input to OTP2 so results are reproducible."""
    now = datetime.now(ZoneInfo(settings.transit_timezone))
    return now.replace(hour=9, minute=0, second=0, microsecond=0).isoformat()

_OTP2_QUERY = """
query ($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $when: String!) {
  plan(from: {lat: $fromLat, lon: $fromLon}, to: {lat: $toLat, lon: $toLon},
       date: $when, transportModes: [{mode: TRANSIT}, {mode: WALK}]) {
    itineraries { duration }
  }
}
"""


async def _transit(origin: tuple[float, float],
                   hospitals: list[dict]) -> dict[str, int | None]:
    if not settings.otp2_url:
        return {h["hospital"]: None for h in hospitals}
    url = settings.otp2_url.rstrip("/") + "/otp/gtfs/v1"
    when = _next_weekday_morning()
    out: dict[str, int | None] = {}
    async with httpx.AsyncClient(timeout=settings.routing_timeout_seconds) as c:
        for h in hospitals:
            try:
                r = await c.post(url, json={"query": _OTP2_QUERY, "variables": {
                    "fromLat": origin[0], "fromLon": origin[1],
                    "toLat": h["lat"], "toLon": h["lng"], "when": when}})
                r.raise_for_status()
                out[h["hospital"]] = parse_otp2_duration(r.json())
            except httpx.HTTPError:
                out[h["hospital"]] = None   # unreachable leg stays unavailable
    return out


async def matrix(origin: tuple[float, float] | None,
                 hospitals: list[dict], mode: str) -> dict[str, int | None]:
    """hospital -> travel minutes (or None). No origin -> all None."""
    if origin is None:
        return {h["hospital"]: None for h in hospitals}
    if mode == "transit":
        return await _transit(origin, hospitals)
    return await _driving(origin, hospitals)