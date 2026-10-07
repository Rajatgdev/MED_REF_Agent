"""The state that flows through the LangGraph. Kept deliberately small — one key
per thing the gates produce. Everything in here is JSON-serializable (it gets
encrypted and written to the Postgres checkpointer at each step)."""
from typing import Any, TypedDict


class FlowState(TypedDict, total=False):
    referral_text: str
    proposal: dict[str, Any] | None     # model extraction result, shown at the confirm gate
    confirmed: dict[str, Any] | None    # GP's decision {specialty_id, display_name, source}