"""The state that flows through the LangGraph. Small, JSON-serializable (it is
AES-encrypted and written to the Postgres checkpointer at each step)."""
from typing import Any, TypedDict


class FlowState(TypedDict, total=False):
    referral_text: str
    thread_id: str
    proposal: dict[str, Any] | None       # model extraction result (shown at the confirm gate)
    confirmed: dict[str, Any] | None       # GP's specialty decision {specialty_id, display_name, source}
    signoff: dict[str, Any] | None         # GP's sign-off {chosen_hospital, origin, mode, snapshot}
    audit_id: int | None                   # id of the written audit row
    advisory_markdown: str | None          # the downloadable advisory