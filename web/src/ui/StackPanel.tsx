import { useRef, useState } from "react";
import { readOffFile } from "../io/loadOff";
import { saveTextFile } from "../io/saveTextFile";
import {
  isFieldVisible,
  TOOL_PARAM_SCHEMAS,
  type ParamField,
  type ParamValue,
} from "../pipeline/toolParams";
import {
  CONWAY_OP_CHOICES,
  CONWAY_OP_CHOICE_BY_ID,
  CONWAY_SEEDS,
  conwayNotationFromSteps,
  newConwayOpStep,
  type ConwayOpStep,
} from "../pipeline/conwayInfo";
import {
  CONWAY_PARAMETRIC_SEEDS,
  CONWAY_SEED_FAMILIES,
  conwaySeedToken,
  categoryIdForKind,
  createOp,
  flagsOpSummary,
  isFlagsTool,
  isTextTool,
  OFF_COLOR_PRESETS,
  opToCommandLine,
  POLYGON_TYPES,
  SAVE_AS_OPTIONS,
  textToolDownloadName,
  type ConwayOp,
  type ConwaySeedFamily,
  type ConwaySeedOp,
  type FlagsOp,
  type ImportFileFormat,
  type ImportFileOp,
  type PipelineKind,
  type PipelineOp,
  type SaveAsFormatId,
} from "../pipeline/types";
import { APP_VERSION } from "../version";
import { AddOpButton } from "./AddOpButton";
import { CategoryIcon } from "./CategoryIcon";
import { MenuSelect } from "./MenuSelect";
import { ModeSwitch, type Mode } from "./ModeSwitch";
import { ToolInfoButton } from "./ToolInfoButton";
import { useDismissDetails } from "./useDismissDetails";

const POLYGON_TYPE_OPTIONS = POLYGON_TYPES.map((t) => ({ value: t, label: t }));

const CONWAY_SEED_FAMILY_OPTIONS = CONWAY_SEED_FAMILIES.map((family) => {
  const info = CONWAY_SEEDS.find(
    (s) => s.symbol === family || s.symbol === `${family}n`,
  );
  return {
    value: family,
    label: info ? `${family} — ${info.name}` : family,
  };
});

const CONWAY_OP_OPTIONS = CONWAY_OP_CHOICES.map((c) => ({
  value: c.id,
  label: `${c.letter} — ${c.name}`,
}));

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

type Props = {
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
  busy: boolean;
  error: string | null;
  failedStep: number | null;
  stepText: Record<string, string>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canSave: boolean;
  onSaveAs: (format: SaveAsFormatId) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  editingName: string | null;
  onSaveToLibrary: () => void;
};

/** Drop redundant "Step N (kind):" prefix when the message sits under that card. */
function formatStepError(error: string, kind: string, index: number): string {
  const prefix = `Step ${index + 1} (${kind}): `;
  return error.startsWith(prefix) ? error.slice(prefix.length) : error;
}

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
    case "import_file":
      return op.fileName
        ? `${op.format.toUpperCase()} · ${op.fileName}`
        : "(no file)";
    case "conway_seed":
      return conwaySeedToken(op);
    case "conway":
      return conwayNotationFromSteps(op.steps) || "…";
    case "geodesic":
      return `f=${op.frequency} ${op.faceClass} ${op.method}`;
    case "off_color":
      return [op.faces && `f:${op.faces}`, op.edges && `e:${op.edges}`, op.vertices && `v:${op.vertices}`]
        .filter(Boolean)
        .join(" ") || "…";
    default:
      return flagsOpSummary(op);
  }
}

function setParam(
  ops: PipelineOp[],
  op: FlagsOp,
  key: string,
  value: ParamValue,
): PipelineOp[] {
  return updateOp(ops, op.id, {
    params: { ...op.params, [key]: value },
  });
}

