import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import GateShell from "../components/GateShell";

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 15V4m0 0L8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
);

export default function Intake() {
  const f = useFlow();
  const nav = useNavigate();

  async function onExtract() {
    if (!f.refText.trim() && !f.refFile) { f.setError("Paste a referral or choose a file first."); return; }
    f.setDir(1);
    if (await f.startFlow()) nav("/verify");
  }

  return (
    <GateShell
      eyebrow="Step 1 of 4"
      title="Start with the referral"
      lede="Paste the letter or upload a typed PDF or Word file. It stays on the backend — only the stated specialty is extracted, and you confirm it next."
      footer={<button className="btn" onClick={onExtract} disabled={f.busy}>{f.busy ? "Extracting…" : "Extract specialty"}</button>}
    >
      <textarea className="textarea" rows={6} value={f.refText}
        placeholder="Paste the referral letter here…" onChange={(e) => f.setRefText(e.target.value)} />

      <div className="divider"><span>or upload a file</span></div>

      <label className="drop">
        <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.tiff"
          onChange={(e) => f.setRefFile(e.target.files?.[0] || null)} />
        <span className="drop-ic"><UploadIcon /></span>
        <span className="drop-tx">
          <b>{f.refFile ? f.refFile.name : "Drop a PDF, DOCX or TXT"}</b>
          <span>{f.refFile ? "Ready to extract" : "Image PDFs are read with OCR"}</span>
        </span>
      </label>

      <div className="fields2">
        <div className="field">
          <label htmlFor="origin">Patient origin — a town</label>
          <input id="origin" className="input" value={f.origin} placeholder="e.g. Ennis"
            onChange={(e) => f.setOrigin(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mode">Travel mode</label>
          <select id="mode" className="select" value={f.mode} onChange={(e) => f.setMode(e.target.value)}>
            <option value="driving">Driving</option>
            <option value="transit" disabled>Public transport — not available yet</option>
          </select>
        </div>
      </div>

      {f.error && <p className="error" role="alert">{f.error}</p>}
    </GateShell>
  );
}
