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
export const getRank = (specialty) =>
  req(`/api/rank?specialty=${encodeURIComponent(specialty)}`);
