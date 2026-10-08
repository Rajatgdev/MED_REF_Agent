// Shared display helpers. Deterministic — a missing wait reads "missing", an
// uncomputed route reads "unavailable". Never 0, never a guess.
export function waitLabel(h) {
    if (h.first_appt_days == null) return "missing";
    return `${h.first_appt_days} days`;
  }
  
  export function travelLabel(h) {
    return h.travel_minutes == null ? "unavailable" : `${h.travel_minutes} min`;
  }
  
  export function downloadMarkdown(md, name) {
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }