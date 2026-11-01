type Mode = "editor" | "library";

type Props = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

export function ModeSwitch({ mode, onChange }: Props) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Module">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "editor"}
        className={mode === "editor" ? "is-active" : ""}
        onClick={() => onChange("editor")}
      >
        Editor
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "library"}
        className={mode === "library" ? "is-active" : ""}
        onClick={() => onChange("library")}
      >
        Library
      </button>
    </div>
  );
}

export type { Mode };
