import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import { getRank } from "../lib/api";
import { waitLabel, travelLabel } from "../lib/ui";
import Stepper from "../components/Stepper";

// Phase A: reuse the existing two-list view. Phase B replaces this with the
// side-by-side panels (shared-ID highlight, unranked group, provenance).
function List({ title, note, hospitals, chosen, onChoose }) {
  return (
    <div className="list">
      <h3>{title}</h3>
      <p className="note">{note}</p>
      <ol>
        {hospitals.map((h) => (
          <li
            key={h.hospital}
            className={`pickable ${chosen === h.hospital ? "selected" : ""}`}
            onClick={() => onChoose(h.hospital)}
          >
            <span className="name">{h.hospital}</span>
            <span className="wait">
              wait: {waitLabel(h)}{h.observation_date ? ` (HSE, ${h.observation_date})` : ""}
            </span>
            <span className="travel">travel: {travelLabel(h)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Compare() {
  const f = useFlow();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rankError, setRankError] = useState("");

  // Guard: need a confirmed specialty to compare.
  useEffect(() => {
    if (!f.confirmed) navigate("/", { replace: true });
  }, [f.confirmed, navigate]);

  const specialty = f.confirmed?.specialty_id;

  // Live ranking, debounced on origin/mode. What the GP sees here IS the snapshot
  // signed off later, so it must stay in sync.
  useEffect(() => {
    if (!specialty) return;
    const t = setTimeout(() => {
      setLoading(true); setRankError("");
      getRank(specialty, { origin: f.origin, mode: f.mode })
        .then((d) => f.setRankData(d))
        .catch((e) => setRankError(e.message))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialty, f.origin, f.mode]);

  if (!f.confirmed) return null;
  const data = f.rankData;

  return (
    <section className="gate wide">
      <Stepper current={3} />
      <h2>Review options — {f.confirmed.display_name}</h2>
      <p className="note">
        Two orderings of the same hospitals. Wait and travel are shown separately —
        there is no combined score. Pick a hospital to carry to sign-off.
      </p>

      <div className="controls">
        <label>
          Origin town&nbsp;
          <input value={f.origin} placeholder="e.g. Ennis" onChange={(e) => f.setOrigin(e.target.value)} />
        </label>
        <label>
          Mode&nbsp;
          <select value={f.mode} onChange={(e) => f.setMode(e.target.value)}>
            <option value="driving">Driving</option>
            <option value="transit">Public transport</option>
          </select>
        </label>
        {loading && <span className="hint">updating…</span>}
      </div>

      {rankError && <p className="error" role="alert">{rankError}</p>}

      {data && (
        <div className="lists">
          <List
            title="Wait-led"
            note={`ordered by ${data.pathway.replace(/_/g, " ")}`}
            hospitals={data.wait_led}
            chosen={f.chosen}
            onChoose={f.setChosen}
          />
          <List
            title="Travel-led"
            note={`ordered by ${data.travel_mode} journey time${f.origin ? "" : " — add an origin town"}`}
            hospitals={data.travel_led}
            chosen={f.chosen}
            onChoose={f.setChosen}
          />
        </div>
      )}

      <div className="gate-actions split">
        <button className="link" onClick={() => navigate("/verify")}>← Back</button>
        <span className="chosen-note">
          {f.chosen ? <>Chosen: <strong>{f.chosen}</strong></> : "Pick a hospital to continue"}
        </span>
        <button onClick={() => navigate("/signoff")} disabled={!f.chosen}>Continue to sign-off →</button>
      </div>
    </section>
  );
}