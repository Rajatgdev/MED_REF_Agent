"""Encrypted Postgres checkpointer for the LangGraph flow.

A long-lived psycopg async pool on the DIRECT Neon URL, wrapped in LangGraph's
AsyncPostgresSaver. Checkpoint blobs are encrypted at rest with AES
(EncryptedSerializer, key from LANGGRAPH_AES_KEY) — the same AES-at-rest standard
the project uses for sensitive fields. Built once at app startup, closed at shutdown.
"""
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.serde.encrypted import EncryptedSerializer

from app.core.config import settings


def _conn_string() -> str:
    """psycopg wants a plain libpq URL. Normalize the scheme and ensure SSL
    (Neon requires it)."""
    url = settings.database_url_direct
    for old in ("postgresql+asyncpg://", "postgres://"):
        if url.startswith(old):
            url = "postgresql://" + url[len(old):]
            break
    parts = urlsplit(url)
    q = dict(parse_qsl(parts.query))
    q.setdefault("sslmode", "require")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


async def open_checkpointer() -> tuple[AsyncConnectionPool, AsyncPostgresSaver]:
    pool = AsyncConnectionPool(
        conninfo=_conn_string(),
        min_size=0,                 # keep no idle conns — Neon suspends and kills them
        max_size=4,
        max_idle=60,                # recycle idle conns before Neon drops them
        open=False,
        check=AsyncConnectionPool.check_connection,   # ping (SELECT 1) before handing one out; replace dead ones
        kwargs={"autocommit": True, "row_factory": dict_row},
    )
    await pool.open()
    key = settings.langgraph_aes_key.encode()
    if len(key) not in (16, 24, 32):
        await pool.close()
        raise ValueError("LANGGRAPH_AES_KEY must be 16, 24, or 32 characters.")
    serde = EncryptedSerializer.from_pycryptodome_aes(key=key)
    saver = AsyncPostgresSaver(pool, serde=serde)
    await saver.setup()                                   # idempotent; creates tables once
    return pool, saver