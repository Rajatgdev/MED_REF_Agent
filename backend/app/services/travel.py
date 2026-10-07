"""Travel time from a coarse origin to each hospital.

OPTION B (TEMPORARY): hosted OpenRouteService matrix for DRIVING. ORS has no
public-transport routing, so transit returns 'unavailable' here — real transit
comes back with the self-hosted OTP2 switch-back (see docs/architecture.md).

ORS is EU-hosted but a third party; this is a stopgap for local hardware limits
and MUST revert to self-hosted OSRM/OTP2 before real patient data. The one rule
that never bends: a missing or unroutable leg is None, surfaced as 'unavailable'
— NEVER zero minutes. No API key -> everything None (nothing guessed).
"""
import httpx

from app.core.config import settings


def parse_ors_matrix(payload: dict, n_dest: int) -> list[int | None]:
    """ORS matrix with sources=[0]: durations[0] is [source, dest1..destN] in
    seconds. Return N destination minutes (source entry dropped). null -> None."""
    durations = (payload.get("durations") or [[]])[0]
    legs = durations[1:]  # drop the source->source 0
    out: list[int | None] = []
    for i in range(n_dest):
        sec = legs[i] if i < len(legs) else None
        out.append(round(sec / 60) if isinstance(sec, (int, float)) else None)
    return out


async def _driving(origin: tuple[float, float],
                   hospitals: list[dict]) -> dict[str, int | None]:
    if not settings.ors_api_key:
        return {h["hospital"]: None for h in hospitals}
    # ORS wants [lng, lat]; source first, then the hospitals in order.
    locations = [[origin[1], origin[0]]] + [[h["lng"], h["lat"]] for h in hospitals]
    url = settings.ors_base_url.rstrip("/") + "/v2/matrix/driving-car"
    body = {"locations": locations, "sources": [0], "metrics": ["duration"]}
    headers = {"Authorization": settings.ors_api_key}
    async with httpx.AsyncClient(timeout=settings.routing_timeout_seconds) as c:
        r = await c.post(url, json=body, headers=headers)
        r.raise_for_status()
        minutes = parse_ors_matrix(r.json(), len(hospitals))
    return {h["hospital"]: m for h, m in zip(hospitals, minutes)}


async def matrix(origin: tuple[float, float] | None,
                 hospitals: list[dict], mode: str) -> dict[str, int | None]:
    """hospital -> travel minutes (or None). No origin -> all None.
    transit is unavailable on ORS (Option B) -> all None until the OTP2 switch-back."""
    if origin is None or mode == "transit":
        return {h["hospital"]: None for h in hospitals}
    return await _driving(origin, hospitals)