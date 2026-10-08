import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import { downloadMarkdown } from "../lib/ui";
import Stepper from "../components/Stepper";

export default function SignOff() {
  const f = useFlow();
  const navigate = useNavigate();

  // Guard: must have a confirmed specialty, a snapshot, and a chosen hospital —
  // unless we're already showing the signed-off result.
  useEffect(() => {
    if (!f.signedOff && (!f.confirmed || !f.rankData || !f.chosen)) {
      navigate("/compare", { replace: true });
    }
  }, [f.confirmed, f.rankData, f.chosen, f.signedOff, navigate]);

  async function onSignOff() {
    const res = await f.signOff();
    if (res && res.stage === "done") {
      downloadMarkdown(res.advisory_markdown, `referral_advisory_${res.audit_id}.md`);
    }
  }

  if (f.signedOff) {
    return (
      <section className="gate">
        <Stepper current={4} />
        <h2>Signed off</h2>
        <p className="confirmed">
          Advisory downloaded — audit #{f.signedOff.audit_id}. The GP sends the
          referral; this tool does not.
        </p>
        <div className="gate-actions">
          <button onClick={() => { f.reset(); navigate("/"); }}>Start another referral</button>
        </div>
      </section>
    );
  }

  if (!f.confirmed || !f.chosen) return null;

  return (
    <section className="gate">
      <Stepper current={4} />
      <h2>Check &amp; sign off</h2>
      <p className="note">
        Confirm the details below. Signing off records an audit entry and downloads
        the advisory — it does not book or send anything.
      </p>

      <dl className="summary">
        <div>
          <dt>Specialty</dt>
          <dd>
            {f.confirmed.display_name}{" "}
            <span className="src">({f.confirmed.source === "model" ? "extracted" : "clinician"})</span>
            <button className="change" onClick={() => navigate("/verify")}>Change</button>
          </dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>{f.origin || "—"}<button className="change" onClick={() => navigate("/compare")}>Change</button></dd>
        </div>
        <div>
          <dt>Travel mode</dt>
          <dd>{f.mode}<button className="change" onClick={() => navigate("/compare")}>Change</button></dd>
        </div>
        <div>
          <dt>Chosen hospital</dt>
          <dd><strong>{f.chosen}</strong><button className="change" onClick={() => navigate("/compare")}>Change</button></dd>
        </div>
      </dl>

      {f.error && <p className="error" role="alert">{f.error}</p>}

      <div className="gate-actions split">
        <button className="link" onClick={() => navigate("/compare")}>← Back</button>
        <button onClick={onSignOff} disabled={f.busy}>
          {f.busy ? "Signing off…" : "Sign off & download advisory"}
        </button>
      </div>
    </section>
  );
}