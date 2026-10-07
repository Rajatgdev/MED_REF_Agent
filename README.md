# Referral Options Agent

A clinician-facing advisory tool for the TechIreland National AI Challenge 2026
(Challenge 14, care navigation). A GP uploads a typed referral; the system
extracts the **explicitly stated** specialty, looks up HSE estimated waiting
times per hospital, computes travel time from a coarse patient origin, and
returns **two ranked orderings** — one wait-led, one travel-led — for the
clinician to review. The GP decides; the tool never submits, books, or chooses.

Governing rule: **extract, never infer.** The tool pulls the stated specialty
out of the text and abstains if none is stated. It never reads symptoms to
decide a specialty or judge urgency — that is what keeps it administrative
rather than a regulated medical device. See `docs/architecture.md`.

## Layout (isolated monorepo)

```
referral-options-agent/
├── backend/     FastAPI — pipeline + data. Deploys to Railway (EU, Amsterdam).
├── frontend/    Vite + React dashboard. Deploys to Vercel (static only).
└── docs/        Architecture, research flags, safety guardrails, roadmap.
```

Frontend and backend deploy **independently**: Railway root dir = `/backend`,
Vercel root dir = `/frontend`. The authenticated browser talks directly to the
backend over HTTPS — never through Vercel functions. Patient data never touches
Vercel.

## What is built (Phase 0)

The data model and the deterministic core: three seeded tables, the exact keyed
wait lookup, and the two ranked orderings. No upload, extraction, or booking yet.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.skeleton          # ranks orthopaedics from the CSVs — no DB, no keys
```

See `backend/README.md` to bring up Neon and run the API, and `docs/architecture.md`
for the full design and the phase roadmap.

## Encryption

At-rest sensitive values use **Fernet (authenticated AES) via MultiFernet**, the
same standard as `Jev_Scrapper`: master key in `ENCRYPTION_KEY` (backend/worker
only, never the DB or frontend), rotation-ready, fail-loud if absent. Phase 0
stores no patient data; the standard is wired for the LangGraph checkpointer and
future audit fields. See `backend/app/core/crypto.py`.
