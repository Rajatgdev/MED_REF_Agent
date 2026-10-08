// "Step X of 4" — visual only. A clickable stepper that lets the GP skip the
// specialty check would defeat the gate, so this never links anywhere.
const GATES = ["Referral", "Confirm specialty", "Review options", "Check & sign off"];

export default function Stepper({ current }) {   // current: 1..4
  return (
    <ol className="stepper" aria-label={`Step ${current} of ${GATES.length}`}>
      {GATES.map((name, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={name} className={`step ${state}`} aria-current={n === current ? "step" : undefined}>
            <span className="step-n">{n}</span>
            <span className="step-name">{name}</span>
          </li>
        );
      })}
    </ol>
  );
}