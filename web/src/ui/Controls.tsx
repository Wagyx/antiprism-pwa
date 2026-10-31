import type { AntiprismTool } from "../wasm/runTool";

const POLYGON_TYPES = [
  "prism",
  "antiprism",
  "pyramid",
  "dipyramid",
  "cupola",
  "orthobicupola",
  "gyrobicupola",
  "snub-antiprism",
  "dihedron",
] as const;

export type ControlsState = {
  mode: AntiprismTool;
  polygonType: (typeof POLYGON_TYPES)[number];
  numSides: number;
  conway: string;
  verticesActive: boolean;
  edgesActive: boolean;
  facesActive: boolean;
};

type Props = {
  value: ControlsState;
  onChange: (next: ControlsState) => void;
  onGenerate: () => void;
  busy: boolean;
  error: string | null;
};

export function Controls({ value, onChange, onGenerate, busy, error }: Props) {
  const set = <K extends keyof ControlsState>(key: K, v: ControlsState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <aside className="controls">
      <h1>Antiprism</h1>
      <p className="tagline">Wasm seeds · Three.js view</p>

      <label className="field">
        <span>Tool</span>
        <select
          value={value.mode}
          onChange={(e) => set("mode", e.target.value as AntiprismTool)}
        >
          <option value="polygon">polygon</option>
          <option value="conway">conway</option>
        </select>
      </label>

      {value.mode === "polygon" ? (
        <>
          <label className="field">
            <span>Type</span>
            <select
              value={value.polygonType}
              onChange={(e) =>
                set("polygonType", e.target.value as ControlsState["polygonType"])
              }
            >
              {POLYGON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sides</span>
            <input
              type="number"
              min={3}
              max={48}
              value={value.numSides}
              onChange={(e) => set("numSides", Number(e.target.value) || 3)}
            />
          </label>
        </>
      ) : (
        <label className="field">
          <span>Notation</span>
          <input
            type="text"
            value={value.conway}
            onChange={(e) => set("conway", e.target.value)}
            placeholder="e.g. oT, aC, kT"
          />
        </label>
      )}

      <fieldset className="toggles">
        <legend>Display</legend>
        <label>
          <input
            type="checkbox"
            checked={value.facesActive}
            onChange={(e) => set("facesActive", e.target.checked)}
          />
          Faces
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.edgesActive}
            onChange={(e) => set("edgesActive", e.target.checked)}
          />
          Edges
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.verticesActive}
            onChange={(e) => set("verticesActive", e.target.checked)}
          />
          Vertices
        </label>
      </fieldset>

      <button type="button" className="primary" disabled={busy} onClick={onGenerate}>
        {busy ? "Running…" : "Generate"}
      </button>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
