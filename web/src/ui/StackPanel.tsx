import { useRef, useState } from "react";
import { readOffFile } from "../io/loadOff";
import type { LibraryInputFile } from "../library/types";
import { saveTextFile } from "../io/saveTextFile";
import {
  applyViewList,
  commandGeneratesGeometry,
  commandTool,
  conwaySeedOf,
  readStartingFile,
  stepFromKind,
  viewFromCommand,
  type CommandStep,
} from "../pipeline/commandStep";
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
  newConwayOpStep,
  type ConwayOpStep,
} from "../pipeline/conwayInfo";
import {
  CONWAY_PARAMETRIC_SEEDS,
  CONWAY_SEED_FAMILIES,
  conwaySeedToken,
  categoryIdForKind,
  isFlagsTool,
  isTextTool,
  OFF_COLOR_PRESETS,
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
import { AboutButton } from "./AboutButton";
import { AddOpButton } from "./AddOpButton";
import { CategoryIcon } from "./CategoryIcon";
import { MenuSelect } from "./MenuSelect";
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
  steps: CommandStep[];
  inputFile: LibraryInputFile | null;
  onInputFile: (file: LibraryInputFile | null) => void;
  onCommit: (steps: CommandStep[]) => void;
  onPatch: (steps: CommandStep[]) => void;
  busy: boolean;
  error: string | null;
  failedStep: number | null;
  stepText: Record<string, string>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canSave: boolean;
  onExport: (format: SaveAsFormatId) => void;
  editingName: string | null;
  dirty: boolean;
  onRename: (name: string) => Promise<void>;
  onSave: () => void;
  onSaveAsNew: () => void;
  onExit: () => void;
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

function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (j < 0 || j >= items.length) return items;
  const next = items.slice();
  const current = next[index];
  const other = next[j];
  if (current === undefined || other === undefined) return items;
  next[index] = other;
  next[j] = current;
  return next;
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
    const present = Object.prototype.hasOwnProperty.call(op.params, field.key);
    const value = present ? op.params[field.key] : undefined;

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
            value={present && Number.isFinite(n) ? n : ""}
            aria-label={field.label}
            onChange={(e) => {
              const text = e.target.value;
              if (text === "") {
                const params = { ...op.params };
                delete params[field.key];
                onPatch(updateOp(ops, op.id, { params }));
                return;
              }
              const next = Number(text);
              if (!Number.isFinite(next)) return;
              onPatch(setParam(ops, op, field.key, next));
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
            value={present ? String(value ?? "") : ""}
            fallbackLabel="not set"
            options={field.options}
            onChange={(v) => {
              if (v === "") {
                const params = { ...op.params };
                delete params[field.key];
                onCommit(updateOp(ops, op.id, { params }));
                return;
              }
              onCommit(setParam(ops, op, field.key, v));
            }}
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
          value={present ? String(value ?? "") : ""}
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
      <p className="hint">Applied top → bottom. Pipes previous OFF in.</p>
    </div>
  );
}

function ConwaySeedControls({
  family,
  numSides,
  onFamily,
  onSides,
  onCommitSides,
}: {
  family: ConwaySeedFamily;
  numSides: number;
  onFamily: (family: ConwaySeedFamily) => void;
  onSides: (numSides: number) => void;
  onCommitSides: () => void;
}) {
  const parametric = CONWAY_PARAMETRIC_SEEDS.has(family);
  return (
    <div className="stack-card-body">
      <label className="field">
        <span>Seed</span>
        <MenuSelect
          aria-label="Conway seed"
          value={family}
          options={CONWAY_SEED_FAMILY_OPTIONS}
          onChange={(next) => onFamily(next as ConwaySeedFamily)}
        />
      </label>
      {parametric ? (
        <label className="field">
          <span>Sides (n)</span>
          <input
            type="number"
            min={3}
            max={48}
            value={numSides}
            onChange={(e) => onSides(Math.max(3, Number(e.target.value) || 3))}
            onBlur={onCommitSides}
          />
        </label>
      ) : null}
    </div>
  );
}

function CommandField({
  command,
  onCommit,
}: {
  command: string;
  onCommit: (command: string) => void;
}) {
  const [draft, setDraft] = useState(command);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef(command);
  const cancelRef = useRef(false);
  return (
    <input
      className="op-command"
      aria-label="Command"
      spellCheck={false}
      value={focused ? draft : command}
      onFocus={() => {
        cancelRef.current = false;
        draftRef.current = command;
        setDraft(command);
        setFocused(true);
      }}
      onChange={(event) => {
        draftRef.current = event.target.value;
        setDraft(event.target.value);
      }}
      onBlur={() => {
        const cancelled = cancelRef.current;
        cancelRef.current = false;
        setFocused(false);
        if (!cancelled && draftRef.current !== command) onCommit(draftRef.current);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancelRef.current = true;
          draftRef.current = command;
          setDraft(command);
          event.currentTarget.blur();
        }
      }}
    />
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
            value={Number.isFinite(op.numSides) ? op.numSides : ""}
            onChange={(e) => {
              const text = e.target.value;
              onPatch(
                updateOp(ops, op.id, {
                  numSides: text === "" ? Number.NaN : Number(text),
                }),
              );
            }}
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
    const seed = conwaySeedOf(op);
    return (
      <>
        {seed ? (
          <ConwaySeedControls
            family={seed.family}
            numSides={seed.numSides}
            onFamily={(family) =>
              onCommit(
                ops.map((item) =>
                  item.id === op.id ? { ...item, conwaySeed: family } : item,
                ),
              )
            }
            onSides={(numSides) =>
              onPatch(
                ops.map((item) =>
                  item.id === op.id ? { ...item, conwaySeedN: numSides } : item,
                ),
              )
            }
            onCommitSides={() => onCommit(ops)}
          />
        ) : null}
        <ConwayOpsFields
          op={op}
          ops={ops}
          onCommit={onCommit}
          onPatch={onPatch}
        />
      </>
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
            value={Number.isFinite(op.frequency) ? op.frequency : ""}
            onChange={(e) => {
              const text = e.target.value;
              onPatch(
                updateOp(ops, op.id, {
                  frequency: text === "" ? Number.NaN : Number(text),
                }),
              );
            }}
            onBlur={() => onCommit(ops)}
          />
        </label>
        <label className="field">
          <span>Class</span>
          <MenuSelect
            aria-label="Geodesic class"
            value={op.faceClass}
            fallbackLabel="not set"
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
            fallbackLabel="not set"
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

function EditorTitle({
  name,
  dirty,
  onRename,
  onExit,
}: {
  name: string | null;
  dirty: boolean;
  onRename: (name: string) => Promise<void>;
  onExit: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const lockRef = useRef(false);
  const shown = name ?? "New polyhedron";

  const finish = (value: string) => {
    if (lockRef.current || cancelRef.current) return;
    const next = value.trim();
    if (!next || next === shown) {
      setDraft(null);
      setRenameError(null);
      return;
    }
    lockRef.current = true;
    void onRename(next)
      .then(() => {
        setDraft(null);
        setRenameError(null);
      })
      .catch((reason: unknown) => {
        setRenameError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        lockRef.current = false;
      });
  };

  return (
    <div className="editor-heading">
      <div className="editor-titlebar">
        <h2 className="editor-title">
          {draft !== null ? (
            <input
              className="editor-title-input"
              autoFocus
              aria-label="Polyhedron name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finish(draft);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRef.current = true;
                  setDraft(null);
                  setRenameError(null);
                }
              }}
              onBlur={() => {
                if (cancelRef.current) {
                  cancelRef.current = false;
                  return;
                }
                finish(draft);
              }}
            />
          ) : (
            <span
              className="editor-title-name"
              title="Double-click to rename"
              onDoubleClick={() => {
                cancelRef.current = false;
                setRenameError(null);
                setDraft(shown);
              }}
            >
              {shown}
            </span>
          )}
          {dirty ? (
            <span className="editor-dirty" title="Unsaved changes">
              *
            </span>
          ) : null}
        </h2>
        <button type="button" className="editor-back" onClick={onExit}>
          Back to Library
        </button>
      </div>
      {renameError ? (
        <p className="error" role="alert">
          {renameError}
        </p>
      ) : null}
    </div>
  );
}

function SeedFileBar({
  file,
  used,
  inputRef,
  onChange,
}: {
  file: LibraryInputFile | null;
  used: boolean;
  inputRef: { current: HTMLInputElement | null };
  onChange: (file: LibraryInputFile | null) => void;
}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  return (
    <div className="seed-file">
      <div className="seed-file-row">
        <span className="seed-file-label">Starting polyhedron</span>
        <button type="button" className="tool-btn" onClick={() => inputRef.current?.click()}>
          {file ? "Replace" : "Load"}
        </button>
        {file ? (
          <button type="button" className="tool-btn" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".off,.obj,text/plain"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (!picked) return;
          void readStartingFile(picked)
            .then((next) => {
              setLoadError(null);
              onChange(next);
            })
            .catch((reason: unknown) => {
              setLoadError(reason instanceof Error ? reason.message : String(reason));
            });
        }}
      />
      {file ? <p className="seed-file-name">{file.fileName}</p> : null}
      <p className="hint">
        {file && !used
          ? "Stored, but not fed in — the first command generates the geometry."
          : "OFF or OBJ. Used when the first command reads a polyhedron."}
      </p>
      {loadError ? (
        <p className="error" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  );
}

export function StackPanel({
  steps,
  inputFile,
  onInputFile,
  onCommit,
  onPatch,
  busy,
  error,
  failedStep,
  stepText,
  canSave,
  onExport,
  editingName,
  dirty,
  onRename,
  onSave,
  onSaveAsNew,
  onExit,
}: Props) {
  useDismissDetails();
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const views = steps.map(
    (step) =>
      viewFromCommand(step) ?? {
        id: step.id,
        kind: "off_util" as const,
        enabled: step.enabled,
        params: {},
      },
  );
  const first = steps.find((step) => step.enabled && step.command.trim());
  const fileUsed = !first || !commandGeneratesGeometry(first.command);

  const isExpanded = (id: string) => expanded[id] ?? true;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const commitViews = (next: PipelineOp[]) => onCommit(applyViewList(steps, next));
  const patchViews = (next: PipelineOp[]) => onPatch(applyViewList(steps, next));

  const addKind = (kind: PipelineKind, insertAt: number) => {
    if (kind === "import_file") {
      fileRef.current?.click();
      return;
    }
    const step = stepFromKind(kind);
    const next = [...steps.slice(0, insertAt), step, ...steps.slice(insertAt)];
    onCommit(next);
    setExpanded((prev) => ({ ...prev, [step.id]: true }));
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
          <div className="brand-title-row">
            <h1>Antiprism App</h1>
            <AboutButton />
          </div>
          <p className="brand-version">v{APP_VERSION}</p>
        </div>
      </div>
      <EditorTitle
        name={editingName}
        dirty={dirty}
        onRename={onRename}
        onExit={onExit}
      />

      <div className="stack">
        <div className="stack-heading">
          <span>Operations</span>
          {busy ? (
            <span className="busy-spinner" role="status" aria-label="Running" />
          ) : null}
        </div>
        <SeedFileBar
          file={inputFile}
          used={fileUsed}
          inputRef={fileRef}
          onChange={onInputFile}
        />
        {steps.length === 0 ? (
          <p className="stack-empty">Add an operation, or load a starting polyhedron.</p>
        ) : null}
        {steps.map((step, index) => {
          const open = isExpanded(step.id) || failedStep === index;
          const outText = stepText[step.id];
          const parsed = viewFromCommand(step);
          const tool = commandTool(step.command);
          const kindLabel = parsed?.kind ?? (tool || "command");
          const textKind = isTextTool(tool) ? tool : null;
          return (
            <div key={step.id} className="stack-item">
              {index > 0 ? (
                <AddOpButton
                  variant="between"
                  onPick={(kind) => addKind(kind, index)}
                />
              ) : null}
              <div
                className={`stack-card${failedStep === index ? " is-error" : ""}${open ? " is-open" : ""}${step.enabled ? "" : " is-off"}`}
              >
                <div className="stack-card-head">
                  <button
                    type="button"
                    className="stack-card-toggle"
                    aria-expanded={open}
                    aria-label={open ? "Collapse step" : "Expand step"}
                    onClick={() => toggleExpanded(step.id)}
                  >
                    {open ? "▾" : "▸"}
                  </button>
                  <label
                    className={`op-enable${step.enabled ? "" : " is-off"}`}
                    title={
                      step.enabled
                        ? "On — included in pipeline"
                        : "Off — skipped"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      aria-label={step.enabled ? "Disable step" : "Enable step"}
                      onChange={() =>
                        onCommit(
                          steps.map((item) =>
                            item.id === step.id ? { ...item, enabled: !item.enabled } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <CategoryIcon
                    category={parsed ? categoryIdForKind(parsed.kind) : "utility"}
                    className="op-kind-icon"
                  />
                  <span className="op-kind-name">{kindLabel}</span>
                  {parsed ? <ToolInfoButton kind={parsed.kind} /> : null}
                  {!open ? (
                    <button
                      type="button"
                      className="stack-card-summary"
                      onClick={() => toggleExpanded(step.id)}
                      title={step.command}
                    >
                      {step.command}
                    </button>
                  ) : null}
                  <div className="stack-card-actions">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => onCommit(moveItem(steps, index, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === steps.length - 1}
                      onClick={() => onCommit(moveItem(steps, index, 1))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label="Remove step"
                      onClick={() => onCommit(steps.filter((item) => item.id !== step.id))}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="stack-card-body">
                    <CommandField
                      command={step.command}
                      onCommit={(command) =>
                        onCommit(
                          steps.map((item) =>
                            item.id === step.id ? { ...item, command } : item,
                          ),
                        )
                      }
                    />
                    {parsed ? (
                      <OpFields
                        op={parsed}
                        index={index}
                        ops={views}
                        onCommit={commitViews}
                        onPatch={patchViews}
                      />
                    ) : (
                      <p className="hint">This command has no form fields. Edit the line above.</p>
                    )}
                  </div>
                ) : null}

                {failedStep === index && error ? (
                  <p className="op-error" role="alert">
                    {formatStepError(error, kindLabel, index)}
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
          onPick={(kind) => addKind(kind, steps.length)}
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
                  onExport(opt.id);
                }}
              >
                <span className="save-as-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </details>
        <button
          type="button"
          className="tool-btn"
          title="Save (Ctrl+S)"
          onClick={onSave}
        >
          Save
        </button>
        <button
          type="button"
          className="tool-btn"
          title="Save a new polyhedron in the library"
          onClick={onSaveAsNew}
        >
          Save as
        </button>
        {/* Undo/Redo buttons hidden for now; stack history still wired in App */}
      </div>

      {error && failedStep == null ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
