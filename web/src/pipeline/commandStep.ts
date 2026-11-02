import { readOffFile, looksLikeOff } from "../io/loadOff";
import type { LibraryDocument, LibraryInputFile, LibraryNode } from "../library/types";
import { conwayNotationFromSteps, conwayStepToken, type ConwayOpStep } from "./conwayInfo";
import {
  commandName,
  readConwayArgs,
  readKnownParams,
  tokenize,
} from "./parseCommand";
import {
  isFieldVisible,
  TOOL_PARAM_SCHEMAS,
  type ParamField,
  type ParamValue,
  type ToolParamSchema,
} from "./toolParams";
import {
  CONWAY_PARAMETRIC_SEEDS,
  GENERATOR_SEED_KINDS,
  POLYGON_TYPES,
  conwaySeedToken,
  createConwayOp,
  createOp,
  isFlagsTool,
  opToCommandLine,
  type ConwayOp,
  type ConwaySeedFamily,
  type FlagsOp,
  type GeodesicOp,
  type OffColorOp,
  type PipelineKind,
  type PipelineOp,
  type PolygonOp,
  type PolygonType,
} from "./types";

/** One pipeline step. `command` is the source of truth. */
export type CommandStep = {
  id: string;
  enabled: boolean;
  command: string;
};

export type ConwayView = ConwayOp & {
  conwaySeed?: ConwaySeedFamily | null;
  conwaySeedN?: number;
};

const conwayStepIds = new Map<string, string[]>();

export function editorKey(
  steps: CommandStep[],
  inputFile: LibraryInputFile | null,
): string {
  return JSON.stringify({
    steps: steps.map((step) => ({
      id: step.id,
      enabled: step.enabled,
      command: step.command,
    })),
    file: inputFile
      ? { fileName: inputFile.fileName, format: inputFile.format, text: inputFile.text }
      : null,
  });
}

export function commandTool(command: string): string {
  try {
    const tokens = tokenize(command);
    return tokens[0] ? commandName(tokens[0]) : "";
  } catch {
    return command.trim().split(/\s+/)[0] ?? "";
  }
}

/** Generators ignore stdin. A stored starting file is not fed to them. */
export function commandGeneratesGeometry(command: string): boolean {
  let tokens: string[];
  try {
    tokens = tokenize(command);
  } catch {
    return false;
  }
  if (tokens.length === 0) return false;
  const tool = commandName(tokens[0]);
  if (tool === "polygon" || GENERATOR_SEED_KINDS.has(tool)) return true;
  if (tool !== "conway") return false;
  return readConwayArgs(tokens.slice(1))?.seed != null;
}

export function stepFromKind(kind: PipelineKind): CommandStep {
  const op = createOp(kind, false);
  return { id: op.id, enabled: op.enabled !== false, command: opToCommandLine(op) };
}

export function viewFromCommand(step: CommandStep): PipelineOp | null {
  let tokens: string[];
  try {
    tokens = tokenize(step.command);
  } catch {
    return null;
  }
  if (tokens.length === 0) return null;
  const tool = commandName(tokens[0]);
  const args = tokens.slice(1);
  if (tool === "polygon") return viewPolygon(step, args);
  if (tool === "conway") return viewConway(step, args);
  if (tool === "geodesic") return viewGeodesic(step, args);
  if (tool === "off_color") return viewOffColor(step, args);
  if (isFlagsTool(tool)) {
    return {
      id: step.id,
      kind: tool,
      enabled: step.enabled,
      params: readKnownParams(tool, args),
    };
  }
  return null;
}

export function commandAfterEdit(
  command: string,
  before: PipelineOp,
  next: PipelineOp,
): string {
  try {
    if (next.kind === "polygon" && before.kind === "polygon") {
      return patchPolygon(command, before, next);
    }
    if (next.kind === "geodesic" && before.kind === "geodesic") {
      return patchGeodesic(command, before, next);
    }
    if (next.kind === "off_color" && before.kind === "off_color") {
      return patchOffColor(command, before, next);
    }
    if (
      (next.kind === "conway" || next.kind === "conway_seed") &&
      (before.kind === "conway" || before.kind === "conway_seed")
    ) {
      return patchConway(command, next);
    }
    if (isFlagsTool(next.kind) && before.kind === next.kind) {
      return patchFlags(command, before as FlagsOp, next as FlagsOp);
    }
    return command;
  } catch {
    return command;
  }
}

