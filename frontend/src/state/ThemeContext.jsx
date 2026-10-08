import { createContext, useContext, useEffect, useState } from "react";

// light / dark / system. "system" removes the attribute so the prefers-color-scheme
// media query governs. Choice persists per browser.
const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx);

function stored() {
  try { return localStorage.getItem("roa-theme"); } catch { return null; }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => stored() || "system");

  useEffect(() => {
    const el = document.documentElement;
    try {
      if (theme === "system") { el.removeAttribute("data-theme"); localStorage.removeItem("roa-theme"); }
      else { el.setAttribute("data-theme", theme); localStorage.setItem("roa-theme", theme); }
    } catch { /* private mode: still apply the attribute */ el.setAttribute("data-theme", theme); }
  }, [theme]);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}