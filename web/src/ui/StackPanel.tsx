import { useState } from "react";
import {
  createOp,
  OFF_COLOR_PRESETS,
  OFF_UTIL_PRESETS,
  PIPELINE_KINDS,
  POLYGON_TYPES,
  type PipelineKind,
  type PipelineOp,
  type PolygonType,
} from "../pipeline/types";
import { ToolInfoButton } from "./ToolInfoButton";

type Props = {
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
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

function opSummary(op: PipelineOp): string {
  switch (op.kind) {
    case "polygon":
      return `${op.polygonType} ${op.numSides}`;
    case "conway":
      return op.notation || "…";
    case "geodesic":
      return `f=${op.frequency} ${op.faceClass} ${op.method}`;
    case "off_color":
      return [op.faces && `f:${op.faces}`, op.edges && `e:${op.edges}`, op.vertices && `v:${op.vertices}`]
        .filter(Boolean)
        .join(" ") || "…";
    case "off_util":
      return op.flags || "…";
  }
}

function OpFields({
  op,
  index,
  ops,
  onCommit,
  onPatch,
}: {
  op: PipelineOp;
  index: number;
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
}) {
  if (op.kind === "polygon") {
    return (
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
    );
  }

  if (op.kind === "conway") {
    return (
      <div className="stack-card-body">
        <div className="field-row">
          <label className="field field-grow">
            <span className="field-label-row">
              {index === 0 ? "Notation (seed)" : "Operators"}
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
        {index > 0 ? <p className="hint">Pipes previous OFF in as input.</p> : null}
      </div>
    );
  }

  if (op.kind === "geodesic") {
    return (
      <div className="stack-card-body">
        <label className="field">
          <span>Frequency</span>
          <input
            type="number"
            min={1}
            max={32}
            value={op.frequency}
            onChange={(e) =>
              onPatch(
                updateOp(ops, op.id, {
                  frequency: Math.max(1, Number(e.target.value) || 1),
                }),
              )
            }
            onBlur={() => onCommit(ops)}
          />
        </label>
        <label className="field">
          <span>Class</span>
          <select
            value={op.faceClass}
            onChange={(e) =>
              onCommit(updateOp(ops, op.id, { faceClass: e.target.value }))
            }
          >
            <option value="1">I (1)</option>
            <option value="2">II (2)</option>
            <option value="1,1">III (1,1)</option>
            <option value="2,1">III (2,1)</option>
          </select>
        </label>
        <label className="field">
          <span>Method</span>
          <select
            value={op.method}
            onChange={(e) =>
              onCommit(
                updateOp(ops, op.id, {
                  method: e.target.value as "s" | "p",
                }),
              )
            }
          >
            <option value="s">sphere</option>
            <option value="p">planar</option>
          </select>
        </label>
        {index === 0 ? (
          <p className="hint">Needs a prior seed in the stack (reads OFF stdin).</p>
        ) : (
          <p className="hint">Pipes previous OFF in as input.</p>
        )}
      </div>
    );
  }

  if (op.kind === "off_color") {
    return (
      <div className="stack-card-body">
        <label className="field">
          <span>Faces (-f)</span>
          <select
            value={op.faces}
            onChange={(e) =>
              onCommit(updateOp(ops, op.id, { faces: e.target.value }))
            }
          >
            {OFF_COLOR_PRESETS.map((p) => (
              <option key={`f-${p.value || "omit"}`} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Edges (-e)</span>
          <select
            value={op.edges}
            onChange={(e) =>
              onCommit(updateOp(ops, op.id, { edges: e.target.value }))
            }
          >
            {OFF_COLOR_PRESETS.map((p) => (
              <option key={`e-${p.value || "omit"}`} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Vertices (-v)</span>
          <select
            value={op.vertices}
            onChange={(e) =>
              onCommit(updateOp(ops, op.id, { vertices: e.target.value }))
            }
          >
            {OFF_COLOR_PRESETS.map((p) => (
              <option key={`v-${p.value || "omit"}`} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">Pipes previous OFF in as input.</p>
      </div>
    );
  }

  return (
    <div className="stack-card-body">
      <label className="field">
        <span>Preset</span>
        <select
          value={OFF_UTIL_PRESETS.some((p) => p.value === op.flags) ? op.flags : ""}
          onChange={(e) => {
            if (!e.target.value) return;
            onCommit(updateOp(ops, op.id, { flags: e.target.value }));
          }}
        >
          {!OFF_UTIL_PRESETS.some((p) => p.value === op.flags) ? (
            <option value="">custom…</option>
          ) : null}
          {OFF_UTIL_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Flags</span>
        <input
          type="text"
          value={op.flags}
          placeholder="e.g. -s  or  -S -O positive"
          onChange={(e) => onPatch(updateOp(ops, op.id, { flags: e.target.value }))}
          onBlur={() => onCommit(ops)}
        />
      </label>
      <p className="hint">Pipes previous OFF in as input.</p>
    </div>
  );
}

export function StackPanel({
  ops,
  onCommit,
  onPatch,
  busy,
  error,
  failedStep,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isExpanded = (id: string) => expanded[id] ?? true;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const addKind = (kind: PipelineKind, detailsEl: HTMLElement | null) => {
    const op = createOp(kind, ops.length === 0);
    onCommit([...ops, op]);
    setExpanded((prev) => ({ ...prev, [op.id]: true }));
    detailsEl?.closest("details")?.removeAttribute("open");
  };

  return (
    <aside className="controls">
      <h1>Antiprism</h1>
      <p className="tagline">modifier stack · Wasm pipeline</p>

      <div className="toolbar">
        <details className="add-op toolbar-add">
          <summary className="add-op-btn">Add operation</summary>
          <div className="add-op-menu" role="menu">
            {PIPELINE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={(e) => addKind(kind, e.currentTarget)}
              >
                {kind}
              </button>
            ))}
          </div>
        </details>
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
        {ops.map((op, index) => {
          const open = isExpanded(op.id) || failedStep === index;
          return (
            <div
              key={op.id}
              className={`stack-card${failedStep === index ? " is-error" : ""}${open ? " is-open" : ""}`}
            >
              <div className="stack-card-head">
                <button
                  type="button"
                  className="stack-card-toggle"
                  aria-expanded={open}
                  aria-label={open ? "Collapse step" : "Expand step"}
                  onClick={() => toggleExpanded(op.id)}
                >
                  {open ? "▾" : "▸"}
                </button>
                <span className="step-index">{index + 1}</span>
                <select
                  className="kind-select"
                  value={op.kind}
                  onChange={(e) => {
                    const kind = e.target.value as PipelineKind;
                    if (kind === op.kind) return;
                    const replacement = createOp(kind, index === 0);
                    onCommit(
                      ops.map((o, i) =>
                        i === index ? { ...replacement, id: o.id } : o,
                      ),
                    );
                    setExpanded((prev) => ({ ...prev, [op.id]: true }));
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PIPELINE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <ToolInfoButton kind={op.kind} />
                {!open ? (
                  <button
                    type="button"
                    className="stack-card-summary"
                    onClick={() => toggleExpanded(op.id)}
                    title={opSummary(op)}
                  >
                    {opSummary(op)}
                  </button>
                ) : null}
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

              {open ? (
                <OpFields
                  op={op}
                  index={index}
                  ops={ops}
                  onCommit={onCommit}
                  onPatch={onPatch}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
