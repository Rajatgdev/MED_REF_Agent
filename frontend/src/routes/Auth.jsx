import { useState } from "react";
import { useAuth } from "../state/AuthContext";

const Mark = () => (
  <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path d="M5.75 4.75h13l6 6v20.5H5.75z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.75 4.75v6h6M9.75 15.25h9M9.75 19.25h6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.25 24.25h4.5c3.2 0 3.2-5 6.4-5h.9M20.75 24.25c3.2 0 3.2 5 6.4 5h.9" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="29.5" cy="19.25" r="1.65" fill="var(--accent)" />
    <circle cx="29.5" cy="29.25" r="1.65" fill="var(--accent)" />
  </svg>
);

export default function Auth() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signin = mode === "signin";

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    if (!signin && password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true); setError("");
    try {
      if (signin) await login(email.trim(), password);
      else await signup(email.trim(), password);
      // success unmounts this screen (the app gate swaps to the workspace)
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth">
        <aside className="auth-aside">
          <div className="brand"><Mark /><span className="wm"><b>Referral Options</b><span>Clinician advisory</span></span></div>
          <p className="auth-aside-lede">Sign in to review referral options — HSE waits and travel time, two orderings, the GP's decision.</p>
          <p className="auth-aside-foot"><b>Advisory only.</b> The GP decides. This tool never submits, books, or chooses a referral. For authorised clinicians.</p>
        </aside>

        <form className="auth-form" onSubmit={submit}>
          <h1 className="auth-h1">{signin ? "Sign in" : "Create your account"}</h1>
          <p className="auth-sub">{signin ? "Access the referral review workspace." : "For authorised clinicians reviewing referrals."}</p>

          {error && <p className="error" role="alert">{error}</p>}

          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email}
              placeholder="you@practice.ie" onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="field">
            <div className="row-between">
              <label htmlFor="pw">Password</label>
              {!signin && <span className="hint">At least 8 characters</span>}
            </div>
            <input id="pw" className="input" type="password"
              autoComplete={signin ? "current-password" : "new-password"} value={password}
              placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button className="btn auth-btn" type="submit" disabled={busy}>
            {busy ? (signin ? "Signing in…" : "Creating…") : (signin ? "Sign in" : "Create account")}
          </button>

          <p className="auth-toggle">
            {signin
              ? <>New here? <button type="button" onClick={() => { setMode("signup"); setError(""); }}>Create an account</button></>
              : <>Already registered? <button type="button" onClick={() => { setMode("signin"); setError(""); }}>Sign in</button></>}
          </p>
        </form>
      </div>
    </div>
  );
}