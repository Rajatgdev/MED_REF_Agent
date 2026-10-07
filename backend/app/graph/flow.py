"""The thin orchestration graph. One node per stage, interrupts for gates.

3a has two nodes:
  extract  — runs the single OpenAI call (its OWN node, so it executes exactly
             once and commits before the gate; LangGraph re-runs a node from its
             start on resume, so side effects must not live in the gate node).
  confirm  — Gate 1: interrupt() pauses for the GP; the resume value is their
             decision. No side effects here, so re-running on resume is harmless.
"""
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.graph.state import FlowState
from app.services import extraction


async def _extract(state: FlowState) -> dict:
    res = await extraction.extract_specialty(state["referral_text"])
    return {"proposal": res.model_dump()}


def _confirm(state: FlowState) -> dict:
    decision = interrupt({"proposal": state.get("proposal")})
    return {"confirmed": decision}


def build_graph() -> StateGraph:
    b = StateGraph(FlowState)
    b.add_node("extract", _extract)
    b.add_node("confirm", _confirm)
    b.add_edge(START, "extract")
    b.add_edge("extract", "confirm")
    b.add_edge("confirm", END)
    return b