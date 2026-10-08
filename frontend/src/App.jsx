import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "./state/ThemeContext";
import { FlowProvider } from "./state/FlowContext";
import AppShell from "./components/AppShell";

// Providers + global motion config. reducedMotion="user" makes every transform
// animation respect the OS "reduce motion" setting; opacity still resolves.
export default function App() {
  return (
    <ThemeProvider>
      <FlowProvider>
        <MotionConfig reducedMotion="user">
          <AppShell />
        </MotionConfig>
      </FlowProvider>
    </ThemeProvider>
  );
}