"""The orchestration graph. One node per stage, interrupts for the clinician gates.

  extract     — the single OpenAI call (own node, runs once, commits before any gate).
  confirm     — Gate: GP confirms/overrides the specialty (interrupt, no side effects).
  sign_off    — Gate: GP signs off after reviewing the options (interrupt, no side effects).
  finalize    — writes the audit row and builds the advisory (runs once, after sign-off).

Live ranking stays OUTSIDE the graph (it is reactive); the graph owns the durable,
gated decisions and the final reviewed snapshot.
"""
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.db import store
from app.graph.state import FlowState
from app.services import advisory, extraction


async def _extract(state: FlowState) -> dict:
    res = await extraction.extract_specialty(state["referral_text"])
    return {"proposal": res.model_dump()}


def _confirm(state: FlowState) -> dict:
    decision = interrupt({"stage": "confirm_specialty", "proposal": state.get("proposal")})
    return {"confirmed": decision}


def _sign_off(state: FlowState) -> dict:
    decision = interrupt({"stage": "sign_off", "confirmed": state.get("confirmed")})
    return {"signoff": decision}


async def _finalize(state: FlowState) -> dict:
    confirmed = state.get("confirmed") or {}
    signoff = state.get("signoff") or {}
    proposal = state.get("proposal") or {}
    quote = proposal.get("evidence_quote") if confirmed.get("source") == "model" else None
    audit_id = await store.record_signoff(
        thread_id=state.get("thread_id", ""),
        specialty_id=confirmed.get("specialty_id"),
        specialty_name=confirmed.get("display_name"),
        specialty_source=confirmed.get("source"),
        origin=signoff.get("origin"),
        travel_mode=signoff.get("mode"),
        chosen_hospital=signoff.get("chosen_hospital"),
        snapshot=signoff.get("snapshot") or {},
    )
    md = advisory.build_advisory(confirmed, signoff, quote, audit_id)
    return {"audit_id": audit_id, "advisory_markdown": md}


def build_graph() -> StateGraph:
    b = StateGraph(FlowState)
    b.add_node("extract", _extract)
    b.add_node("confirm", _confirm)
    b.add_node("sign_off", _sign_off)
    b.add_node("finalize", _finalize)
    b.add_edge(START, "extract")
    b.add_edge("extract", "confirm")
    b.add_edge("confirm", "sign_off")
    b.add_edge("sign_off", "finalize")
    b.add_edge("finalize", END)
    return b