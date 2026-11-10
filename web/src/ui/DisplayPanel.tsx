import type { DisplayOptions } from "../pipeline/types";

type Props = {
  display: DisplayOptions;
  onChange: (d: DisplayOptions) => void;
  onResetCamera: () => void;
};

const OPTIONS: { key: keyof DisplayOptions; label: string }[] = [
  { key: "facesActive", label: "Faces" },
  { key: "edgesActive", label: "Edges" },
  { key: "verticesActive", label: "Vertices" },
  { key: "axesActive", label: "XYZ axes" },
];

export function DisplayPanel({ display, onChange, onResetCamera }: Props) {
  const set = <K extends keyof DisplayOptions>(key: K, v: DisplayOptions[K]) =>
    onChange({ ...display, [key]: v });

  return (
    <div className="view-section-body">
      {OPTIONS.map((option) => (
        <label key={option.key} className="field field-check">
          <span>{option.label}</span>
          <input
            type="checkbox"
            checked={display[option.key]}
            aria-label={option.label}
            onChange={(event) => set(option.key, event.target.checked)}
          />
        </label>
      ))}
      <button
        type="button"
        className="tool-btn"
        onClick={onResetCamera}
        title="Reset camera to default view"
      >
        Reset camera
      </button>
    </div>
  );
}
