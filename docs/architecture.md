# Architecture & build reference

Condensed from `Referral_Options_Agent_Tech_Stack.docx` (as of 6 Oct 2026), plus
research done 7 Oct 2026 to validate the stack before building. This file is the
one place that records *why* each choice holds and what still needs closing.

## What it is

A GP uploads a typed referral (text, or text-layer PDF/DOCX — no OCR). Seven
persisted stages, four clinician gates. The LLM appears at exactly one step
(naming the stated specialty); everything consequential — eligibility, wait
lookup, travel, ranking — is deterministic Python.

**Data-flow rule.** The full referral never leaves the backend. Only two small
things travel onward: the confirmed specialty (one word, to the DB) and a coarse
origin (a town point, to the local router). No patient identifier goes into URLs,
logs, telemetry, or build artifacts. For the demo every referral is synthetic.

## Stack

| Layer | Choice |
| --- | --- |
| Orchestration | LangGraph + FastAPI + Postgres checkpointer (one node per stage, interrupt per gate) |
| Extraction | OpenAI Structured Outputs (JSON Schema) + Pydantic enum-or-null + exact-span validator |
| PDF / DOCX | pdfplumber + python-docx (MIT, local, no egress) |
| LLM home | Demo: OpenAI EU endpoint → Interim: AWS Bedrock EU → Prod: self-host (optional) |
| Geocoding / routing | **TARGET:** self-hosted Nominatim + OSRM (driving) + OTP2 (transit, NTA GTFS). **NOW (Option B, temporary):** hosted OpenRouteService — driving + geocoding only, no transit (see Routing note) |
| RAG / vector DB | None — numbers come from exact Postgres keys |
| Deploy | React→Vercel (static) · FastAPI→Railway (Amsterdam) · Neon (Frankfurt) |
| At-rest crypto | Fernet / MultiFernet (`ENCRYPTION_KEY`), same standard as Jev_Scrapper |

## Research findings (7 Oct 2026) — what to act on

Confirmed solid: `Qwen3-4B-Instruct-2507` (Apache-2.0) and
`Ministral-3-8B-Instruct-2512` (Apache-2.0, released 2 Dec 2025) both exist as
named; LangGraph `interrupt()` + `PostgresSaver` are the current, documented
human-in-the-loop path (and ship an `EncryptedSerializer`); OpenAI Structured
Outputs supports strict enum-or-null with a `refusal` field; the EU endpoint
`eu.api.openai.com` is real; NTA/TFI GTFS is CC BY 4.0 (daily, attribution
required, realtime needs an API key); HSE estimated waits update monthly via a
12-month midpoint.

Flags to close before leaning on them:

1. **OpenAI ZDR ≠ Structured Outputs.** OpenAI states JSON-Schema Structured
   Outputs are **not** Zero-Data-Retention eligible. Fine at Rung 1 (synthetic
   data only). The doc's "EU endpoint + ZDR" promise does not fully hold once you
   combine ZDR with schema mode — confirm in writing before any real data.
2. **Bedrock Sonnet 4.5 EU is multi-state, not single-country.** The `eu.`
   cross-region profile routes across DE/SE/IT/ES/IE/FR — all EU (residency OK),
   but not "Ireland eu-west-1 only." For single-region, confirm the bare model ID
   is callable on-demand there; else accept EU-wide. No-retention is contractable;
   logs stay in the source region.
3. **A licensed open API may remove some transcription.** `data.gov.ie` HSPAN16
   (NTPF outpatient) is CC BY 4.0 via the CSO PxStat REST API (JSON-stat). That is
   list *counts*, not the consumer "estimated days" — so hand-transcription stays
   right for the days numbers, but the optional NTPF context line can come from an
   API, not scraping.
