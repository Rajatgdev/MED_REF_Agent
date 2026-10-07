"""Travel time from a coarse origin to each hospital.

Phase 1 fills this in with self-hosted OSRM (driving matrix) and OpenTripPlanner 2
(transit, NTA/TFI GTFS). Both run locally so no patient-derived coordinate ever
reaches a third party; a missing route is None, NEVER zero minutes.

Phase 0 has no routing infrastructure yet, so this returns None for every
hospital — the ranking and UI already treat None as 'unavailable'. This is a
deliberate stub, not a placeholder that lies: it never invents a number.
"""


def travel_minutes(origin_lat: float, origin_lng: float,
                   hospitals: list[dict]) -> dict[str, int | None]:
    """Map hospital -> minutes. Phase 0: all None (no route computed yet)."""
    return {h["hospital"]: None for h in hospitals}
