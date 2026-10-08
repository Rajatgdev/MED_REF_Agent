import { createContext, useContext, useEffect, useState } from "react";
import { getSpecialties, flowStart, flowResume } from "../lib/api";

// One place for the flow's durable choices + the three backend calls that move
// the LangGraph between gates. Keeping it here means Back/forward between gates
// never loses state, and no patient text ever rides in the URL.
const Ctx = createContext(null);
export const useFlow = () => useContext(Ctx);

export function FlowProvider({ children }) {
  const [specialties, setSpecialties] = useState([]);   // allowlist, loaded once

  // intake inputs
  const [refText, setRefText] = useState("");
  const [refFile, setRefFile] = useState(null);
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState("driving");

  // flow state
  const [threadId, setThreadId] = useState(null);
  const [proposal, setProposal] = useState(null);    // {specialty_id, display_name, evidence_quote, source, detail}
  const [confirmed, setConfirmed] = useState(null);   // {specialty_id, display_name, source}
  const [rankData, setRankData] = useState(null);     // RankedLists snapshot shown at Compare
  const [chosen, setChosen] = useState(null);         // hospital name | null
  const [signedOff, setSignedOff] = useState(null);   // {audit_id, advisory_markdown}

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSpecialties().then(setSpecialties).catch((e) => setError(e.message));
  }, []);

  // Gate 1 -> run to the confirm-specialty interrupt. A fresh run invalidates
  // everything downstream (new thread, possibly new letter).
  async function startFlow() {
    setBusy(true); setError("");
    setConfirmed(null); setRankData(null); setChosen(null); setSignedOff(null);
    try {
      const res = await flowStart({ file: refFile, text: refText });
      setThreadId(res.thread_id);
      setProposal(res.proposal);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Gate 2 -> resume confirm; the flow then parks at the sign-off interrupt.
  async function confirmSpecialty(choice) {   // {specialty_id, display_name, source}
    setBusy(true); setError("");
    try {
      await flowResume(threadId, choice);
      setConfirmed(choice);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Gate 4 -> resume sign-off; the flow ends (audit row + advisory).
  async function signOff() {
    setBusy(true); setError("");
    try {
      const res = await flowResume(threadId, {
        chosen_hospital: chosen,
        origin,
        mode,
        snapshot: rankData,
      });
      if (res.stage === "done") {
        setSignedOff({ audit_id: res.audit_id, advisory_markdown: res.advisory_markdown });
        return res;
      }
      setError("Unexpected flow state: " + res.stage);
      return null;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
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
    busy, error, setError,
    startFlow, confirmSpecialty, signOff, reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}