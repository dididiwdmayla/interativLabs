import { SimControls } from "./sim/SimControls";
import { Timeline } from "./sim/Timeline";

/** Faixa de baixo do Testar: controles e a régua da linha do tempo, sem cobrir o mecanismo. */
export function TestBar() {
  return (
    <div className="testbar">
      <SimControls />
      <Timeline />
    </div>
  );
}
