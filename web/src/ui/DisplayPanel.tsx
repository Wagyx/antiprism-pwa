import { useState } from "react";
import type { DisplayOptions } from "../pipeline/types";

type Props = {
  display: DisplayOptions;
  onChange: (d: DisplayOptions) => void;
  onResetCamera: () => void;
};

export function DisplayPanel({ display, onChange, onResetCamera }: Props) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof DisplayOptions>(key: K, v: DisplayOptions[K]) =>
    onChange({ ...display, [key]: v });

  return (
    <div className={`display-panel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="overlay-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="overlay-panel-title">Display</span>
        <span className="overlay-panel-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="display-panel-body">
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
          <label>
            <input
              type="checkbox"
              checked={display.axesActive}
              onChange={(e) => set("axesActive", e.target.checked)}
            />
            XYZ axes
          </label>
          <button
            type="button"
            className="display-reset-camera"
            onClick={onResetCamera}
            title="Reset camera to default view"
          >
            Reset camera
          </button>
        </div>
      ) : null}
    </div>
  );
}
