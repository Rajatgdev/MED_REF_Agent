"""Coarse origin -> a single map point, via self-hosted Nominatim.

Privacy-first: the GP gives a TOWN, not a full address. Nominatim runs locally
(infra/ stack) so the origin never reaches a third party. We bias to Ireland and
take the first result's centroid. No result -> None (the caller shows the origin
as unresolved and asks again); we never invent a coordinate, and an Eircode
routing key is never expanded into a full Eircode.
"""
import httpx

from app.core.config import settings


class GeocodeError(RuntimeError):
    pass


def parse_nominatim(payload: list) -> tuple[float, float] | None:
    """Pure: first (lat, lng) from a Nominatim JSON array, or None if empty."""
    if not payload:
        return None
    top = payload[0]
    return (float(top["lat"]), float(top["lon"]))


async def geocode_town(town: str) -> tuple[float, float] | None:
    """Resolve a coarse town to (lat, lng). Returns None if nothing matches.

    Raises GeocodeError only when Nominatim is unconfigured or unreachable — a
    configuration problem, distinct from 'the town wasn't found'."""
    if not settings.nominatim_url:
        raise GeocodeError("NOMINATIM_URL is not set — cannot geocode the origin.")
    url = settings.nominatim_url.rstrip("/") + "/search"
    params = {"q": town, "format": "json", "limit": 1, "countrycodes": "ie"}
    try:
        async with httpx.AsyncClient(timeout=settings.routing_timeout_seconds) as c:
            r = await c.get(url, params=params,
                            headers={"User-Agent": "referral-options-agent/0.1"})
            r.raise_for_status()
            return parse_nominatim(r.json())
    except httpx.HTTPError as e:
        raise GeocodeError(f"Nominatim request failed: {e}") from e