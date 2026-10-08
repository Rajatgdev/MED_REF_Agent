import { createContext, useContext, useEffect, useState } from "react";
import { getSpecialties, flowStart, flowResume } from "../lib/api";

// Durable flow choices + the three backend calls that move the LangGraph between
// gates. `dir` (1 forward / -1 back) drives the gate slide direction.
const Ctx = createContext(null);
export const useFlow = () => useContext(Ctx);

export function FlowProvider({ children }) {
  const [specialties, setSpecialties] = useState([]);

  const [refText, setRefText] = useState("");
  const [refFile, setRefFile] = useState(null);
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState("driving");

  const [threadId, setThreadId] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [rankData, setRankData] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [signedOff, setSignedOff] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dir, setDir] = useState(1);

  useEffect(() => {
    getSpecialties().then(setSpecialties).catch((e) => setError(e.message));
  }, []);

  async function startFlow() {
    setBusy(true); setError("");
    setConfirmed(null); setRankData(null); setChosen(null); setSignedOff(null);
    try {
      const res = await flowStart({ file: refFile, text: refText });
      setThreadId(res.thread_id);
      setProposal(res.proposal);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  async function confirmSpecialty(choice) {
    setBusy(true); setError("");
    try { await flowResume(threadId, choice); setConfirmed(choice); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  async function signOff() {
    setBusy(true); setError("");
    try {
      const res = await flowResume(threadId, {
        chosen_hospital: chosen, origin, mode, snapshot: rankData,
      });
      if (res.stage === "done") {
        setSignedOff({ audit_id: res.audit_id, advisory_markdown: res.advisory_markdown });
        return res;
      }
      setError("Unexpected flow state: " + res.stage);
      return null;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  function reset() {
    setRefText(""); setRefFile(null); setOrigin(""); setMode("driving");
    setThreadId(null); setProposal(null); setConfirmed(null);
    setRankData(null); setChosen(null); setSignedOff(null); setError("");
  }

  const value = {
    specialties,
    refText, setRefText, refFile, setRefFile, origin, setOrigin, mode, setMode,
    threadId, proposal, confirmed, rankData, setRankData, chosen, setChosen, signedOff,
    busy, error, setError, dir, setDir,
    startFlow, confirmSpecialty, signOff, reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}