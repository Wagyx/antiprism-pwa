import type { DisplayOptions } from "../pipeline/types";
import { DisplayPanel } from "./DisplayPanel";
import { StatsPanel } from "./StatsPanel";

type Props = {
  offText: string | null;
  display: DisplayOptions;
  onDisplay: (display: DisplayOptions) => void;
  onResetCamera: () => void;
};

export function ViewPanel({ offText, display, onDisplay, onResetCamera }: Props) {
  return (
    <aside className="controls view-panel">
      <details className="view-section" open>
        <summary>Display</summary>
        <DisplayPanel
          display={display}
          onChange={onDisplay}
          onResetCamera={onResetCamera}
        />
      </details>
      <details className="view-section" open>
        <summary>Stats</summary>
        <StatsPanel offText={offText} />
      </details>
    </aside>
  );
}
