"""Phase 3 flow API: drive the gated LangGraph.

/start  — intake the referral, run to the first gate, return {thread_id, stage, proposal}.
/resume — pass the GP's decision for a thread; returns the NEXT gate, or the final
          result ({stage:"done", audit_id, advisory_markdown}) when the flow ends.

Both gates (confirm specialty, sign off) go through /resume. State lives in the
encrypted Postgres checkpointer, keyed by thread_id, so a parked gate survives a
restart. The letter is not returned or persisted beyond the graph state.
"""
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from langgraph.types import Command

from app.services import intake

router = APIRouter(prefix="/api/flow", tags=["flow"])


def _graph(request: Request):
    g = getattr(request.app.state, "flow", None)
    if g is None:
        raise HTTPException(503, "Flow engine not configured (needs LANGGRAPH_AES_KEY + DATABASE_URL_DIRECT).")
    return g


def _shape(result: dict) -> dict:
    """Turn a graph result into {stage, ...}: the next interrupt's payload, or the
    final output when the flow has ended."""
    interrupts = result.get("__interrupt__")
    if interrupts:
        return dict(interrupts[0].value)                 # carries "stage"
    return {"stage": "done", "audit_id": result.get("audit_id"),
            "advisory_markdown": result.get("advisory_markdown")}


@router.post("/start")
async def start(
    request: Request,
    file: UploadFile | str | None = File(default=None),
    text: str | None = Form(default=None),
):
    if isinstance(file, str):            # Swagger "send empty value" sends "" — treat as no file
        file = None
    try:
        raw = await intake.read_referral(file, text)
    except intake.IntakeError as e:
        raise HTTPException(e.status, e.detail)

    graph = _graph(request)
    thread_id = uuid.uuid4().hex
    config = {"configurable": {"thread_id": thread_id}}
    result = await graph.ainvoke({"referral_text": raw, "thread_id": thread_id}, config)
    out = _shape(result)
    out["thread_id"] = thread_id
    return out


class ResumeIn(BaseModel):
    thread_id: str
    decision: dict[str, Any]


@router.post("/resume")
async def resume(request: Request, body: ResumeIn):
    graph = _graph(request)
    config = {"configurable": {"thread_id": body.thread_id}}
    result = await graph.ainvoke(Command(resume=body.decision), config)
    return _shape(result)