# Referral Options Agent — backend

FastAPI. Deploys to Railway (Root Directory = `/backend`, EU West / Amsterdam).
Phase 0 scope: the three data files, the seeded Postgres tables, and the exact
keyed wait lookup + the two deterministic orderings. No upload, no extraction, no
booking yet — those are later phases.

## Run the skeleton first (no server, no DB, no keys)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.skeleton                 # ranks orthopaedics straight from the CSVs
python -m app.skeleton --check-crypto  # round-trips the Fernet standard (set ENCRYPTION_KEY)
```

The skeleton proves the Phase 0 idea end to end before Postgres is wired.

## Bring up the database (Neon, EU)

```bash
cp .env.example .env            # fill DATABASE_URL + DATABASE_URL_DIRECT (+ ENCRYPTION_KEY)
python -m app.db.migrate        # create tables on the DIRECT url
python -m app.db.seed           # load data/*.csv into the tables
```

## Run the API

```bash
uvicorn app.main:app --reload
# GET /health                         -> {status, database}
# GET /api/specialties                -> the allowlist
# GET /api/rank?specialty=orthopaedics -> two ranked lists (wait real, travel unavailable)
```

**Phase 0 done when:** `/api/rank?specialty=orthopaedics` returns the 5 hospitals
wait-led, each wait carrying its date + source, Louth shown `missing` (not 0) and
never ranked fastest.

## Structure

```
app/
├── main.py             FastAPI app + CORS + /health
├── skeleton.py         run-me-first proof (no infra)
├── core/
│   ├── config.py       settings, ranking policy (policy lives here, not the model)
│   └── crypto.py       Fernet/MultiFernet at-rest standard (same as Jev_Scrapper)
├── db/
│   ├── session.py      async engine on the POOLED Neon url
│   ├── migrate.py      apply .sql on the DIRECT url
│   ├── seed.py         load the three CSVs into the tables
│   ├── store.py        exact keyed lookups (no model, no fuzzy match)
│   └── migrations/001_initial.sql   hospitals, specialties, waits
├── services/
│   ├── travel.py       OSRM/OTP2 travel — stubbed (None) until Phase 1
│   └── ranking.py      the two orderings; missing sorts LAST, never fastest
├── routers/referrals.py  /api/specialties, /api/rank
└── models/schemas.py   HospitalWait, RankedLists (wait + travel shown separately)
```

## Data

`data/waits.csv`, `data/hospitals.csv`, `data/specialties.csv` are the editable
source of truth. Only `seed.py` writes the tables. Orthopaedics waits are real,
transcribed from the HSE page on 2026-10-06. In production the `waits` table is
refilled monthly from an authorised HSE export — same columns, different filler.
