-- Auth: users + opaque server-side sessions (same scheme as Jev_Scrapper).
-- Passwords are Argon2id-hashed (one-way, never reversible). The session cookie
-- holds a random token; only its SHA-256 digest is stored here, so a database
-- leak hands out no valid sessions. Idle + absolute expiry, revocable on logout.

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_digest        TEXT NOT NULL UNIQUE,         -- sha256 of the cookie token
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    idle_expires_at     TIMESTAMPTZ NOT NULL,         -- refreshed on use
    absolute_expires_at TIMESTAMPTZ NOT NULL,         -- hard ceiling
    revoked_at          TIMESTAMPTZ                    -- set on logout
);

CREATE INDEX IF NOT EXISTS idx_sessions_digest ON sessions(token_digest);
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);