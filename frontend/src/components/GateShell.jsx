import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useFlow } from "../state/FlowContext";

// Directional slide (Apple easing). Focus moves to the heading on each gate so
// keyboard + screen-reader users land in the right place.
const variants = {
  enter: (d) => ({ x: d >= 0 ? 26 : -26, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } },
  exit: (d) => ({ x: d >= 0 ? -26 : 26, opacity: 0, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }),
};

export default function GateShell({ wide, eyebrow, title, lede, children, footer }) {
  const { dir } = useFlow();
  const h = useRef(null);
  useEffect(() => { h.current?.focus({ preventScroll: true }); }, []);

  return (
    <motion.section className={`gate${wide ? " wide" : ""}`} custom={dir}
      variants={variants} initial="enter" animate="center" exit="exit">
      <div className="gate-head">
        {eyebrow && <div className="counter">{eyebrow}</div>}
        <h1 className="gate-title" ref={h} tabIndex={-1}>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children}
      {footer && <div className="gate-foot">{footer}</div>}
    </motion.section>
  );
}