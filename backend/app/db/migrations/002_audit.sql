-- Referral sign-off audit. One row per clinician sign-off (gate 4). This is OURS,
-- not the LangGraph checkpointer: it is the durable "who approved what, when" record
-- plus the reviewed snapshot of the two orderings. No patient letter is stored here —
-- only the confirmed specialty, how it was determined, the coarse origin, the chosen
-- hospital, and the HSE numbers the GP reviewed (each with its date + source).

CREATE TABLE IF NOT EXISTS referral_audit (
    id               BIGSERIAL PRIMARY KEY,
    thread_id        TEXT NOT NULL,
    signed_off_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    specialty_id     TEXT NOT NULL,
    specialty_name   TEXT NOT NULL,
    specialty_source TEXT NOT NULL,        -- 'model' | 'clinician'
    origin           TEXT,                 -- coarse town, or null
    travel_mode      TEXT,                 -- 'driving' | 'transit'
    chosen_hospital  TEXT NOT NULL,
    snapshot         JSONB NOT NULL        -- the two orderings as reviewed
);

CREATE INDEX IF NOT EXISTS idx_referral_audit_thread ON referral_audit(thread_id);