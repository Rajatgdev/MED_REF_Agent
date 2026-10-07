"""Coarse origin -> a single map point, via hosted OpenRouteService (Pelias).

OPTION B (TEMPORARY). ORS is EU-hosted (HeiGIT, Germany), so the coarse origin
stays in the EU — but it is still disclosed to a third-party processor. This
MUST revert to self-hosted Nominatim before any real patient data; see
docs/architecture.md. We bias to Ireland and take the first result's centroid.
No result -> None (ask again); we never invent a coordinate.
"""
import httpx

from app.core.config import settings


class GeocodeError(RuntimeError):
    pass


def parse_ors_geocode(payload: dict) -> tuple[float, float] | None:
    """Pure: first (lat, lng) from an ORS/Pelias GeoJSON FeatureCollection, or
    None if empty. ORS coordinates are [lng, lat] — we flip to (lat, lng)."""
    features = payload.get("features") or []
    if not features:
        return None
    lng, lat = features[0]["geometry"]["coordinates"][:2]
    return (float(lat), float(lng))


async def geocode_town(town: str) -> tuple[float, float] | None:
    """Resolve a coarse town to (lat, lng). None if nothing matches.

    Raises GeocodeError only when ORS is unconfigured or unreachable — a
    configuration problem, distinct from 'the town wasn't found'."""
    if not settings.ors_api_key:
        raise GeocodeError("ORS_API_KEY is not set — cannot geocode the origin.")
    url = settings.ors_base_url.rstrip("/") + "/geocode/search"
    params = {"api_key": settings.ors_api_key, "text": town,
              "boundary.country": "IE", "size": 1}
    try:
        async with httpx.AsyncClient(timeout=settings.routing_timeout_seconds) as c:
            r = await c.get(url, params=params)
            r.raise_for_status()
            return parse_ors_geocode(r.json())
    except httpx.HTTPError as e:
        raise GeocodeError(f"ORS geocode request failed: {e}") from e