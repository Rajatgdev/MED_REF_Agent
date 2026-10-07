"""Build the downloadable advisory summary (markdown). Advisory only — the tool
never books. Shows the specialty's provenance (model-extracted with its verbatim
quote, or clinician-entered) and every wait with its date + source."""
from datetime import datetime, timezone


def _wait(h: dict) -> str:
    d = h.get("first_appt_days")
    return "wait: missing" if d is None else f"wait: {d} days (HSE, {h.get('observation_date')})"


def _travel(h: dict) -> str:
    m = h.get("travel_minutes")
    return "travel: unavailable" if m is None else f"travel: {m} min"


def _rows(items: list[dict], chosen: str | None) -> str:
    out = []
    for i, h in enumerate(items, 1):
        mark = "  ← chosen" if h.get("hospital") == chosen else ""
        out.append(f"{i}. {h.get('hospital')} — {_wait(h)}; {_travel(h)}{mark}")
    return "\n".join(out) if out else "(none)"


def build_advisory(confirmed: dict, signoff: dict, quote: str | None, audit_id: int) -> str:
    snap = signoff.get("snapshot") or {}
    chosen = signoff.get("chosen_hospital")
    name = confirmed.get("display_name") or confirmed.get("specialty_id") or "(not set)"
    how = "extracted from the referral letter" if confirmed.get("source") == "model" else "entered by the clinician"
    prov = f"- Specialty: **{name}** ({how})"
    if quote:
        prov += f'\n  - Evidence (verbatim from the letter): "{quote}"'
    origin = signoff.get("origin") or "(not given)"
    mode = signoff.get("mode") or snap.get("travel_mode") or "driving"
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pathway = (snap.get("pathway") or "first_appt_days").replace("_", " ")
    return f"""# Referral advisory summary

> **Advisory only — not a booking.** The GP decides. This tool does not submit,
> book, cancel, or alter a referral. Estimated waits are monthly HSE midpoints shown
> with their date; missing data is shown as missing, never as zero.

**Audit reference:** {audit_id}  ·  **Signed off:** {ts}

## Decision
{prov}
- Coarse origin: {origin}  ·  Travel mode: {mode}
- **Chosen hospital: {chosen}**

## Wait-led (by {pathway})
{_rows(snap.get("wait_led", []), chosen)}

## Travel-led (by {mode} journey time)
{_rows(snap.get("travel_led", []), chosen)}
"""