import {
  createConwayOp,
  createPolygonOp,
  POLYGON_TYPES,
  type DisplayOptions,
  type PipelineOp,
  type PolygonType,
} from "../pipeline/types";
import { ConwayInfoButton } from "./ConwayInfoButton";

type Props = {
  ops: PipelineOp[];
  /** Undoable structural / committed edits. */
  onCommit: (ops: PipelineOp[]) => void;
  /** Live param edits (no history entry). */
  onPatch: (ops: PipelineOp[]) => void;
  display: DisplayOptions;
  onDisplayChange: (d: DisplayOptions) => void;
  busy: boolean;
  error: string | null;
  failedStep: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

function updateOp(ops: PipelineOp[], id: string, patch: Partial<PipelineOp>): PipelineOp[] {
  return ops.map((op) => {
    if (op.id !== id) return op;
    return { ...op, ...patch } as PipelineOp;
  });
}

function moveOp(ops: PipelineOp[], index: number, dir: -1 | 1): PipelineOp[] {
  const j = index + dir;
  if (j < 0 || j >= ops.length) return ops;
  const next = ops.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export function StackPanel({
  ops,
  onCommit,
  onPatch,
  display,
  onDisplayChange,
  busy,
  error,
  failedStep,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const setDisplay = <K extends keyof DisplayOptions>(key: K, v: DisplayOptions[K]) =>
    onDisplayChange({ ...display, [key]: v });

  return (
    <aside className="controls">
      <h1>Antiprism</h1>
      <p className="tagline">modifier stack · Wasm pipeline</p>

      <div className="toolbar">
        <button type="button" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Y)">
          Redo
        </button>
        <span className={`busy-hint${busy ? " is-on" : ""}`} aria-live="polite">
          Running…
        </span>
      </div>

      <div className="stack">
        <div className="stack-heading">Operations</div>
        {ops.length === 0 ? (
          <p className="stack-empty">Add a seed to begin.</p>
        ) : null}
        {ops.map((op, index) => (
          <div
            key={op.id}
            className={`stack-card${failedStep === index ? " is-error" : ""}`}
          >
            <div className="stack-card-head">
              <span className="step-index">{index + 1}</span>
              <select
                className="kind-select"
                value={op.kind}
                onChange={(e) => {
                  const kind = e.target.value as PipelineOp["kind"];
                  if (kind === op.kind) return;
                  const replacement =
                    kind === "polygon"
                      ? createPolygonOp()
                      : createConwayOp(index === 0 ? "T" : "a");
                  onCommit(
                    ops.map((o, i) => (i === index ? { ...replacement, id: o.id } : o)),
                  );
                }}
              >
                <option value="polygon">polygon</option>
                <option value="conway">conway</option>
              </select>
              <div className="stack-card-actions">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => onCommit(moveOp(ops, index, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={index === ops.length - 1}
                  onClick={() => onCommit(moveOp(ops, index, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove step"
                  onClick={() => onCommit(ops.filter((o) => o.id !== op.id))}
                >
                  ×
                </button>
              </div>
            </div>

            {op.kind === "polygon" ? (
              <div className="stack-card-body">
                <label className="field">
                  <span>Type</span>
                  <select
                    value={op.polygonType}
                    onChange={(e) =>
                      onCommit(
                        updateOp(ops, op.id, {
                          polygonType: e.target.value as PolygonType,
                        }),
                      )
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
                    value={op.numSides}
                    onChange={(e) =>
                      onPatch(
                        updateOp(ops, op.id, {
                          numSides: Number(e.target.value) || 3,
                        }),
                      )
                    }
                    onBlur={() => onCommit(ops)}
                  />
                </label>
              </div>
            ) : (
              <div className="stack-card-body">
                <div className="field-row">
                  <label className="field field-grow">
                    <span className="field-label-row">
                      {index === 0 ? "Notation (seed)" : "Operators"}
                      <ConwayInfoButton />
                    </span>
                    <input
                      type="text"
                      value={op.notation}
                      placeholder={index === 0 ? "e.g. oT, aC" : "e.g. a, k, t"}
                      onChange={(e) =>
                        onPatch(updateOp(ops, op.id, { notation: e.target.value }))
                      }
                      onBlur={() => onCommit(ops)}
                    />
                  </label>
                </div>
                {index > 0 ? (
                  <p className="hint">Pipes previous OFF in as input.</p>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className="add-op">
        <summary className="add-op-btn">Add operation</summary>
        <div className="add-op-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              onCommit([...ops, createPolygonOp()]);
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            polygon
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              onCommit([
                ...ops,
                createConwayOp(ops.length === 0 ? "T" : "a"),
              ]);
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            conway
          </button>
        </div>
      </details>

      <fieldset className="toggles">
        <legend>Display</legend>
        <label>
          <input
            type="checkbox"
            checked={display.facesActive}
            onChange={(e) => setDisplay("facesActive", e.target.checked)}
          />
          Faces
        </label>
        <label>
          <input
            type="checkbox"
            checked={display.edgesActive}
            onChange={(e) => setDisplay("edgesActive", e.target.checked)}
          />
          Edges
        </label>
        <label>
          <input
            type="checkbox"
            checked={display.verticesActive}
            onChange={(e) => setDisplay("verticesActive", e.target.checked)}
          />
          Vertices
        </label>
      </fieldset>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
