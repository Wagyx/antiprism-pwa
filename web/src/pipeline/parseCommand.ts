import { CONWAY_OP_CHOICES, type ConwayOpStep } from "./conwayInfo";
import {
  defaultParams,
  isFieldVisible,
  TOOL_PARAM_SCHEMAS,
  type ParamField,
  type ParamValue,
} from "./toolParams";
import {
  CONWAY_PARAMETRIC_SEEDS,
  CONWAY_SEED_FAMILIES,
  POLYGON_TYPES,
  createConwayOp,
  createConwaySeedOp,
  createFlagsOp,
  createGeodesicOp,
  createImportFileOp,
  createOffColorOp,
  createPolygonOp,
  isFlagsTool,
  type ConwaySeedFamily,
  type FlagsToolKind,
  type ImportFileFormat,
  type PipelineOp,
  type PolygonType,
} from "./types";

const OP_BY_LETTER = new Map(CONWAY_OP_CHOICES.map((choice) => [choice.letter, choice]));

const NUMBER_TOKEN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Turn a pasted Antiprism pipeline into editor operations. */
export function parsePipelineCommand(source: string): PipelineOp[] {
  const commands = splitCommands(source);
  if (commands.length === 0) throw new Error("Paste a pipeline");
  const ops: PipelineOp[] = [];
  for (let index = 0; index < commands.length; index++) {
    const command = commands[index];
    try {
      ops.push(...parseStep(command));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      const head = command.trim().split(/\s+/)[0] ?? "command";
      throw new Error(`Step ${index + 1} (${commandName(head)}): ${message}`);
    }
  }
  return ops;
}

function parseStep(command: string): PipelineOp[] {
  const args = tokenize(command);
  if (args.length === 0) throw new Error("Empty command");
  const tool = commandName(args[0]);
  const rest = args.slice(1);
  switch (tool) {
    case "polygon":
      return [parsePolygon(rest)];
    case "import_file":
      return [parseImport(rest)];
    case "obj2off":
      return [parseObj(rest)];
    case "conway":
      return parseConway(rest);
    case "geodesic":
      return [parseGeodesic(rest)];
    case "off_color":
      return [parseOffColor(rest)];
    default:
      if (isFlagsTool(tool)) return [createFlagsOp(tool, parseFlags(tool, rest))];
      throw new Error(`Unknown tool "${tool}"`);
  }
}

function parsePolygon(args: string[]): PipelineOp {
  const rest = args[0] === "-t" ? args.slice(1) : args;
  if (rest.length === 0) return createPolygonOp();
  if (rest.length !== 2) throw new Error("Expected a type and a side count");
  const [type, sidesRaw] = rest;
  if (!(POLYGON_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unknown polygon type "${type}"`);
  }
  const sides = Number(sidesRaw);
  if (!Number.isInteger(sides) || sides < 1) {
    throw new Error("Side count must be a positive integer");
  }
  return createPolygonOp({ polygonType: type as PolygonType, numSides: sides });
}

function parseImport(args: string[]): PipelineOp {
  if (args.length === 0 || args.join(" ") === "(no file)") return createImportFileOp();
  if (args.length !== 1) throw new Error("Expected a single file name");
  return createImportFileOp({
    fileName: args[0],
    format: formatForName(args[0]),
  });
}

function parseObj(args: string[]): PipelineOp {
  let digits = 8;
  let fileName = "";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-d") {
      const value = args[++i];
      if (value == null) throw new Error("Missing value for -d");
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) throw new Error("-d expects a positive integer");
      digits = n;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option "${arg}"`);
    if (fileName) throw new Error(`Unexpected argument "${arg}"`);
    fileName = arg;
  }
  return createImportFileOp({ format: "obj", fileName, digits });
}

function parseConway(args: string[]): PipelineOp[] {
  if (args.length === 0) throw new Error("Conway notation is missing");
  const others = args.filter((arg) => arg !== "-r");
  let notation: string;
  let leftToRight: boolean;
  if (others.length === 1) {
    notation = others[0];
    leftToRight = others.length !== args.length;
  } else if (args.length === 1 && args[0] === "-r") {
    notation = "-r";
    leftToRight = false;
  } else {
    throw new Error("Conway notation should be a single word");
  }

  const parsed = parseNotation(notation);
  if (!leftToRight) parsed.steps.reverse();
  const ops: PipelineOp[] = [];
  if (parsed.seed) ops.push(parsed.seed);
  if (parsed.steps.length > 0) ops.push(createConwayOp(parsed.steps));
  if (ops.length === 0) throw new Error("Conway notation is missing");
  return ops;
}

