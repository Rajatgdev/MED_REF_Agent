// Same-origin: Vercel proxies /api/* to the Railway backend (vercel.json), and
// Vite does the same in dev (vite.config.js), so we always use relative paths.
async function req(path) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" } });
  if (!r.ok) {
    let msg = `${r.status}`;
    try {
      const body = await r.json();
      if (typeof body.detail === "string") msg = body.detail;
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

// multipart (file or text) — don't set Content-Type; the browser adds the boundary
export const extractReferral = async ({ file, text }) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (text) fd.append("text", text);
  const r = await fetch("/api/extract", { method: "POST", body: fd });
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