function FlagsParamFields({
  op,
  ops,
  onCommit,
  onPatch,
}: {
  op: FlagsOp;
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
}) {
  const schema = TOOL_PARAM_SCHEMAS[op.kind];

  const renderField = (field: ParamField) => {
    const value = op.params[field.key] ?? field.default;

    if (field.type === "bool") {
      return (
        <label key={field.key} className="field field-check">
          <span>{field.label}</span>
          <input
            type="checkbox"
            checked={value === true}
            aria-label={field.label}
            onChange={(e) =>
              onCommit(setParam(ops, op, field.key, e.target.checked))
            }
          />
        </label>
      );
    }

    if (field.type === "number") {
      const n = typeof value === "number" ? value : Number(value);
      return (
        <label key={field.key} className="field">
          <span>{field.label}</span>
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={Number.isFinite(n) ? n : field.default}
            aria-label={field.label}
            onChange={(e) => {
              const next = Number(e.target.value);
              onPatch(
                setParam(
                  ops,
                  op,
                  field.key,
                  Number.isFinite(next) ? next : field.default,
                ),
              );
            }}
            onBlur={() => onCommit(ops)}
          />
          {field.hint ? <p className="hint">{field.hint}</p> : null}
        </label>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.key} className="field">
          <span>{field.label}</span>
          <MenuSelect
            aria-label={field.label}
            value={String(value ?? "")}
            options={field.options}
            onChange={(v) => onCommit(setParam(ops, op, field.key, v))}
          />
          {field.hint ? <p className="hint">{field.hint}</p> : null}
        </label>
      );
    }

    return (
      <label key={field.key} className="field">
        <span>{field.label}</span>
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={field.placeholder}
          aria-label={field.label}
          onChange={(e) =>
            onPatch(setParam(ops, op, field.key, e.target.value))
          }
          onBlur={() => onCommit(ops)}
        />
        {field.hint ? <p className="hint">{field.hint}</p> : null}
      </label>
    );
  };

  return (
    <div className="stack-card-body">
      {schema.fields
        .filter((field) => isFieldVisible(field, op.params))
        .map(renderField)}
      <p className="hint">Pipes previous OFF in as input.</p>
    </div>
  );
}

const IMPORT_FILE_OPTIONS: {
  format: ImportFileFormat;
  label: string;
  accept: string;
}[] = [
  { format: "off", label: "OFF file", accept: ".off,text/plain" },
  { format: "obj", label: "OBJ file", accept: ".obj,text/plain" },
];

