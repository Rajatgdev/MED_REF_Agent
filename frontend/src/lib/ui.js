// Shared display helpers. A missing wait reads "missing", an uncomputed route
// "unavailable" — never 0, never a guess.
export const waitLabel = (h) => (h.first_appt_days == null ? "missing" : `${h.first_appt_days} d`);
export const travelLabel = (h) => (h.travel_minutes == null ? "unavailable" : `${h.travel_minutes} min`);
export const modeLabel = (m) => (m === "transit" ? "Public transport" : "Driving");

export function downloadMarkdown(md, name) {
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}