export function viewSignature(op: PipelineOp): string {
  if (op.kind === "conway") {
    const extra = op as ConwayView;
    return JSON.stringify({
      kind: "conway",
      notation: conwayNotationFromSteps(op.steps),
      seed: extra.conwaySeed ?? null,
      n: extra.conwaySeedN ?? 0,
    });
  }
  if (op.kind === "conway_seed") {
    return JSON.stringify({ kind: "conway_seed", family: op.family, n: op.numSides });
  }
  if (op.kind === "polygon") {
    return JSON.stringify({
      kind: "polygon",
      t: op.polygonType,
      n: Number.isFinite(op.numSides) ? op.numSides : null,
    });
  }
  if (op.kind === "geodesic") {
    return JSON.stringify({
      kind: "geodesic",
      f: Number.isFinite(op.frequency) ? op.frequency : null,
      c: op.faceClass,
      m: op.method === "s" || op.method === "p" ? op.method : "",
    });
  }
  if (op.kind === "off_color") {
    return JSON.stringify({
      kind: "off_color",
      f: op.faces,
      e: op.edges,
      v: op.vertices,
    });
  }
  if (isFlagsTool(op.kind)) {
    const flags = op as FlagsOp;
    const stable: Record<string, ParamValue> = {};
    for (const key of Object.keys(flags.params).sort()) stable[key] = flags.params[key];
    return JSON.stringify({ kind: flags.kind, params: stable });
  }
  return JSON.stringify({ kind: op.kind, id: op.id });
}

/** Map edited form views back onto the raw commands. Unchanged views keep their text. */
export function applyViewList(prev: CommandStep[], next: PipelineOp[]): CommandStep[] {
  return next.map((view) => {
    const prior = prev.find((step) => step.id === view.id);
    if (!prior) {
      return {
        id: view.id,
        enabled: view.enabled !== false,
        command: opToCommandLine(view),
      };
    }
    const before = viewFromCommand(prior);
    if (!before || viewSignature(before) === viewSignature(view)) {
      return { ...prior, enabled: view.enabled !== false };
    }
    return {
      id: prior.id,
      enabled: view.enabled !== false,
      command: commandAfterEdit(prior.command, before, view),
    };
  });
}

export function conwaySeedOf(
  op: PipelineOp,
): { family: ConwaySeedFamily; numSides: number } | null {
  if (op.kind === "conway_seed") return { family: op.family, numSides: op.numSides };
  if (op.kind !== "conway") return null;
  const extra = op as ConwayView;
  if (!extra.conwaySeed) return null;
  return { family: extra.conwaySeed, numSides: extra.conwaySeedN ?? 0 };
}

export function isCommandStep(value: unknown): value is CommandStep {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.id === "string" && typeof rec.command === "string" && typeof rec.kind !== "string";
}

/** Old structured operations become command text once. import_file becomes the starting file. */
export function migratePipeline(
  pipeline: unknown,
  inputFile: LibraryInputFile | null,
): { steps: CommandStep[]; inputFile: LibraryInputFile | null } {
  if (!Array.isArray(pipeline)) return { steps: [], inputFile };
  if (pipeline.every(isCommandStep)) return { steps: pipeline, inputFile };

  const steps: CommandStep[] = [];
  let file = inputFile;
  for (const item of pipeline) {
    if (isCommandStep(item)) {
      steps.push({ id: item.id, enabled: item.enabled !== false, command: item.command });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.kind !== "string") continue;
    const lifted = legacyStep(rec);
    if (!file?.text.trim() && lifted.file?.text.trim()) file = lifted.file;
    if (lifted.step) steps.push(lifted.step);
  }
  return { steps, inputFile: file };
}

export function migrateLibrary(doc: LibraryDocument): LibraryDocument {
  const root = migrateNode(doc.root);
  if (root.type !== "folder" || root === doc.root) return doc;
  return { ...doc, root };
}

export async function readStartingFile(
  file: File,
  format?: "off" | "obj",
): Promise<LibraryInputFile> {
  if (format === "off") {
    const loaded = await readOffFile(file);
    return { fileName: loaded.name, format: "off", text: loaded.text };
  }
  const text = await file.text();
  if (!text.trim()) throw new Error(`"${file.name}" is empty`);
  const resolved =
    format ??
    (file.name.toLowerCase().endsWith(".obj") || !looksLikeOff(text) ? "obj" : "off");
  if (resolved === "off" && !looksLikeOff(text)) {
    throw new Error(`"${file.name}" is not an OFF file`);
  }
  return {
    fileName: file.name || (resolved === "obj" ? "model.obj" : "model.off"),
    format: resolved,
    text,
  };
}

