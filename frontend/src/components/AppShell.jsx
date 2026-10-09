import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Sidebar, { GATE_INDEX } from "./Sidebar";
import Intake from "../routes/Intake";
import Verify from "../routes/Verify";
import Compare from "../routes/Compare";
import SignOff from "../routes/SignOff";

export default function AppShell() {
  const location = useLocation();
  const current = GATE_INDEX[location.pathname] ?? 0;

  return (
    <div className="shell">
      <Sidebar />
      <div className="workspace">
        <div className="mobile-flow" aria-label={`Referral review, step ${current + 1} of 4`}>
          <div className="mobile-flow-head">
            <span className="mobile-branding">
              <svg className="mobile-brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <path d="M5.75 4.75h13l6 6v20.5H5.75z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.75 4.75v6h6M9.75 15.25h9M9.75 19.25h6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16.25 24.25h4.5c3.2 0 3.2-5 6.4-5h.9M20.75 24.25c3.2 0 3.2 5 6.4 5h.9" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="29.5" cy="19.25" r="1.65" fill="var(--accent)" />
                <circle cx="29.5" cy="29.25" r="1.65" fill="var(--accent)" />
              </svg>
              <span className="mobile-brand">Referral Options</span>
            </span>
            <span className="mobile-step">Step {current + 1} of 4</span>
          </div>
          <div className="mobile-track" aria-hidden="true">
            <span className="mobile-fill" style={{ width: `${((current + 1) / 4) * 100}%` }} />
          </div>
        </div>
        <main className="shell-main" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Intake />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/signoff" element={<SignOff />} />
              <Route path="*" element={<Intake />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
