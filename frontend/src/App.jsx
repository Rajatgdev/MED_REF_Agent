import { useEffect, useState } from "react";
import { getSpecialties, getRank } from "./lib/api";

// Phase 0-1 UI: pick a specialty + coarse origin + mode, see the two deterministic
// orderings side by side. Wait and travel are shown SEPARATELY (no combined score).
// Missing wait shows as "missing", uncomputed travel as "unavailable" — never 0.
// The gated upload → extract → confirm → export flow arrives in Phase 3.

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

  useEffect(() => {
    getSpecialties().then(setSpecialties).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!specialty) return;
    setError("");
    getRank(specialty, { origin, mode })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [specialty, origin, mode]);

  return (
    <main>
      <header>
        <h1>Referral Options Agent</h1>
        <p className="tag">
          Advisory only. Estimates, not guarantees. The GP decides — this tool
          never submits, books, or chooses a referral.
        </p>
      </header>

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