function ImportFileFields({
  op,
  ops,
  onCommit,
  onPatch,
}: {
  op: ImportFileOp;
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFormat = useRef<ImportFileFormat>("off");
  const [loadError, setLoadError] = useState<string | null>(null);

  const openPicker = (format: ImportFileFormat) => {
    pendingFormat.current = format;
    const input = inputRef.current;
    if (!input) return;
    const opt = IMPORT_FILE_OPTIONS.find((o) => o.format === format);
    input.accept = opt?.accept ?? "";
    input.click();
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const format = pendingFormat.current;
    try {
      if (format === "off") {
        const loaded = await readOffFile(file);
        setLoadError(null);
        onCommit(
          updateOp(ops, op.id, {
            format: "off",
            fileName: loaded.name,
            fileText: loaded.text,
          }),
        );
        return;
      }

      const text = await file.text();
      if (!text.trim()) {
        throw new Error(`“${file.name}” is empty`);
      }
      setLoadError(null);
      onCommit(
        updateOp(ops, op.id, {
          format: "obj",
          fileName: file.name || "model.obj",
          fileText: text,
        }),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="stack-card-body">
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onPick(file);
        }}
      />
      <div className="field-row">
        <details className="add-op import-load">
          <summary className="add-op-btn import-pick-btn">Load file</summary>
          <div className="add-op-menu" role="menu" aria-label="File format">
            {IMPORT_FILE_OPTIONS.map((opt) => (
              <button
                key={opt.format}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.currentTarget.closest("details")?.removeAttribute("open");
                  openPicker(opt.format);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </details>
        {op.fileName ? (
          <button
            type="button"
            className="import-clear-btn"
            aria-label="Clear file"
            onClick={() =>
              onCommit(
                updateOp(ops, op.id, {
                  fileName: "",
                  fileText: "",
                }),
              )
            }
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="import-file-name" title={op.fileName || undefined}>
        {op.fileName
          ? `${op.format.toUpperCase()} · ${op.fileName} · ${(op.fileText.length / 1024).toFixed(1)} KB`
          : "No file loaded"}
      </p>
      {op.format === "obj" && op.fileName ? (
        <label className="field">
          <span>Digits (-d)</span>
          <input
            type="number"
            min={-16}
            max={16}
            value={op.digits}
            onChange={(e) =>
              onPatch(
                updateOp(ops, op.id, {
                  digits: Number(e.target.value) || 8,
                }),
              )
            }
            onBlur={() => onCommit(ops)}
          />
        </label>
      ) : null}
      {loadError ? <p className="error">{loadError}</p> : null}
      <p className="hint">
        Seed step: loads OFF directly, or converts OBJ via <code>obj2off</code>.
      </p>
    </div>
  );
}

function ConwayOpsFields({
  op,
  ops,
  onCommit,
  onPatch,
}: {
  op: ConwayOp;
  ops: PipelineOp[];
  onCommit: (ops: PipelineOp[]) => void;
  onPatch: (ops: PipelineOp[]) => void;
}) {
  const setSteps = (steps: ConwayOpStep[], commit: boolean) => {
    const next = updateOp(ops, op.id, { steps });
    if (commit) onCommit(next);
    else onPatch(next);
  };

  const patchStep = (stepId: string, patch: Partial<ConwayOpStep>, commit: boolean) => {
    setSteps(
      op.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
      commit,
    );
  };

  const changeOp = (stepId: string, opId: string) => {
    const fresh = newConwayOpStep(opId);
    setSteps(
      op.steps.map((s) =>
        s.id === stepId ? { ...fresh, id: s.id } : s,
      ),
      true,
    );
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= op.steps.length) return;
    const steps = op.steps.slice();
    [steps[index], steps[j]] = [steps[j], steps[index]];
    setSteps(steps, true);
  };

  const notation = conwayNotationFromSteps(op.steps);

  return (
    <div className="stack-card-body">
      <div className="conway-ops-stack">
        {op.steps.map((step, i) => {
          const choice = CONWAY_OP_CHOICE_BY_ID[step.op];
          const needsN =
            choice &&
            (choice.param === "suffix" ||
              choice.param === "usuffix" ||
              choice.param === "n_m");
          const needsM = choice?.param === "n_m";
          const optionalN =
            choice &&
            (choice.param === "suffix" || choice.param === "usuffix") &&
            choice.defaultN == null;

          return (
            <div key={step.id} className="conway-op-row">
              <label className="field field-grow">
                <MenuSelect
                  aria-label={`Conway operator ${i + 1}`}
                  value={step.op}
                  options={CONWAY_OP_OPTIONS}
                  onChange={(v) => changeOp(step.id, v)}
                />
              </label>
              {needsN ? (
                <label className="field conway-op-param">
                  <span>{needsM ? "n" : optionalN ? "n (opt)" : "n"}</span>
                  <input
                    type="number"
                    min={choice.minN ?? 0}
                    max={48}
                    value={step.n ?? ""}
                    placeholder={optionalN ? "all" : undefined}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        patchStep(step.id, { n: undefined }, false);
                        return;
                      }
                      const n = Number(raw);
                      patchStep(
                        step.id,
                        { n: Number.isFinite(n) ? n : choice.defaultN },
                        false,
                      );
                    }}
                    onBlur={() => onCommit(ops)}
                  />
                </label>
              ) : null}
              {needsM ? (
                <label className="field conway-op-param">
                  <span>m</span>
                  <input
                    type="number"
                    min={0}
                    max={48}
                    value={step.m ?? 0}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      patchStep(
                        step.id,
                        { m: Number.isFinite(m) ? m : 0 },
                        false,
                      );
                    }}
                    onBlur={() => onCommit(ops)}
                  />
                </label>
              ) : null}
              <div className="conway-op-row-actions">
                <button
                  type="button"
                  aria-label="Move operator up"
                  disabled={i === 0}
                  onClick={() => moveStep(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move operator down"
                  disabled={i === op.steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove operator"
                  disabled={op.steps.length <= 1}
                  onClick={() =>
                    setSteps(
                      op.steps.filter((s) => s.id !== step.id),
                      true,
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="conway-op-add"
        onClick={() => setSteps([...op.steps, newConwayOpStep("a")], true)}
      >
        Add operator
      </button>
      <p className="hint">
        Applied top → bottom
        {notation ? (
          <>
            {" "}
            (<code>conway -r {notation}</code>)
          </>
        ) : null}
        . Pipes previous OFF in.
      </p>
    </div>
  );
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

  if (op.kind === "import_file") {
    return (
      <ImportFileFields
        op={op}
        ops={ops}
        onCommit={onCommit}
        onPatch={onPatch}
      />
    );
  }

  if (op.kind === "conway_seed") {
    const seedOp = op as ConwaySeedOp;
    const parametric = CONWAY_PARAMETRIC_SEEDS.has(seedOp.family);
    return (
      <div className="stack-card-body">
        <label className="field">
          <span>Seed</span>
          <MenuSelect
            aria-label="Conway seed"
            value={seedOp.family}
            options={CONWAY_SEED_FAMILY_OPTIONS}
            onChange={(family) =>
              onCommit(
                updateOp(ops, op.id, {
                  family: family as ConwaySeedFamily,
                }),
              )
            }
          />
        </label>
        {parametric ? (
          <label className="field">
            <span>Sides (n)</span>
            <input
              type="number"
              min={3}
              max={48}
              value={seedOp.numSides}
              onChange={(e) =>
                onPatch(
                  updateOp(ops, op.id, {
                    numSides: Math.max(3, Number(e.target.value) || 3),
                  }),
                )
              }
              onBlur={() => onCommit(ops)}
            />
          </label>
        ) : null}
        <p className="hint">
          Seed only — equivalent to <code>conway {conwaySeedToken(seedOp)}</code>
        </p>
      </div>
    );
  }

  if (op.kind === "conway") {
    return (
      <ConwayOpsFields
        op={op}
        ops={ops}
        onCommit={onCommit}
        onPatch={onPatch}
      />
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
    return (
      <FlagsParamFields
        op={op}
        ops={ops}
        onCommit={onCommit}
        onPatch={onPatch}
      />
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
  stepText,
  canSave,
  onSaveAs,
  mode,
  onModeChange,
  editingName,
  onSaveToLibrary,
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

  const addKind = (kind: PipelineKind, insertAt: number) => {
    const op = createOp(kind, ops.length === 0);
    const next = [...ops.slice(0, insertAt), op, ...ops.slice(insertAt)];
    onCommit(next);
    setExpanded((prev) => ({ ...prev, [op.id]: true }));
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
      <ModeSwitch mode={mode} onChange={onModeChange} />
      {editingName ? <p className="hint">Library entry: {editingName}</p> : null}

      <div className="stack">
        <div className="stack-heading">Operations</div>
        {ops.length === 0 ? (
          <p className="stack-empty">Add a seed to begin.</p>
        ) : null}
        {ops.map((op, index) => {
          const open = isExpanded(op.id) || failedStep === index;
          const outText = stepText[op.id];
          const textKind = isTextTool(op.kind) ? op.kind : null;
          return (
            <div key={op.id} className="stack-item">
              {index > 0 ? (
                <AddOpButton
                  variant="between"
                  onPick={(kind) => addKind(kind, index)}
                />
              ) : null}
              <div
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
                    title={
                      op.enabled
                        ? "On — included in pipeline"
                        : "Off — skipped"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={op.enabled}
                      aria-label={op.enabled ? "Disable step" : "Enable step"}
                      onChange={() =>
                        onCommit(
                          updateOp(ops, op.id, { enabled: !op.enabled }),
                        )
                      }
                    />
                  </label>
                  <CategoryIcon
                    category={categoryIdForKind(op.kind)}
                    className="op-kind-icon"
                  />
                  <span className="op-kind-name">{op.kind}</span>
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
                      onClick={() =>
                        onCommit(ops.filter((o) => o.id !== op.id))
                      }
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

                {failedStep === index && error ? (
                  <p className="op-error" role="alert">
                    {formatStepError(error, op.kind, index)}
                  </p>
                ) : null}

                {outText && textKind ? (
                  <div className="op-text-out">
                    <div className="op-text-out-head">
                      <span className="op-text-out-label">Output</span>
                      <button
                        type="button"
                        className="op-text-out-save"
                        onClick={() =>
                          void saveTextFile(
                            outText,
                            textToolDownloadName(textKind),
                          )
                        }
                      >
                        Download
                      </button>
                    </div>
                    <pre className="op-text-out-body">{outText}</pre>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <AddOpButton
          variant="end"
          onPick={(kind) => addKind(kind, ops.length)}
        />
      </div>

      <div className="toolbar save-toolbar">
        <details
          className={`add-op save-as${canSave && !busy ? "" : " is-disabled"}`}
          onToggle={(e) => {
            if ((!canSave || busy) && e.currentTarget.open) {
              e.currentTarget.open = false;
            }
          }}
        >
          <summary
            className="add-op-btn"
            title="Export pipeline result"
            aria-disabled={!canSave || busy}
          >
            Export
          </summary>
          <div className="add-op-menu" role="menu" aria-label="Export format">
            {SAVE_AS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  const host = e.currentTarget.closest("details");
                  host?.removeAttribute("open");
                  onSaveAs(opt.id);
                }}
              >
                <span className="save-as-label">{opt.label}</span>
                <span className="save-as-ext">
                  .{opt.fileName.split(".").pop()}
                </span>
              </button>
            ))}
          </div>
        </details>
        <button
          type="button"
          className="tool-btn"
          disabled={!canSave || busy}
          title="Save the current polyhedron into the library"
          onClick={onSaveToLibrary}
        >
          To library
        </button>
        {/* Undo/Redo buttons hidden for now; stack history still wired in App */}
        <span className={`busy-hint${busy ? " is-on" : ""}`} aria-live="polite">
          Running…
        </span>
      </div>

      {error && failedStep == null ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
