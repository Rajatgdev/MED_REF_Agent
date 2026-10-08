import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import Stepper from "../components/Stepper";

export default function Verify() {
  const f = useFlow();
  const navigate = useNavigate();
  const [manualPick, setManualPick] = useState("");

  // Guard: no proposal means the flow hasn't started.
  useEffect(() => {
    if (!f.proposal) navigate("/", { replace: true });
  }, [f.proposal, navigate]);
  if (!f.proposal) return null;

  // Already confirmed: the thread is parked at sign-off, so re-confirming would
  // double-resume the graph. Show it read-only; changing specialty starts over.
  if (f.confirmed) {
    return (
      <section className="gate">
        <Stepper current={2} />
        <h2>Confirm specialty</h2>
        <p className="confirmed">
          Confirmed: <strong>{f.confirmed.display_name}</strong>{" "}
          ({f.confirmed.source === "model" ? "extracted from the letter" : "chosen by the clinician"}).
        </p>
        <p className="note">
          To change the specialty you start the review over, so the options and the
          audit stay consistent with the specialty.
        </p>
        <div className="gate-actions split">
          <button className="link" onClick={() => navigate("/")}>← Change specialty (start over)</button>
          <button onClick={() => navigate("/compare")}>Continue to options →</button>
        </div>
      </section>
    );
  }

  const p = f.proposal;

  async function confirm(choice) {
    const ok = await f.confirmSpecialty(choice);
    if (ok) navigate("/compare");
  }

  function confirmManual() {
    const s = f.specialties.find((x) => x.specialty_id === manualPick);
    if (s) confirm({ specialty_id: s.specialty_id, display_name: s.display_name, source: "clinician" });
  }

  return (
    <section className="gate">
      <Stepper current={2} />
      <h2>Confirm specialty</h2>
      <p className="note">
        The tool extracts only the specialty the letter states — it does not infer
        one. Check it against the letter, then confirm or choose a different one.
        The GP decides.
      </p>

      {p.source === "model" && (
        <div className="verify-card">
          <p className="verify-label">Extracted from the letter</p>
          <p className="verify-specialty">{p.display_name}</p>
          <blockquote>"{p.evidence_quote}"</blockquote>
          <div className="gate-actions">
            <button
              onClick={() => confirm({ specialty_id: p.specialty_id, display_name: p.display_name, source: "model" })}
              disabled={f.busy}
            >
              Confirm {p.display_name} →
            </button>
          </div>
        </div>
      )}

      {p.source === "none" && (
        <div className="verify-card warn">
          <p>{p.detail || "No specialty could be confirmed from the letter — choose one below."}</p>
        </div>
      )}

      <div className="manual">
        <p className="verify-label">
          {p.source === "model" ? "Not right? Choose a different specialty" : "Choose the specialty"}
        </p>
        <div className="field-row">
          <select value={manualPick} onChange={(e) => setManualPick(e.target.value)}>
            <option value="">Select a specialty…</option>
            {f.specialties.map((s) => (
              <option key={s.specialty_id} value={s.specialty_id}>{s.display_name}</option>
            ))}
          </select>
          <button className="secondary" onClick={confirmManual} disabled={!manualPick || f.busy}>
            Use this specialty →
          </button>
        </div>
      </div>

      {f.error && <p className="error" role="alert">{f.error}</p>}

      <div className="gate-actions back">
        <button className="link" onClick={() => navigate("/")}>← Back to referral</button>
      </div>
    </section>
  );
}