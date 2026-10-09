import { useCallback, useEffect, useRef, useState } from "react";
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
      <button key={h.hospital} type="button" aria-pressed={sel} data-kind={kind} data-hospital={h.hospital}
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
  const panelsRef = useRef(null);
  const [connector, setConnector] = useState(null);

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

  const data = f.rankData;
  const rankedWait = data ? data.wait_led.filter((h) => h.first_appt_days != null).length : 0;
  const total = data ? data.wait_led.length : 0;

  const drawConnector = useCallback(() => {
    const root = panelsRef.current;
    if (!root || !f.chosen || window.matchMedia("(max-width: 760px)").matches) {
      setConnector(null);
      return;
    }

    const waitRow = root.querySelector('.hrow.sel[data-kind="wait"]');
    const travelRow = root.querySelector('.hrow.sel[data-kind="travel"]');
    if (!waitRow || !travelRow) {
      setConnector(null);
      return;
    }

    const frame = root.getBoundingClientRect();
    const wait = waitRow.getBoundingClientRect();
    const travel = travelRow.getBoundingClientRect();
    const x1 = wait.right - frame.left;
    const y1 = wait.top + wait.height / 2 - frame.top;
    const x2 = travel.left - frame.left;
    const y2 = travel.top + travel.height / 2 - frame.top;
    const curve = Math.max(8, Math.min(28, (x2 - x1) * 0.45));

    setConnector({
      width: frame.width,
      height: frame.height,
      x1,
      y1,
      x2,
      y2,
      path: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
    });
  }, [f.chosen]);

  useEffect(() => {
    const root = panelsRef.current;
    if (!root) return undefined;

    let frame = 0;
    const scheduleDraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawConnector);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleDraw);

    observer?.observe(root);
    window.addEventListener("resize", scheduleDraw);
    scheduleDraw();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleDraw);
    };
  }, [data, drawConnector]);

  if (!f.confirmed) return null;

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
        <div className="panels" ref={panelsRef}>
          <Panel kind="wait" items={data.wait_led} origin={f.origin} chosen={f.chosen} onChoose={f.setChosen} />
          <Panel kind="travel" items={data.travel_led} origin={f.origin} chosen={f.chosen} onChoose={f.setChosen} />
          {connector && (
            <svg className="selection-connector" viewBox={`0 0 ${connector.width} ${connector.height}`} preserveAspectRatio="none" aria-hidden="true">
              <path d={connector.path} />
              <circle cx={connector.x1} cy={connector.y1} r="3" />
              <circle cx={connector.x2} cy={connector.y2} r="3" />
            </svg>
          )}
        </div>
      )}
    </GateShell>
  );
}
