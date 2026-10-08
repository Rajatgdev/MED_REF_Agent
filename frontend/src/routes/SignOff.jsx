import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useFlow } from "../state/FlowContext";
import { downloadMarkdown, modeLabel } from "../lib/ui";
import GateShell from "../components/GateShell";

const BigCheck = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17l9-9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export default function SignOff() {
  const f = useFlow();
  const nav = useNavigate();

  useEffect(() => {
    if (!f.signedOff && (!f.confirmed || !f.rankData || !f.chosen)) nav("/compare", { replace: true });
  }, [f.confirmed, f.rankData, f.chosen, f.signedOff, nav]);

  async function onSignOff() {
    const res = await f.signOff();
    if (res && res.stage === "done") downloadMarkdown(res.advisory_markdown, `referral_advisory_${res.audit_id}.md`);
  }

  if (f.signedOff) {
    return (
      <GateShell eyebrow="Step 4 of 4" title="Signed off"
        footer={<button className="btn" onClick={() => { f.setDir(1); f.reset(); nav("/"); }}>Start another referral</button>}>
        <div className="done-card">
          <motion.span className="done-ic" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}><BigCheck /></motion.span>
          <div>
            <p className="done-t">Advisory downloaded</p>
            <p className="done-s">Audit reference #{f.signedOff.audit_id}. The GP sends the referral; this tool does not.</p>
          </div>
        </div>
      </GateShell>
    );
  }

  if (!f.confirmed || !f.chosen) return null;

  const rows = [
    ["Specialty", <>{f.confirmed.display_name} <span className="src">({f.confirmed.source === "model" ? "extracted" : "clinician"})</span></>, () => { f.setDir(-1); nav("/verify"); }],
    ["Patient origin", f.origin || "—", () => { f.setDir(-1); nav("/compare"); }],
    ["Travel mode", modeLabel(f.mode), () => { f.setDir(-1); nav("/compare"); }],
    ["Chosen hospital", <strong>{f.chosen}</strong>, () => { f.setDir(-1); nav("/compare"); }],
  ];

  return (
    <GateShell eyebrow="Step 4 of 4" title="Check & sign off"
      lede="Confirm the details below. Signing off records an audit entry and downloads the advisory — it does not book or send anything."
      footer={<>
        <button className="linkbtn" onClick={() => { f.setDir(-1); nav("/compare"); }}>Back</button>
        <button className="btn" onClick={onSignOff} disabled={f.busy}>{f.busy ? "Signing off…" : "Sign off & download advisory"}</button>
      </>}>
      <dl className="summary">
        {rows.map(([dt, dd, change]) => (
          <div key={dt}>
            <dt>{dt}</dt>
            <dd>{dd}<button className="change" onClick={change}>Change</button></dd>
          </div>
        ))}
      </dl>
      {f.error && <p className="error" role="alert">{f.error}</p>}
    </GateShell>
  );
}