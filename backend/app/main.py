"""FastAPI entry point. Deploys to Railway (Root Directory = /backend).
Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

The authenticated browser talks directly to this backend over HTTPS — never
through Vercel functions or edge middleware. Vercel serves static assets only.
"""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.auth.router import current_user
from app.auth.router import router as auth_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.graph.checkpointer import open_checkpointer
from app.graph.flow import build_graph
from app.routers import extract, flow, referrals


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build the LangGraph flow + its encrypted Postgres checkpointer at startup.
    If it can't be built (no AES key / DB), the app still serves everything else;
    the /api/flow/* endpoints return 503 until it's configured."""
    pool = None
    app.state.flow = None
    try:
        pool, saver = await open_checkpointer()
        app.state.flow = build_graph().compile(checkpointer=saver)
        print("[flow] ready", flush=True)
    except Exception as e:  # noqa: BLE001 — never block app startup on the flow engine
        print(f"[flow] disabled: {e!r}", flush=True)
    try:
        yield
    finally:
        if pool is not None:
            await pool.close()


app = FastAPI(title="Referral Options Agent", version="0.3", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth is open — you must reach signup/login/me without a session.
app.include_router(auth_router)

# Everything else needs a valid session cookie.
_auth = [Depends(current_user)]
app.include_router(referrals.router, dependencies=_auth)
app.include_router(extract.router, dependencies=_auth)
app.include_router(flow.router, dependencies=_auth)

@app.get("/health")
async def health():
    """Reports app health and whether the database is reachable."""
    db_ok = False
    try:
        async with SessionLocal() as s:
            await s.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "database": "connected" if db_ok else "unreachable"}