function migrateNode(node: LibraryNode): LibraryNode {
  if (node.type === "folder") {
    let changed = false;
    const children = node.children.map((child) => {
      const next = migrateNode(child);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...node, children } : node;
  }
  const migrated = migratePipeline(node.pipeline, node.inputFile);
  if (migrated.steps === node.pipeline && migrated.inputFile === node.inputFile) return node;
  return { ...node, pipeline: migrated.steps, inputFile: migrated.inputFile };
}

function legacyStep(rec: Record<string, unknown>): {
  step: CommandStep | null;
  file: LibraryInputFile | null;
} {
  const op = rec as unknown as PipelineOp;
  if (op.kind === "import_file") {
    const text = typeof op.fileText === "string" ? op.fileText : "";
    return {
      step: null,
      file: text.trim()
        ? {
            fileName: op.fileName || (op.format === "obj" ? "model.obj" : "model.off"),
            format: op.format === "obj" ? "obj" : "off",
            text,
          }
        : null,
    };
  }
  try {
    return {
      step: { id: op.id, enabled: op.enabled !== false, command: opToCommandLine(op) },
      file: null,
    };
  } catch {
    return {
      step: { id: String(rec.id), enabled: rec.enabled !== false, command: String(rec.kind) },
      file: null,
    };
  }
}

function viewPolygon(step: CommandStep, args: string[]): PolygonOp | null {
  const rest = args[0] === "-t" ? args.slice(1) : args;
  const type = rest[0];
  if (!type || !isPolygonType(type)) return null;
  const sides = Number(rest[1]);
  return {
    id: step.id,
    kind: "polygon",
    enabled: step.enabled,
    polygonType: type,
    numSides: Number.isFinite(sides) ? sides : Number.NaN,
  };
}

function viewConway(step: CommandStep, args: string[]): PipelineOp | null {
  const read = readConwayArgs(args);
  if (!read) return null;
  if (read.seed && read.steps.length === 0) {
    return { ...read.seed, id: step.id, enabled: step.enabled };
  }
  if (read.steps.length === 0) return null;
  const view: ConwayView = {
    ...createConwayOp(withStableSteps(step.id, read.steps)),
    id: step.id,
    enabled: step.enabled,
    conwaySeed: read.seed?.family ?? null,
    conwaySeedN: read.seed?.numSides ?? 0,
  };
  return view;
}

function viewGeodesic(step: CommandStep, args: string[]): GeodesicOp {
  let frequency = Number.NaN;
  let faceClass = "";
  let method: "s" | "p" = "s";
  let methodSet = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== "-f" && flag !== "-c" && flag !== "-M") continue;
    const value = args[++i];
    if (value == null) break;
    if (flag === "-f") {
      const n = Number(value);
      if (Number.isFinite(n)) frequency = n;
    } else if (flag === "-c") {
      faceClass = value;
    } else if (value === "s" || value === "p") {
      method = value;
      methodSet = true;
    }
  }
  return {
    id: step.id,
    kind: "geodesic",
    enabled: step.enabled,
    frequency,
    faceClass,
    method: methodSet ? method : ("" as "s" | "p"),
  };
}

function viewOffColor(step: CommandStep, args: string[]): OffColorOp {
  let faces = "";
  let edges = "";
  let vertices = "";
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== "-f" && flag !== "-e" && flag !== "-v") continue;
    const value = args[++i];
    if (value == null) break;
    if (flag === "-f") faces = value;
    else if (flag === "-e") edges = value;
    else vertices = value;
  }
  return {
    id: step.id,
    kind: "off_color",
    enabled: step.enabled,
    faces,
    edges,
    vertices,
  };
}

function withStableSteps(ownerId: string, steps: ConwayOpStep[]): ConwayOpStep[] {
  const prev = conwayStepIds.get(ownerId) ?? [];
  const ids = steps.map((step, index) => prev[index] ?? step.id);
  conwayStepIds.set(ownerId, ids);
  return steps.map((step, index) => ({ ...step, id: ids[index] }));
}

