import { useEffect, useState } from "react";
import { getSpecialties, getRank, flowStart, flowResume } from "./lib/api";

// Phase 0-3b UI. Step 1: upload/paste a referral -> start the LangGraph flow ->
// GP confirms at the gate (or picks manually). Step 2: origin + mode -> ranked lists.
// Wait and travel shown SEPARATELY (no combined score). Missing wait = "missing",
// uncomputed travel = "unavailable" — never 0.

function waitLabel(h) {
  if (h.first_appt_days == null) return "missing";
  return `${h.first_appt_days} days (HSE, ${h.observation_date})`;
}

function travelLabel(h) {
  return h.travel_minutes == null ? "unavailable" : `${h.travel_minutes} min`;
}

function List({ title, note, hospitals }) {
  return (
    <div className="list">
      <h2>{title}</h2>
      <p className="note">{note}</p>
      <ol>
        {hospitals.map((h) => (
          <li key={h.hospital}>
            <span className="name">{h.hospital}</span>
            <span className="wait">{waitLabel(h)}</span>
            <span className="travel">travel: {travelLabel(h)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function App() {
  const [specialties, setSpecialties] = useState([]);
  const [specialty, setSpecialty] = useState("orthopaedics");
  const [origin, setOrigin] = useState("");
  const [mode, setMode] = useState("driving");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // flow (Phase 3)
  const [refText, setRefText] = useState("");
  const [refFile, setRefFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [manualPick, setManualPick] = useState("");
  const [confirmed, setConfirmed] = useState(null);   // {display_name, source}
  const [flowError, setFlowError] = useState("");

  useEffect(() => {
    getSpecialties().then(setSpecialties).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!specialty) return;
    const t = setTimeout(() => {
      setError("");
      getRank(specialty, { origin, mode })
        .then(setData)
        .catch((e) => setError(e.message));
    }, 400);
    return () => clearTimeout(t);
  }, [specialty, origin, mode]);

  const onExtract = async () => {
    if (!refText.trim() && !refFile) {
      setFlowError("Paste a referral or choose a file first.");
      return;
    }
    setExtracting(true);
    setFlowError("");
    setProposal(null);
    setConfirmed(null);
    setManualPick("");
    try {
      const res = await flowStart({ file: refFile, text: refText });
      setThreadId(res.thread_id);
      setProposal(res.proposal);
    } catch (e) {
      setFlowError(e.message);
    } finally {
      setExtracting(false);
    }
  };

  // Resume the graph at the confirm gate with the GP's decision, then set the
  // working specialty. source = 'model' (accepted the extraction) or 'clinician'.
  const confirm = async (specialty_id, display_name, source) => {
    setFlowError("");
    try {
      await flowResume(threadId, { specialty_id, display_name, source });
      setSpecialty(specialty_id);
      setConfirmed({ display_name, source });
      setThreadId(null);
      setProposal(null);
    } catch (e) {
      setFlowError(e.message);
    }
  };

  const confirmManual = () => {
    const s = specialties.find((x) => x.specialty_id === manualPick);
    if (s) confirm(s.specialty_id, s.display_name, "clinician");
  };

  return (
    <main>
      <header>
        <h1>Referral Options Agent</h1>
        <p className="tag">
          Advisory only. Estimates, not guarantees. The GP decides — this tool
          never submits, books, or chooses a referral.
        </p>
      </header>

      <section className="referral">
        <h2>1 · Referral</h2>
        <p className="note">
          Paste the referral text or upload a typed PDF / Word file (image PDFs are
          read via OCR). The letter stays on the backend; only the stated specialty
          is extracted, then you confirm it.
        </p>
        <textarea
          rows={5}
          value={refText}
          placeholder="Paste the referral letter here…"
          onChange={(e) => setRefText(e.target.value)}
        />
        <div className="referral-actions">
          <input
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.tiff"
            onChange={(e) => setRefFile(e.target.files?.[0] || null)}
          />
          <button onClick={onExtract} disabled={extracting}>
            {extracting ? "Extracting…" : "Extract specialty"}
          </button>
        </div>

        {flowError && <p className="error">{flowError}</p>}

        {proposal && proposal.source === "model" && (
          <div className="extract ok">
            <p>
              Extracted specialty: <strong>{proposal.display_name}</strong>
            </p>
            <blockquote>"{proposal.evidence_quote}"</blockquote>
            <button
              onClick={() => confirm(proposal.specialty_id, proposal.display_name, "model")}
            >
              Use this specialty
            </button>
            <span className="hint">Not right? Pick manually below — the GP decides.</span>
          </div>
        )}

        {proposal && proposal.source === "none" && (
          <div className="extract warn">
            <p>{proposal.detail}</p>
            <div className="referral-actions">
              <select value={manualPick} onChange={(e) => setManualPick(e.target.value)}>
                <option value="">Select the specialty…</option>
                {specialties.map((s) => (
                  <option key={s.specialty_id} value={s.specialty_id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
              <button onClick={confirmManual} disabled={!manualPick}>
                Confirm selection
              </button>
            </div>
          </div>
        )}

        {confirmed && (
          <p className="confirmed">
            Using <strong>{confirmed.display_name}</strong> —{" "}
            {confirmed.source === "model" ? "extracted from the letter" : "entered by the clinician"}.
          </p>
        )}
      </section>

      <section>
        <h2>2 · Options</h2>
        <div className="controls">
          <label>
            Specialty&nbsp;
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {specialties.map((s) => (
                <option key={s.specialty_id} value={s.specialty_id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Origin town&nbsp;
            <input
              value={origin}
              placeholder="e.g. Ennis (blank = no travel)"
              onChange={(e) => setOrigin(e.target.value)}
            />
          </label>
          <label>
            Mode&nbsp;
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="driving">Driving</option>
              <option value="transit">Public transport</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {data && (
        <div className="lists">
          <List
            title="Wait-led"
            note={`ordered by ${data.pathway.replace(/_/g, " ")}`}
            hospitals={data.wait_led}
          />
          <List
            title="Travel-led"
            note={`ordered by ${data.travel_mode} journey time${origin ? "" : " — add an origin town"}`}
            hospitals={data.travel_led}
          />
        </div>
      )}
    </main>
  );
}