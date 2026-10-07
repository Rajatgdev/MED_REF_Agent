import { useEffect, useState } from "react";
import { getSpecialties, getRank, extractReferral } from "./lib/api";

// Phase 0-2 UI. Step 1: upload/paste a referral, extract the STATED specialty,
// GP confirms (or picks manually — the GP always decides). Step 2: origin + mode.
// Wait and travel are shown SEPARATELY (no combined score). Missing wait = "missing",
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

  // extraction (Phase 2)
  const [refText, setRefText] = useState("");
  const [refFile, setRefFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extract, setExtract] = useState(null);
  const [extractError, setExtractError] = useState("");

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
      setExtractError("Paste a referral or choose a file first.");
      return;
    }
    setExtracting(true);
    setExtractError("");
    setExtract(null);
    try {
      const res = await extractReferral({ file: refFile, text: refText });
      setExtract(res);
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const useExtracted = () => {
    if (extract?.specialty_id) setSpecialty(extract.specialty_id);
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
          Paste the referral text or upload a typed PDF / Word file. The letter
          stays on the backend; only the stated specialty is extracted.
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

        {extractError && <p className="error">{extractError}</p>}

        {extract && extract.source === "model" && (
          <div className="extract ok">
            <p>
              Extracted specialty: <strong>{extract.display_name}</strong>
            </p>
            <blockquote>"{extract.evidence_quote}"</blockquote>
            <button onClick={useExtracted}>Use this specialty</button>
            <span className="hint">Not right? Pick manually below — the GP decides.</span>
          </div>
        )}

        {extract && extract.source === "none" && (
          <div className="extract warn">
            <p>{extract.detail}</p>
            <span className="hint">Select the specialty manually below.</span>
          </div>
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