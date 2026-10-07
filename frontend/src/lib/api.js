// Same-origin: Vercel proxies /api/* to the Railway backend (vercel.json), and
// Vite proxies in dev (vite.config.js), so we always use relative paths.
async function req(path, opts = {}) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
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
  const r = await fetch(path, { method: "POST", body: fd });
  if (!r.ok) {
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

// Phase 2 standalone extract (kept as a fallback).
export const extractReferral = (args) => postForm("/api/extract", args);

// Phase 3 gated flow.
export const flowStart = (args) => postForm("/api/flow/start", args);

// Explicit POST (no shared helper) so the method can't get lost.
export const flowResume = async (thread_id, decision) => {
  const r = await fetch("/api/flow/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id, decision }),
  });
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const b = await r.json();
      if (typeof b.detail === "string") msg = b.detail;
    } catch {}
    throw new Error(msg);
  }
  return r.json();
};