function parseNotation(notation: string): { steps: ConwayOpStep[]; seed: PipelineOp | null } {
  const steps: ConwayOpStep[] = [];
  let i = 0;
  while (i < notation.length) {
    const choice = OP_BY_LETTER.get(notation[i]);
    if (!choice) break;
    i += 1;
    const step: ConwayOpStep = { id: crypto.randomUUID(), op: choice.id };
    if (choice.param === "suffix" || choice.param === "n_m") {
      const match = /^(\d+)/.exec(notation.slice(i));
      if (match) {
        step.n = Number(match[1]);
        i += match[1].length;
      }
    }
    if (choice.param === "usuffix" || choice.param === "n_m") {
      const match = /^_(\d+)/.exec(notation.slice(i));
      if (match) {
        if (choice.param === "n_m" && step.n == null) {
          throw new Error(`Can't read Conway notation "${notation}"`);
        }
        if (choice.param === "usuffix") step.n = Number(match[1]);
        else step.m = Number(match[1]);
        i += match[0].length;
      }
    }
    steps.push(step);
  }

  const rest = notation.slice(i);
  if (!rest) return { steps, seed: null };
  const seed = parseSeed(rest);
  if (!seed) throw new Error(`Can't read Conway notation "${notation}"`);
  return { steps, seed };
}

function parseSeed(token: string): PipelineOp | null {
  const single = /^([TCOID])$/.exec(token);
  if (single && isSeedFamily(single[1])) {
    return createConwaySeedOp({ family: single[1] });
  }
  const parametric = /^([PAYZR])(\d+)$/.exec(token);
  if (!parametric || !isSeedFamily(parametric[1])) return null;
  const family = parametric[1];
  if (!CONWAY_PARAMETRIC_SEEDS.has(family)) return null;
  const numSides = Number(parametric[2]);
  if (numSides < 3) return null;
  return createConwaySeedOp({ family, numSides });
}

function isSeedFamily(value: string): value is ConwaySeedFamily {
  return (CONWAY_SEED_FAMILIES as readonly string[]).includes(value);
}

function parseGeodesic(args: string[]): PipelineOp {
  const op = createGeodesicOp();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== "-f" && flag !== "-c" && flag !== "-M") {
      throw new Error(flag.startsWith("-") ? `Unknown option "${flag}"` : `Unexpected argument "${flag}"`);
    }
    const value = args[++i];
    if (value == null) throw new Error(`Missing value for ${flag}`);
    if (flag === "-f") {
      const frequency = Number(value);
      if (!Number.isFinite(frequency)) throw new Error("Frequency must be a number");
      op.frequency = frequency;
    } else if (flag === "-c") {
      op.faceClass = value;
    } else if (value !== "s" && value !== "p") {
      throw new Error("Method must be s or p");
    } else {
      op.method = value;
    }
  }
  return op;
}

function parseOffColor(args: string[]): PipelineOp {
  const op = createOffColorOp({ faces: "", edges: "", vertices: "" });
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag !== "-f" && flag !== "-e" && flag !== "-v") {
      throw new Error(flag.startsWith("-") ? `Unknown option "${flag}"` : `Unexpected argument "${flag}"`);
    }
    const value = args[++i];
    if (value == null) throw new Error(`Missing value for ${flag}`);
    if (flag === "-f") op.faces = value;
    else if (flag === "-e") op.edges = value;
    else op.vertices = value;
  }
  return op;
}

