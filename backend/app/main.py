"""FastAPI entry point. Deploys to Railway (Root Directory = /backend).
Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

The authenticated browser talks directly to this backend over HTTPS — never
through Vercel functions or edge middleware. Vercel serves static assets only.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal
from app.routers import referrals

app = FastAPI(title="Referral Options Agent", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(referrals.router)


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
