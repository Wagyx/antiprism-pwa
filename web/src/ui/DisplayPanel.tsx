import type { DisplayOptions } from "../pipeline/types";

type Props = {
  display: DisplayOptions;
  onChange: (d: DisplayOptions) => void;
  onResetCamera: () => void;
};

export function DisplayPanel({ display, onChange, onResetCamera }: Props) {
  const set = <K extends keyof DisplayOptions>(key: K, v: DisplayOptions[K]) =>
    onChange({ ...display, [key]: v });

  return (
    <fieldset className="display-panel">
      <legend>Display</legend>
      <label>
        <input
          type="checkbox"
          checked={display.facesActive}
          onChange={(e) => set("facesActive", e.target.checked)}
        />
        Faces
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.edgesActive}
          onChange={(e) => set("edgesActive", e.target.checked)}
        />
        Edges
      </label>
      <label>
        <input
          type="checkbox"
          checked={display.verticesActive}
          onChange={(e) => set("verticesActive", e.target.checked)}
        />
        Vertices
      </label>
      <button
        type="button"
        className="display-reset-camera"
        onClick={onResetCamera}
        title="Reset camera to default view"
      >
        Reset camera
      </button>
    </fieldset>
  );
}
