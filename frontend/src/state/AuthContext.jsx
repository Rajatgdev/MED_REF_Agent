import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { authMe, authLogin, authSignup, authLogout } from "../lib/api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser(await authMe()); } catch { setUser(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // a 401 on a protected call (session lapsed) drops the user back to sign-in
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = async (email, password) => { const u = await authLogin(email, password); setUser(u); return u; };
  const signup = async (email, password) => { const u = await authSignup(email, password); setUser(u); return u; };
  const logout = async () => { try { await authLogout(); } catch {} setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}