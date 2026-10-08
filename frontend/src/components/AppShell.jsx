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

      {/* mobile-only top bar: counter + progress (rail is hidden under 900px) */}
      <div className="topbar">
        <span className="topbar-mark" aria-hidden="true" />
        <span className="topbar-counter">Step {current + 1} of 4</span>
        <div className="topbar-track"><div className="topbar-fill" style={{ width: `${((current + 1) / 4) * 100}%` }} /></div>
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
  );
}