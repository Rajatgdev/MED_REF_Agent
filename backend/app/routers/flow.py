"""Phase 3 flow API: drive the gated LangGraph. 3a exposes the first gate.

/start  — intake the referral, run to the confirm gate, return {thread_id, proposal}.
/resume — the GP's decision for a thread; runs to the next stop and returns it.

State lives in the encrypted Postgres checkpointer, keyed by thread_id, so a parked
gate survives a restart. The letter is not returned or persisted beyond the graph state.
"""
import uuid

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


@router.post("/start")
async def start(
    request: Request,
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
):
    try:
        raw = await intake.read_referral(file, text)
    except intake.IntakeError as e:
        raise HTTPException(e.status, e.detail)

    graph = _graph(request)
    thread_id = uuid.uuid4().hex
    config = {"configurable": {"thread_id": thread_id}}
    result = await graph.ainvoke({"referral_text": raw}, config)
    interrupts = result.get("__interrupt__")
    if not interrupts:
        raise HTTPException(500, "Flow did not reach the confirm gate.")
    return {"thread_id": thread_id, "proposal": interrupts[0].value.get("proposal")}


class Decision(BaseModel):
    specialty_id: str | None = None
    display_name: str | None = None
    source: str                      # 'model' | 'clinician'


class ResumeIn(BaseModel):
    thread_id: str
    decision: Decision


@router.post("/resume")
async def resume(request: Request, body: ResumeIn):
    graph = _graph(request)
    config = {"configurable": {"thread_id": body.thread_id}}
    result = await graph.ainvoke(Command(resume=body.decision.model_dump()), config)
    return result.get("confirmed")