function parseFlags(kind: FlagsToolKind, argv: string[]): Record<string, ParamValue> {
  const schema = TOOL_PARAM_SCHEMAS[kind];
  const params = defaultParams(schema);
  const assigned = new Set<string>();
  const bools = schema.fields
    .filter((field): field is Extract<ParamField, { type: "bool" }> => field.type === "bool")
    .map((field) => ({ field, tokens: field.flag.split(/\s+/).filter(Boolean) }))
    .sort((a, b) => b.tokens.length - a.tokens.length);
  const valued = schema.fields.filter(
    (field): field is ParamField & { flag: string } =>
      field.type !== "bool" && !field.uiOnly && Boolean(field.flag),
  );
  const positionals = schema.fields.filter(
    (field) => field.type !== "bool" && !field.uiOnly && !field.flag,
  );

  const isFlagAt = (index: number) => {
    if (bools.some((entry) => entry.tokens.every((token, offset) => argv[index + offset] === token))) {
      return true;
    }
    return valued.some((field) => argv[index] === field.flag);
  };

  const nextPositional = () =>
    positionals.find((field) => isFieldVisible(field, params) && !assigned.has(field.key));

  const takePositional = (index: number) => {
    let field = nextPositional();
    const token = argv[index];
    if (!field) {
      throw new Error(
        token.startsWith("-") ? `Unknown option "${token}"` : `Unexpected argument "${token}"`,
      );
    }
    if (!accepts(field, token)) {
      const alt = positionals.find(
        (candidate) =>
          candidate !== field &&
          !assigned.has(candidate.key) &&
          candidate.visibleWhen &&
          accepts(candidate, token),
      );
      if (!alt?.visibleWhen) {
        throw new Error(
          token.startsWith("-") ? `Unknown option "${token}"` : `Unexpected argument "${token}"`,
        );
      }
      params[alt.visibleWhen.key] = alt.visibleWhen.equals;
      field = alt;
    }
    if (field.type === "text") {
      const later = positionals.some(
        (candidate) =>
          candidate !== field && isFieldVisible(candidate, params) && !assigned.has(candidate.key),
      );
      if (!later) {
        const parts = [token];
        let cursor = index + 1;
        while (cursor < argv.length && !isFlagAt(cursor)) {
          parts.push(argv[cursor]);
          cursor += 1;
        }
        params[field.key] = parts.join(" ");
        assigned.add(field.key);
        return cursor;
      }
    }
    params[field.key] = coerce(field, token);
    assigned.add(field.key);
    return index + 1;
  };

  let index = 0;
  while (index < argv.length) {
    const bool = bools.find((entry) =>
      entry.tokens.every((token, offset) => argv[index + offset] === token),
    );
    if (bool) {
      params[bool.field.key] = true;
      index += bool.tokens.length;
      continue;
    }
    const field = valued.find((candidate) => argv[index] === candidate.flag);
    if (field) {
      const value = argv[index + 1];
      if (value == null) throw new Error(`Missing value for ${field.flag}`);
      params[field.key] = coerce(field, value);
      index += 2;
      continue;
    }
    index = takePositional(index);
  }
  return params;
}

function accepts(field: ParamField, token: string): boolean {
  if (field.type === "number") return NUMBER_TOKEN.test(token);
  return true;
}

function coerce(field: ParamField, token: string): ParamValue {
  if (field.type === "number") {
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error(`Expected a number after ${field.flag ?? "the option"}`);
    return value;
  }
  return token;
}

function formatForName(name: string): ImportFileFormat {
  return name.toLowerCase().endsWith(".obj") ? "obj" : "off";
}

function commandName(token: string): string {
  const base = token.split(/[/\\]/).pop() ?? token;
  return base.replace(/\.exe$/i, "");
}

function splitCommands(source: string): string[] {
  const text = source.replace(/\\\r?\n/g, " ");
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      current += char;
      if (char === "\\" && i + 1 < text.length) {
        current += text[++i];
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "|" || char === "\n" || char === "\r") {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (quote) throw new Error("Unclosed quote");
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function tokenize(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;
  const push = () => {
    if (!started) return;
    out.push(current);
    current = "";
    started = false;
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      if (char === "\\" && quote === '"' && i + 1 < input.length) {
        current += input[++i];
        started = true;
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      started = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (char === "\\" && i + 1 < input.length) {
      current += input[++i];
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      push();
      continue;
    }
    current += char;
    started = true;
  }
  if (quote) throw new Error("Unclosed quote");
  push();
  return out;
}
