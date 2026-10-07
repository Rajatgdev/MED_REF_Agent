"""Central config. Reads .env. Thresholds and the approved-specialty rules are
policy — they live here, never inside the model.

Phase 0 needs only the database and the data directory. The OpenAI settings are
declared now but unused until Phase 2 (specialty extraction); keeping them here
means the one extraction call has nowhere to invent its own config later.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- data (the three CSVs are the editable source of truth) ---
    data_dir: str = str(Path(__file__).resolve().parents[2] / "data")

    # --- db — Neon Postgres. POOLED url (app) + DIRECT url (migrations). ---
    database_url: str = ""          # postgresql+asyncpg://…-pooler…/db  (app queries)
    database_url_direct: str = ""   # postgresql://…/db                 (migrations/seed only)

    # --- extraction (Phase 2). One OpenAI call, synthetic data only. ---
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"            # must support Structured Outputs (gpt-4o-mini class)
    # Standard endpoint by default. eu.api.openai.com works ONLY for orgs enrolled in
    # OpenAI EU data residency (eligibility review); a normal key fails against it.
    openai_base_url: str = "https://api.openai.com/v1"
    max_upload_mb: int = 5

    # --- OCR fallback for image-only PDFs / image uploads (Mistral Document AI, EU). ---
    # Only used when a PDF has no text layer. Empty key -> image PDFs rejected
    # (text-layer PDFs/DOCX/paste work without it). Synthetic data only.
    mistral_api_key: str = ""
    mistral_ocr_url: str = "https://api.mistral.ai/v1/ocr"
    mistral_ocr_model: str = "mistral-ocr-latest"

    # --- orchestration (Phase 3). AES key for the encrypted LangGraph checkpointer. ---
    # 16/24/32 chars (32 = AES-256). Read from .env here and passed explicitly to the
    # serializer — LangGraph reads os.environ, which pydantic-settings does NOT populate.
    langgraph_aes_key: str = ""

    # --- ranking policy (deterministic, never the model) ---
    # Which wait column orders the wait-led list. 'first_appt_days' = the
    # outpatient first appointment a GP referral leads to.
    wait_pathway: str = "first_appt_days"

    # --- routing (OPTION B, TEMPORARY): hosted OpenRouteService (HeiGIT, Germany/EU).
    # Geocoding + driving matrix over one API key, no local Docker. Transit is
    # unavailable on ORS. This discloses the coarse origin to a third party (EU-
    # resident, but still a processor) — MUST revert to self-hosted OSRM/Nominatim/
    # OTP2 before real patient data (see docs/architecture.md). Empty key ->
    # travel/geocode unavailable, never guessed.
    ors_api_key: str = ""
    ors_base_url: str = "https://api.openrouteservice.org"
    default_mode: str = "driving"            # 'driving' | 'transit' (transit unavailable on ORS)
    routing_timeout_seconds: float = 20.0

    # --- cors: the Vercel frontend origin(s), comma-separated ---
    allowed_origins: str = "http://localhost:5173"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
