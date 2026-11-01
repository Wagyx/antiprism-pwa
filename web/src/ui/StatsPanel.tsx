import { useMemo, useState } from "react";
import { parseOff } from "../viewer/parseOff";

type Props = {
  offText: string | null;
};

type Counts = { vertices: number; edges: number; faces: number };

function countElements(offText: string | null): Counts | null {
  if (!offText?.trim()) return null;
  try {
    const parsed = parseOff(offText);
    return {
      vertices: parsed.vertices.length,
      edges: parsed.edges.length,
      faces: parsed.faces.length,
    };
  } catch {
    return null;
  }
}

export function StatsPanel({ offText }: Props) {
  const [open, setOpen] = useState(true);
  const counts = useMemo(() => countElements(offText), [offText]);

  return (
    <div className={`stats-panel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="overlay-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="overlay-panel-title">Stats</span>
        <span className="overlay-panel-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <dl className="stats-panel-body">
          <div>
            <dt>Vertices</dt>
            <dd>{counts ? counts.vertices : "—"}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>{counts ? counts.edges : "—"}</dd>
          </div>
          <div>
            <dt>Faces</dt>
            <dd>{counts ? counts.faces : "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