function isPolygonType(value: string): value is PolygonType {
  return (POLYGON_TYPES as readonly string[]).includes(value);
}

function quoteToken(token: string): string {
  if (token === "") return '""';
  if (/[\s"'\\]/.test(token)) {
    return `"${token.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return token;
}

function shellJoin(argv: string[]): string {
  return argv.map(quoteToken).join(" ");
}

function patchPolygon(command: string, before: PolygonOp, next: PolygonOp): string {
  const tokens = tokenize(command);
  const tool = tokens[0] ?? "polygon";
  const args = tokens.slice(1);
  if (before.polygonType !== next.polygonType) {
    const index = args.findIndex((token) => token === before.polygonType);
    if (index >= 0) args[index] = next.polygonType;
    else args.unshift(next.polygonType);
  }
  const prevSides = Number.isFinite(before.numSides) ? String(before.numSides) : null;
  const nextSides = Number.isFinite(next.numSides) ? String(next.numSides) : null;
  if (prevSides !== nextSides) {
    if (prevSides != null) {
      const index = args.findIndex((token) => token === prevSides);
      if (index >= 0) {
        if (nextSides == null) args.splice(index, 1);
        else args[index] = nextSides;
      } else if (nextSides != null) args.push(nextSides);
    } else if (nextSides != null) args.push(nextSides);
  }
  return shellJoin([tool, ...args]);
}

function patchGeodesic(command: string, before: GeodesicOp, next: GeodesicOp): string {
  const tokens = tokenize(command);
  const tool = tokens[0] ?? "geodesic";
  let args = tokens.slice(1);
  const freq = (value: number) => (Number.isFinite(value) ? String(value) : null);
  if (freq(before.frequency) !== freq(next.frequency)) {
    args = setFlag(args, "-f", freq(next.frequency));
  }
  const text = (value: string) => value.trim() || null;
  if (text(before.faceClass) !== text(next.faceClass)) {
    args = setFlag(args, "-c", text(next.faceClass));
  }
  const method = (value: string) => (value === "s" || value === "p" ? value : null);
  if (method(before.method) !== method(next.method)) {
    args = setFlag(args, "-M", method(next.method));
  }
  return shellJoin([tool, ...args]);
}

function patchOffColor(command: string, before: OffColorOp, next: OffColorOp): string {
  const tokens = tokenize(command);
  const tool = tokens[0] ?? "off_color";
  let args = tokens.slice(1);
  const text = (value: string) => value.trim() || null;
  if (text(before.faces) !== text(next.faces)) args = setFlag(args, "-f", text(next.faces));
  if (text(before.edges) !== text(next.edges)) args = setFlag(args, "-e", text(next.edges));
  if (text(before.vertices) !== text(next.vertices)) {
    args = setFlag(args, "-v", text(next.vertices));
  }
  return shellJoin([tool, ...args]);
}

function patchConway(command: string, next: PipelineOp): string {
  const tokens = tokenize(command);
  const tool = tokens[0] ?? "conway";
  const args = tokens.slice(1);
  const ltr = args.includes("-r") || args.includes("-R");
  let notation = "";
  if (next.kind === "conway_seed") notation = conwaySeedToken(next);
  else if (next.kind === "conway") {
    const extra = next as ConwayView;
    const ordered = ltr ? next.steps : [...next.steps].reverse();
    const seed = extra.conwaySeed
      ? conwaySeedToken({
          id: "",
          kind: "conway_seed",
          enabled: true,
          family: extra.conwaySeed,
          numSides:
            CONWAY_PARAMETRIC_SEEDS.has(extra.conwaySeed) && (extra.conwaySeedN ?? 0) >= 3
              ? (extra.conwaySeedN as number)
              : 5,
        })
      : "";
    notation = ordered.map(conwayStepToken).join("") + seed;
  }
  let notationAt = -1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-r" || args[i] === "-R" || args[i].startsWith("-")) continue;
    notationAt = i;
    break;
  }
  const nextArgs = args.slice();
  if (notation) {
    if (notationAt >= 0) nextArgs[notationAt] = notation;
    else nextArgs.push(notation);
  } else if (notationAt >= 0) nextArgs.splice(notationAt, 1);
  return shellJoin([tool, ...nextArgs]);
}

function patchFlags(command: string, before: FlagsOp, next: FlagsOp): string {
  const tokens = tokenize(command);
  const tool = tokens[0] ?? next.kind;
  let args = tokens.slice(1);
  const schema = TOOL_PARAM_SCHEMAS[next.kind];
  for (const field of schema.fields) {
    if (field.uiOnly) continue;
    if (field.type === "bool") {
      const prevOn = emittedBool(field, before.params);
      const nextOn = emittedBool(field, next.params);
      if (prevOn === nextOn) continue;
      args = setBool(args, field.flag.split(/\s+/).filter(Boolean), nextOn);
      continue;
    }
    const prevText = emittedText(field, before.params);
    const nextText = emittedText(field, next.params);
    if (prevText === nextText) continue;
    if (field.flag) args = setFlag(args, field.flag, nextText);
    else args = setPositional(args, schema, prevText, nextText);
  }
  return shellJoin([tool, ...args]);
}

function emittedBool(field: ParamField, params: Record<string, ParamValue>): boolean {
  if (field.type !== "bool" || !isFieldVisible(field, params)) return false;
  return params[field.key] === true;
}

function emittedText(field: ParamField, params: Record<string, ParamValue>): string | null {
  if (field.type === "bool" || field.uiOnly || !isFieldVisible(field, params)) return null;
  if (!Object.prototype.hasOwnProperty.call(params, field.key)) return null;
  const value = params[field.key];
  if (field.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
  }
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function setFlag(args: string[], flag: string, next: string | null): string[] {
  const index = args.indexOf(flag);
  if (next == null) {
    if (index < 0) return args;
    return [...args.slice(0, index), ...args.slice(index + 2)];
  }
  if (index < 0) return [...args, flag, next];
  const copy = args.slice();
  copy[index + 1] = next;
  return copy;
}

function findSequence(args: string[], tokens: string[]): number {
  if (tokens.length === 0) return -1;
  for (let i = 0; i <= args.length - tokens.length; i++) {
    if (tokens.every((token, offset) => args[i + offset] === token)) return i;
  }
  return -1;
}

function setBool(args: string[], tokens: string[], on: boolean): string[] {
  const index = findSequence(args, tokens);
  if (on) return index >= 0 ? args : [...args, ...tokens];
  if (index < 0) return args;
  return [...args.slice(0, index), ...args.slice(index + tokens.length)];
}

function flagIndexes(args: string[], schema: ToolParamSchema): Set<number> {
  const taken = new Set<number>();
  const bools = schema.fields
    .filter((field): field is Extract<ParamField, { type: "bool" }> => field.type === "bool")
    .map((field) => field.flag.split(/\s+/).filter(Boolean))
    .sort((a, b) => b.length - a.length);
  const flags = schema.fields
    .filter((field) => field.type !== "bool" && !field.uiOnly && field.flag)
    .map((field) => field.flag as string);
  for (let i = 0; i < args.length; i++) {
    if (taken.has(i)) continue;
    const bool = bools.find((tokens) => tokens.every((token, offset) => args[i + offset] === token));
    if (bool) {
      bool.forEach((_, offset) => taken.add(i + offset));
      i += bool.length - 1;
      continue;
    }
    if (flags.includes(args[i])) {
      taken.add(i);
      if (i + 1 < args.length) taken.add(i + 1);
      i += 1;
    }
  }
  return taken;
}

function setPositional(
  args: string[],
  schema: ToolParamSchema,
  previous: string | null,
  next: string | null,
): string[] {
  const taken = flagIndexes(args, schema);
  if (previous != null) {
    const parts = previous.trim().split(/\s+/).filter(Boolean);
    const index = findFreeSequence(args, parts, taken);
    if (index >= 0) {
      const replacement = next == null ? [] : next.trim().split(/\s+/).filter(Boolean);
      return [...args.slice(0, index), ...replacement, ...args.slice(index + parts.length)];
    }
  }
  if (next == null) return args;
  return [...args, ...next.trim().split(/\s+/).filter(Boolean)];
}

function findFreeSequence(args: string[], parts: string[], taken: Set<number>): number {
  if (parts.length === 0) return -1;
  for (let i = 0; i <= args.length - parts.length; i++) {
    if (parts.some((_, offset) => taken.has(i + offset))) continue;
    if (parts.every((part, offset) => args[i + offset] === part)) return i;
  }
  return -1;
}
