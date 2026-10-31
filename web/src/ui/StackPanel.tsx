import { useState } from "react";
import {
  createOp,
  FLAG_PRESETS,
  isFlagsTool,
  OFF_COLOR_PRESETS,
  opToCommandLine,
  PIPELINE_KINDS,
  POLYGON_TYPES,
  type FlagsToolKind,
  type PipelineKind,
  type PipelineOp,
} from "../pipeline/types";
import { APP_VERSION } from "../version";
import { MenuSelect } from "./MenuSelect";
import { ToolInfoButton } from "./ToolInfoButton";
import { useDismissDetails } from "./useDismissDetails";

const POLYGON_TYPE_OPTIONS = POLYGON_TYPES.map((t) => ({ value: t, label: t }));

const GEODESIC_CLASS_OPTIONS = [
  { value: "1", label: "I (1)" },
  { value: "2", label: "II (2)" },
  { value: "1,1", label: "III (1,1)" },
  { value: "2,1", label: "III (2,1)" },
] as const;

const GEODESIC_METHOD_OPTIONS = [
  { value: "s", label: "sphere" },
  { value: "p", label: "planar" },
] as const;

const PIPELINE_KIND_OPTIONS = PIPELINE_KINDS.map((k) => ({
  value: k,
  label: k,
}));

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
  canSave: boolean;
  onSaveOff: () => void;
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
    default:
      return op.flags || "(default)";
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
          <MenuSelect
            aria-label="Polygon type"
            value={op.polygonType}
            options={POLYGON_TYPE_OPTIONS}
            onChange={(polygonType) =>
              onCommit(
                updateOp(ops, op.id, {
                  polygonType: polygonType as (typeof POLYGON_TYPES)[number],
                }),
              )
            }
          />
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
          <MenuSelect
            aria-label="Geodesic class"
            value={op.faceClass}
            options={GEODESIC_CLASS_OPTIONS}
            onChange={(faceClass) =>
              onCommit(updateOp(ops, op.id, { faceClass }))
            }
          />
        </label>
        <label className="field">
          <span>Method</span>
          <MenuSelect
            aria-label="Geodesic method"
            value={op.method}
            options={GEODESIC_METHOD_OPTIONS}
            onChange={(method) =>
              onCommit(
                updateOp(ops, op.id, {
                  method: method as "s" | "p",
                }),
              )
            }
          />
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
          <MenuSelect
            aria-label="Face colouring"
            value={op.faces}
            options={OFF_COLOR_PRESETS}
            onChange={(faces) => onCommit(updateOp(ops, op.id, { faces }))}
          />
        </label>
        <label className="field">
          <span>Edges (-e)</span>
          <MenuSelect
            aria-label="Edge colouring"
            value={op.edges}
            options={OFF_COLOR_PRESETS}
            onChange={(edges) => onCommit(updateOp(ops, op.id, { edges }))}
          />
        </label>
        <label className="field">
          <span>Vertices (-v)</span>
          <MenuSelect
            aria-label="Vertex colouring"
            value={op.vertices}
            options={OFF_COLOR_PRESETS}
            onChange={(vertices) =>
              onCommit(updateOp(ops, op.id, { vertices }))
            }
          />
        </label>
        <p className="hint">Pipes previous OFF in as input.</p>
      </div>
    );
  }

  if (isFlagsTool(op.kind)) {
    const kind = op.kind as FlagsToolKind;
    const presets = FLAG_PRESETS[kind];
    const matched = presets.some((p) => p.value === op.flags);
    return (
      <div className="stack-card-body">
        <label className="field">
          <span>Preset</span>
          <MenuSelect
            aria-label={`${kind} preset`}
            value={op.flags}
            options={presets}
            fallbackLabel={matched ? "custom…" : `custom… (${op.flags || "empty"})`}
            onChange={(flags) => onCommit(updateOp(ops, op.id, { flags }))}
          />
        </label>
        <label className="field">
          <span>Flags</span>
          <input
            type="text"
            value={op.flags}
            placeholder="CLI flags (space-separated)"
            onChange={(e) =>
              onPatch(updateOp(ops, op.id, { flags: e.target.value }))
            }
            onBlur={() => onCommit(ops)}
          />
        </label>
        <p className="hint">Pipes previous OFF in as input.</p>
      </div>
    );
  }

  return null;
}

export function StackPanel({
  ops,
  onCommit,
  onPatch,
  busy,
  error,
  failedStep,
  canSave,
  onSaveOff,
}: Props) {
  useDismissDetails();
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
      <div className="brand">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          width={36}
          height={36}
          alt=""
        />
        <div className="brand-text">
          <h1>Antiprism GUI</h1>
          <p className="brand-version">v{APP_VERSION}</p>
        </div>
      </div>

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
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={onSaveOff}
          title="Save pipeline result as OFF"
        >
          Save as OFF
        </button>
        {/* Undo/Redo buttons hidden for now; stack history still wired in App */}
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
              className={`stack-card${failedStep === index ? " is-error" : ""}${open ? " is-open" : ""}${op.enabled ? "" : " is-off"}`}
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
                <label
                  className={`op-enable${op.enabled ? "" : " is-off"}`}
                  title={op.enabled ? "On — included in pipeline" : "Off — skipped"}
                >
                  <input
                    type="checkbox"
                    checked={op.enabled}
                    aria-label={op.enabled ? "Disable step" : "Enable step"}
                    onChange={() =>
                      onCommit(updateOp(ops, op.id, { enabled: !op.enabled }))
                    }
                  />
                </label>
                <div
                  className="kind-select-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuSelect
                    className="kind-select"
                    aria-label="Operation kind"
                    value={op.kind}
                    options={PIPELINE_KIND_OPTIONS}
                    onChange={(kind) => {
                      const k = kind as PipelineKind;
                      if (k === op.kind) return;
                      const replacement = createOp(k, index === 0);
                      onCommit(
                        ops.map((o, i) =>
                          i === index
                            ? { ...replacement, id: o.id, enabled: o.enabled }
                            : o,
                        ),
                      );
                      setExpanded((prev) => ({ ...prev, [op.id]: true }));
                    }}
                  />
                </div>
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
                <>
                  <OpFields
                    op={op}
                    index={index}
                    ops={ops}
                    onCommit={onCommit}
                    onPatch={onPatch}
                  />
                  <p className="op-cmdline" title="Equivalent command line">
                    <code>{opToCommandLine(op)}</code>
                  </p>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
