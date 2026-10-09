// Same-origin: Vercel proxies /api/* to the Railway backend (vercel.json), and
// Vite proxies in dev (vite.config.js), so we always use relative paths.
// credentials:"include" sends the HttpOnly session cookie on every call.

function onUnauthorized(path, status) {
  // A 401 on a protected route = the session lapsed mid-use. Tell the app to
  // drop the user (bounce to sign-in). Auth routes handle their own 401s.
  if (status === 401 && !path.startsWith("/api/auth")) {
    window.dispatchEvent(new Event("auth:expired"));
  }
}

async function req(path, opts = {}) {
  const r = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    onUnauthorized(path, r.status);
    let msg = `${r.status}`;
    try {
      const b = await r.json();
      if (typeof b.detail === "string") msg = b.detail;
      else if (Array.isArray(b.detail))
        msg = b.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
    } catch {}
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// multipart (file or text) — don't set Content-Type; the browser adds the boundary
async function postForm(path, { file, text }) {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (text) fd.append("text", text);
  const r = await fetch(path, { method: "POST", credentials: "include", body: fd });
  if (!r.ok) {
    onUnauthorized(path, r.status);
    let msg = `${r.status}`;
    try {
      const b = await r.json();
      if (typeof b.detail === "string") msg = b.detail;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const getSpecialties = () => req("/api/specialties");

export const getRank = (specialty, { origin = "", mode = "driving" } = {}) => {
  const p = new URLSearchParams({ specialty, mode });
  if (origin) p.set("origin", origin);
  return req(`/api/rank?${p.toString()}`);
};

export const extractReferral = (args) => postForm("/api/extract", args);
export const flowStart = (args) => postForm("/api/flow/start", args);

export const flowResume = async (thread_id, decision) => {
  const path = "/api/flow/resume";
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id, decision }),
  });
  if (!r.ok) {
    onUnauthorized(path, r.status);
    let msg = `${r.status}`;
    try {
      const b = await r.json();
      if (typeof b.detail === "string") msg = b.detail;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
};

// ---- auth ----
export const authMe = () => req("/api/auth/me");
export const authLogin = (email, password) =>
  req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const authSignup = (email, password) =>
  req("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
export const authLogout = () => req("/api/auth/logout", { method: "POST" });