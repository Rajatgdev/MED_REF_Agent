import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useFlow } from "../state/FlowContext";
import { getRank } from "../lib/api";
import GateShell from "../components/GateShell";

const CheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".16"/><path d="M8.5 12.2 11 14.6l4.5-4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const metric = (label, value, lead) => (
  <span className={`metric${lead ? " lead" : ""}`}>{label} <span className="v">{value}</span></span>
);

function Panel({ kind, items, origin, chosen, onChoose }) {
  const isWait = kind === "wait";
  const has = (h) => (isWait ? h.first_appt_days != null : h.travel_minutes != null);
  const ranked = items.filter(has);
  const unranked = items.filter((h) => !has(h));
  const prov = (h) => isWait
    ? `HSE estimate · first appt · ${h.observation_date || "date n/a"}`
    : `ORS route · from ${origin || "origin"} · approx`;

  const row = (h, rank) => {
    const waitV = h.first_appt_days != null ? `${h.first_appt_days} d` : "—";
    const travV = h.travel_minutes != null ? `${h.travel_minutes} min` : "—";
    const sel = chosen === h.hospital;
    const missing = rank == null;
    return (
      <button key={h.hospital} type="button" aria-pressed={sel}
        className={`hrow${sel ? " sel" : ""}${missing ? " missing" : ""}`} onClick={() => onChoose(h.hospital)}>
        {sel && <motion.span className="sel-bg" layoutId={`sel-${kind}`} transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
        <span className="rk">{missing ? "—" : rank}</span>
        <span className="hbody">
          <span className="hn">{h.hospital}</span>
          {missing && isWait ? (
            <span className="chip-missing">No HSE wait published</span>
          ) : (
            <>
              <span className="metrics">
                {isWait
                  ? <>{metric("wait", waitV, true)}{metric("drive", travV, false)}</>
                  : <>{metric("drive", travV, true)}{metric("wait", waitV, false)}</>}
              </span>
              <span className="prov">{prov(h)}</span>
            </>
          )}
        </span>
        <span className="check">{sel && <CheckCircle />}</span>
      </button>
    );
  };

  return (
    <div className={`panel ${kind}`}>
      <div className="panel-h">
        <span className="dot" />
        <span><b>{isWait ? "Wait-led" : "Travel-led"}</b><span>{isWait ? "shortest first appointment first" : "shortest drive first"}</span></span>
      </div>
      <div className="rows">
        {ranked.length === 0 && (
          <p className="cmp-empty">{isWait ? "No hospital has a published wait for this specialty." : "Add an origin town to rank by travel time."}</p>
        )}
        {ranked.map((h, i) => row(h, i + 1))}
        {unranked.length > 0 && (
          <>
            <div className="group-label">{isWait ? "Not enough data to rank" : "Route unavailable"}</div>
            {unranked.map((h) => row(h, null))}
          </>
        )}
      </div>
    </div>
  );
}

export default function Compare() {
  const f = useFlow();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rankError, setRankError] = useState("");

  useEffect(() => { if (!f.confirmed) nav("/", { replace: true }); }, [f.confirmed, nav]);
  const specialty = f.confirmed?.specialty_id;

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
  const rankedWait = data ? data.wait_led.filter((h) => h.first_appt_days != null).length : 0;
  const total = data ? data.wait_led.length : 0;

  return (
    <GateShell wide eyebrow={`Step 3 of 4 · ${f.confirmed.display_name}`} title="Review the options"
      lede="The same hospitals, two orderings. Wait and travel are shown separately — there is no combined score. Pick one to carry to sign-off."
      footer={<>
        <button className="linkbtn" onClick={() => { f.setDir(-1); nav("/verify"); }}>Back</button>
        <span className="chosen">{f.chosen ? <>Chosen: <strong>{f.chosen}</strong></> : "Pick a hospital to continue"}</span>
        <button className="btn" disabled={!f.chosen} onClick={() => { f.setDir(1); nav("/signoff"); }}>Continue to sign-off</button>
      </>}>

      <div className="cmp-controls">
        <label className="ctl">Origin<input value={f.origin} placeholder="e.g. Ennis" onChange={(e) => f.setOrigin(e.target.value)} /></label>
        <label className="ctl">Mode
          <select value={f.mode} onChange={(e) => f.setMode(e.target.value)}>
            <option value="driving">Driving</option>
            <option value="transit" disabled>Public transport — not available yet</option>
          </select>
        </label>
        {loading && <span className="hint">updating…</span>}
        {data && <span className="coverage"><b>{rankedWait}</b> ranked by wait · <b>{total - rankedWait}</b> without wait data</span>}
      </div>

      {rankError && <p className="error" role="alert">{rankError}</p>}

      {data && (
        <div className="panels">
          <Panel kind="wait" items={data.wait_led} origin={f.origin} chosen={f.chosen} onChoose={f.setChosen} />
          <Panel kind="travel" items={data.travel_led} origin={f.origin} chosen={f.chosen} onChoose={f.setChosen} />
        </div>
      )}
    </GateShell>
  );
}
