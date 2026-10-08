import { Routes, Route } from "react-router-dom";
import { FlowProvider } from "./state/FlowContext";
import Intake from "./routes/Intake";
import Verify from "./routes/Verify";
import Compare from "./routes/Compare";
import SignOff from "./routes/SignOff";

// The GP walks four gates: Referral -> Confirm specialty -> Review options ->
// Check & sign off. Each gate is its own route; the flow state (letter, thread,
// proposal, choice) lives in FlowContext, never in the URL.
export default function App() {
  return (
    <FlowProvider>
      <div className="app-shell">
        <header className="app-header">
          <h1>Referral Options Agent</h1>
          <p className="tag">
            Advisory only — estimates, not guarantees. The GP decides; this tool
            never submits, books, or chooses a referral.
          </p>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Intake />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/signoff" element={<SignOff />} />
            <Route path="*" element={<Intake />} />
          </Routes>
        </main>
      </div>
    </FlowProvider>
  );
}