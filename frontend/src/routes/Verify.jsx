import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import GateShell from "../components/GateShell";

export default function Verify() {
  const f = useFlow();
  const nav = useNavigate();
  const [manualPick, setManualPick] = useState("");

  useEffect(() => { if (!f.proposal) nav("/", { replace: true }); }, [f.proposal, nav]);
  if (!f.proposal) return null;

  // Already confirmed → thread is parked at sign-off; re-confirming would double-resume
  // the graph. Read-only; changing the specialty starts the review over.
  if (f.confirmed) {
    return (
      <GateShell eyebrow="Step 2 of 4" title="Confirm specialty"
        footer={<>
          <button className="linkbtn" onClick={() => { f.setDir(-1); nav("/"); }}>Change specialty (start over)</button>
          <button className="btn" onClick={() => { f.setDir(1); nav("/compare"); }}>Continue to options</button>
        </>}>
        <p className="confirmed">Confirmed: <strong>{f.confirmed.display_name}</strong> — {f.confirmed.source === "model" ? "extracted from the letter" : "chosen by the clinician"}.</p>
        <p className="muted-note">To change the specialty you start the review over, so the options and the audit stay consistent with it.</p>
      </GateShell>
    );
  }

  const p = f.proposal;
  async function confirm(choice) { f.setDir(1); if (await f.confirmSpecialty(choice)) nav("/compare"); }
  function confirmManual() {
    const s = f.specialties.find((x) => x.specialty_id === manualPick);
    if (s) confirm({ specialty_id: s.specialty_id, display_name: s.display_name, source: "clinician" });
  }

  return (
    <GateShell eyebrow="Step 2 of 4" title="Confirm the specialty"
      lede="The tool extracts only the specialty the letter states — it never infers one. Check it against the letter, then confirm or choose another. The GP decides."
      footer={<button className="linkbtn" onClick={() => { f.setDir(-1); nav("/"); }}>Back to referral</button>}>

      {p.source === "model" && (
        <div className="verify-card">
          <p className="verify-label">Extracted from the letter</p>
          <p className="verify-specialty">{p.display_name}</p>
          <blockquote>“{p.evidence_quote}”</blockquote>
          <button className="btn" onClick={() => confirm({ specialty_id: p.specialty_id, display_name: p.display_name, source: "model" })} disabled={f.busy}>
            Confirm {p.display_name}
          </button>
        </div>
      )}

      {p.source === "none" && (
        <div className="verify-card warn">
          <p>{p.detail || "No specialty could be confirmed from the letter — choose one below."}</p>
        </div>
      )}

      <div className="manual">
        <p className="verify-label">{p.source === "model" ? "Not right? Choose a different specialty" : "Choose the specialty"}</p>
        <div className="field-row">
          <select className="select" value={manualPick} onChange={(e) => setManualPick(e.target.value)}>
            <option value="">Select a specialty…</option>
            {f.specialties.map((s) => <option key={s.specialty_id} value={s.specialty_id}>{s.display_name}</option>)}
          </select>
          <button className="btn secondary" onClick={confirmManual} disabled={!manualPick || f.busy}>Use this specialty</button>
        </div>
      </div>

      {f.error && <p className="error" role="alert">{f.error}</p>}
    </GateShell>
  );
}