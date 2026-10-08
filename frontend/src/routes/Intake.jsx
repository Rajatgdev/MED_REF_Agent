import { useNavigate } from "react-router-dom";
import { useFlow } from "../state/FlowContext";
import Stepper from "../components/Stepper";

export default function Intake() {
  const f = useFlow();
  const navigate = useNavigate();

  async function onExtract() {
    if (!f.refText.trim() && !f.refFile) {
      f.setError("Paste a referral or choose a file first.");
      return;
    }
    const ok = await f.startFlow();
    if (ok) navigate("/verify");
  }

  return (
    <section className="gate">
      <Stepper current={1} />
      <h2>Referral</h2>
      <p className="note">
        Paste the referral text or upload a typed PDF / Word file (image PDFs are
        read via OCR). The letter stays on the backend; only the stated specialty
        is extracted — you confirm it on the next step.
      </p>

      <textarea
        rows={6}
        value={f.refText}
        placeholder="Paste the referral letter here…"
        onChange={(e) => f.setRefText(e.target.value)}
      />

      <div className="field">
        <label htmlFor="file">Or upload a file</label>
        <input
          id="file"
          type="file"
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.tiff"
          onChange={(e) => f.setRefFile(e.target.files?.[0] || null)}
        />
      </div>

      <fieldset className="field-group">
        <legend>Patient origin — coarse, a town, for travel estimates</legend>
        <div className="field">
          <label htmlFor="origin">Origin town</label>
          <input
            id="origin"
            value={f.origin}
            placeholder="e.g. Ennis (blank = no travel estimate)"
            onChange={(e) => f.setOrigin(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mode">Travel mode</label>
          <select id="mode" value={f.mode} onChange={(e) => f.setMode(e.target.value)}>
            <option value="driving">Driving</option>
            <option value="transit">Public transport</option>
          </select>
        </div>
      </fieldset>

      {f.error && <p className="error" role="alert">{f.error}</p>}

      <div className="gate-actions">
        <button onClick={onExtract} disabled={f.busy}>
          {f.busy ? "Extracting…" : "Extract specialty →"}
        </button>
      </div>
    </section>
  );
}