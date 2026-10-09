import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useFlow } from "../state/FlowContext";
import { modeLabel } from "../lib/ui";

const STEPS = [
  { path: "/", label: "Referral", sub: "Letter & origin" },
  { path: "/verify", label: "Confirm specialty", sub: "Check the extraction" },
  { path: "/compare", label: "Review options", sub: "Wait & travel" },
  { path: "/signoff", label: "Check & sign off", sub: "Audit & advisory" },
];
export const GATE_INDEX = { "/": 0, "/verify": 1, "/compare": 2, "/signoff": 3 };

const ReferralMark = () => (
  <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M5.75 4.75h13l6 6v20.5H5.75z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.75 4.75v6h6M9.75 15.25h9M9.75 19.25h6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.25 24.25h4.5c3.2 0 3.2-5 6.4-5h.9M20.75 24.25c3.2 0 3.2 5 6.4 5h.9" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="29.5" cy="19.25" r="1.65" fill="var(--accent)" />
    <circle cx="29.5" cy="29.25" r="1.65" fill="var(--accent)" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17l9-9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

export default function Sidebar() {
  const location = useLocation();
  const f = useFlow();
  const current = GATE_INDEX[location.pathname] ?? 0;

  // show the GP's own choices back to them on completed steps
  const dynSub = (i, fallback) => {
    if (i === 0 && (f.origin || current > 0)) return `${f.origin || "No origin"} · ${modeLabel(f.mode)}`;
    if (i === 1 && f.confirmed) return f.confirmed.display_name;
    return fallback;
  };

  return (
    <aside className="rail">
      <div className="brand">
        <ReferralMark />
        <span className="wm"><b>Referral Options</b><span>Clinician advisory</span></span>
      </div>

      <nav className="steps" aria-label="Referral review steps">
        <p className="rail-eyebrow">Referral review</p>
        {STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <div key={s.path} className={`step ${state}`} aria-current={state === "active" ? "step" : undefined}>
              {state === "active" && (
                <motion.span className="step-bg" layoutId="rail-active"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }} />
              )}
              <span className="n">{state === "done" ? <Check /> : i + 1}</span>
              <span className="step-tx">
                <span className="lbl">{s.label}</span>
                <span className="sub">{dynSub(i, s.sub)}</span>
              </span>
            </div>
          );
        })}
      </nav>

      <div className="rail-foot">
        <p className="assure"><b>Advisory only.</b> The GP decides. This tool never submits, books, or chooses a referral.</p>
        <p className="rail-note">Waiting times are estimates. Check each source and observation date.</p>
      </div>
    </aside>
  );
}