4. **MDR / AI Act is the real legal edge.** MDR Rule 11 puts software "providing
   information for clinical decisions" in Class IIa+; only "no influence on a
   clinical decision" stays Class I. The extract-only / GP-decides framing is the
   correct defence — "ranking hospitals for review" must stay administrative.
   Post-cutoff (verify): high-risk MDAI obligations deferred to 2 Aug 2028 (Digital
   Omnibus Reg 2026/1744); AI Act Art 50 transparency live now; Art 4 AI-literacy
   live since Feb 2025. None blocks a synthetic demo; all matter before real use.

## Safety guardrails (built in, not bolted on)

Extract never infer · synthetic data only · the letter never leaves local · no
autonomous action · estimates are never guarantees (every wait shows its date +
source; missing shows as missing, never 0) · show the working (wait and travel
shown separately, no hidden combined score; GP can override) · routine only
(urgent / emergency / suspected-cancer excluded from the demo).

Before any real patient use (out of sprint scope, stated honestly): a DPIA and
Article 6/9 lawful-basis review, an MDR qualification opinion, a clinical safety
owner, and HSE AI-framework governance. Region selection alone is not compliance.

## Encryption standard

Fernet (AES-128-CBC + HMAC-SHA256) via `MultiFernet`, master key in the
`ENCRYPTION_KEY` env var on backend/worker services only — never the database,
Git, or frontend. MultiFernet makes rotation a config change (new key first, old
keys after, re-encrypt, drop old). Phase 0 persists no patient data, so nothing
patient-identifying is encrypted yet; the module (`backend/app/core/crypto.py`) is
wired and ready for (1) the LangGraph Postgres checkpointer via `EncryptedSerializer`
and (2) any future audit / clinician-entered field.

## Phase roadmap

| Phase | Work | Done when |
| --- | --- | --- |
| **0 · Data + skeleton** *(done)* | Monorepo; FastAPI + Neon (EU); three CSVs → seeded tables; keyed lookup; two orderings | App boots; `/api/rank?specialty=orthopaedics` returns 5 hospitals wait-led, each wait with date+source, missing shown as missing (never fastest) |
| **1 · Deterministic core** *(done; on hosted ORS for now)* | Mode-aware travel-led ordering; driving + geocoding via hosted OpenRouteService (Option B — local self-hosting hit hardware limits); transit deferred to the self-hosted switch-back | Given a fixed origin, 5 hospitals rank by driving time, 'unavailable' where no route (never 0) |
| 2 · Extraction | OpenAI Structured Outputs + Pydantic enum-or-null + exact-span validator; pdfplumber / python-docx | On 10 synthetic letters it extracts right and abstains (not guesses) on the ambiguous one |
| 3 · UI + safety surface | LangGraph gates; intake → confirm → result cards → override → export; clinician auth (Argon2id) | Full flow runs; every number shows source + date; letter never leaves the backend |
| 4 · Harden + rehearse | Edge cases, synthetic test set, DPIA/boundary notes, demo rehearsal | All edge cases fail safe; demo runs clean twice |

## Deferred (not in this scaffold, by design)

Auth, file upload, the OpenAI extraction service, and the LangGraph graph — each
belongs to a later phase above. The crypto module and the EU/OpenAI config are
declared now so later phases cannot drift to weaker defaults.

## Routing: Option B (temporary) → revert to self-hosted (TODO)

Routing currently runs on **hosted OpenRouteService** (EU, Germany) for driving +
geocoding. This was a deliberate stopgap: self-hosting OSRM/Nominatim/OTP2 locally
exceeded the dev machine's hardware (Nominatim's full OSM import + OTP2's JVM).

Consequences while on Option B: the coarse origin is disclosed to a third-party
processor (EU-resident, but still a processor), and public-transport routing is
unavailable (ORS has none).

**TODO before real patient data:** revert to self-hosted OSRM (driving) +
Nominatim (geocode) + OTP2 (transit, NTA GTFS), so no patient-derived coordinate
leaves the organisation. The design + exact build steps are preserved in this
file's stack table and git history (the removed `infra/` Docker stack). Swap
`geocode.py` and `travel.py` back to the self-hosted endpoints behind the same
interface — the ranking, API and UI do not change.
