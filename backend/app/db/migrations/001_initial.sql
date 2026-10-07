-- Referral Options Agent — data model, step 0.
-- Three tables mirror the three editable CSVs (data/*.csv). The app only ever
-- queries Postgres; the CSVs are the source of truth you can open and inspect.
-- Keyed for EXACT lookup: a wait is (hospital, specialty). No AI touches these.

CREATE TABLE IF NOT EXISTS hospitals (
    hospital TEXT PRIMARY KEY,
    lat      DOUBLE PRECISION NOT NULL,
    lng      DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS specialties (
    specialty_id TEXT PRIMARY KEY,          -- the allowlist id the extractor must choose from
    display_name TEXT NOT NULL,
    aliases      TEXT NOT NULL DEFAULT ''    -- accepted spellings, ';'-separated
);

CREATE TABLE IF NOT EXISTS waits (
    hospital         TEXT NOT NULL REFERENCES hospitals(hospital) ON DELETE CASCADE,
    specialty        TEXT NOT NULL REFERENCES specialties(specialty_id) ON DELETE CASCADE,
    first_appt_days  INT,                    -- NULL = missing. NEVER 0. Missing must not rank fastest.
    inpatient_days   INT,
    daycase_days     INT,
    observation_date DATE NOT NULL,          -- every row carries its date …
    source_url       TEXT NOT NULL,          -- … and its source. Shown as "19 days (HSE, 6 Oct)".
    PRIMARY KEY (hospital, specialty)
);

CREATE INDEX IF NOT EXISTS idx_waits_specialty ON waits(specialty);
