import { MotionConfig } from "framer-motion";
import { AuthProvider, useAuth } from "./state/AuthContext";
import { FlowProvider } from "./state/FlowContext";
import AppShell from "./components/AppShell";
import Auth from "./routes/Auth";

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-screen"><p className="auth-splash">Loading…</p></div>;
  if (!user) return <Auth />;
  return (
    <FlowProvider>
      <AppShell />
    </FlowProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MotionConfig reducedMotion="user">
        <Gate />
      </MotionConfig>
    </AuthProvider>
  );
}