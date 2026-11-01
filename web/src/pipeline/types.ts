import {
  defaultParams,
  paramsSummary,
  paramsToArgs,
  TOOL_PARAM_SCHEMAS,
} from "./toolParams";

export const POLYGON_TYPES = [
  "prism",
  "antiprism",
  "pyramid",
  "dipyramid",
  "cupola",
  "orthobicupola",
  "gyrobicupola",
  "snub-antiprism",
  "dihedron",
] as const;

export type PolygonType = (typeof POLYGON_TYPES)[number];

/** Tools configured via structured param schemas (see toolParams.ts). */
export const FLAGS_TOOL_KINDS = [
  "off_util",
  "off_trans",
  "pol_recip",
  "canonical",
  "conv_hull",
  "planar",
  "zono",
  "poly_kscope",
  "stellate",
  "leonardo",
  "wythoff",
  "to_nfold",
  "off_normals",
  "repel",
] as const;

export type FlagsToolKind = (typeof FLAGS_TOOL_KINDS)[number];

export const PIPELINE_KINDS = [
  "polygon",
  "import_off",
  "conway",
  "geodesic",
  "off_color",
  ...FLAGS_TOOL_KINDS,
] as const;

export type PipelineKind = (typeof PIPELINE_KINDS)[number];

type OpBase = {
  id: string;
  /** When false, step is skipped in the pipeline. */
  enabled: boolean;
};

export type PolygonOp = OpBase & {
  kind: "polygon";
  polygonType: PolygonType;
  numSides: number;
};

/** Seed that injects a loaded OFF file into the pipeline. */
export type ImportOffOp = OpBase & {
  kind: "import_off";
  fileName: string;
  offText: string;
};

export type ConwayOp = OpBase & {
  kind: "conway";
  notation: string;
};

export type GeodesicOp = OpBase & {
  kind: "geodesic";
  frequency: number;
  faceClass: string;
  method: "s" | "p";
};

export type OffColorOp = OpBase & {
  kind: "off_color";
  faces: string;
  edges: string;
  vertices: string;
};

export type FlagsOp = OpBase & {
  kind: FlagsToolKind;
  /** Structured UI params; serialized to CLI argv via tool param schemas. */
  params: Record<string, string | number | boolean>;
};

export type PipelineOp =
  | PolygonOp
  | ImportOffOp
  | ConwayOp
  | GeodesicOp
  | OffColorOp
  | FlagsOp;

/** Ops that produce OFF without reading previous stdin. */
export function isSeedOp(op: PipelineOp): boolean {
  return op.kind === "polygon" || op.kind === "import_off";
}

export type DisplayOptions = {
  verticesActive: boolean;
  edgesActive: boolean;
  facesActive: boolean;
};

export function newId(): string {
  return crypto.randomUUID();
}

export function isFlagsTool(kind: string): kind is FlagsToolKind {
  return (FLAGS_TOOL_KINDS as readonly string[]).includes(kind);
}

export function createPolygonOp(
  partial?: Partial<Omit<PolygonOp, "id" | "kind">>,
): PolygonOp {
  return {
    id: newId(),
    kind: "polygon",
    enabled: partial?.enabled ?? true,
    polygonType: partial?.polygonType ?? "prism",
    numSides: partial?.numSides ?? 5,
  };
}

export function createImportOffOp(
  partial?: Partial<Omit<ImportOffOp, "id" | "kind">>,
): ImportOffOp {
  return {
    id: newId(),
    kind: "import_off",
    enabled: partial?.enabled ?? true,
    fileName: partial?.fileName ?? "",
    offText: partial?.offText ?? "",
  };
}

export function createConwayOp(
  notation = "a",
  partial?: Partial<Omit<ConwayOp, "id" | "kind" | "notation">>,
): ConwayOp {
  return {
    id: newId(),
    kind: "conway",
    enabled: partial?.enabled ?? true,
    notation,
  };
}

export function createGeodesicOp(
  partial?: Partial<Omit<GeodesicOp, "id" | "kind">>,
): GeodesicOp {
  return {
    id: newId(),
    kind: "geodesic",
    enabled: partial?.enabled ?? true,
    frequency: partial?.frequency ?? 2,
    faceClass: partial?.faceClass ?? "1",
    method: partial?.method ?? "s",
  };
}

export function createOffColorOp(
  partial?: Partial<Omit<OffColorOp, "id" | "kind">>,
): OffColorOp {
  return {
    id: newId(),
    kind: "off_color",
    enabled: partial?.enabled ?? true,
    faces: partial?.faces ?? "N",
    edges: partial?.edges ?? "U",
    vertices: partial?.vertices ?? "",
  };
}

export function createFlagsOp(
  kind: FlagsToolKind,
  params?: Record<string, string | number | boolean>,
): FlagsOp {
  return {
    id: newId(),
    kind,
    enabled: true,
    params: params ?? defaultParams(TOOL_PARAM_SCHEMAS[kind]),
  };
}

export function createOp(kind: PipelineKind, isFirst: boolean): PipelineOp {
  switch (kind) {
    case "polygon":
      return createPolygonOp();
    case "import_off":
      return createImportOffOp();
    case "conway":
      return createConwayOp(isFirst ? "T" : "a");
    case "geodesic":
      return createGeodesicOp();
    case "off_color":
      return createOffColorOp();
    default:
      return createFlagsOp(kind);
  }
}

export function opToArgs(op: PipelineOp): string[] {
  switch (op.kind) {
    case "polygon":
      return [op.polygonType, String(op.numSides)];
    case "import_off":
      return op.fileName ? [op.fileName] : [];
    case "conway":
      return [op.notation.trim()];
    case "geodesic":
      return ["-f", String(op.frequency), "-c", op.faceClass, "-M", op.method];
    case "off_color": {
      const args: string[] = [];
      if (op.faces.trim()) args.push("-f", op.faces.trim());
      if (op.edges.trim()) args.push("-e", op.edges.trim());
      if (op.vertices.trim()) args.push("-v", op.vertices.trim());
      return args;
    }
    default:
      return paramsToArgs(TOOL_PARAM_SCHEMAS[op.kind], op.params);
  }
}

/** Shell-like argv for display (tool name + args). */
export function opToCommandLine(op: PipelineOp): string {
  if (op.kind === "import_off") {
    return op.fileName ? `import_off ${op.fileName}` : "import_off (no file)";
  }
  const args = opToArgs(op).filter((a) => a.length > 0);
  return [op.kind, ...args].join(" ");
}

export function flagsOpSummary(op: FlagsOp): string {
  return paramsSummary(TOOL_PARAM_SCHEMAS[op.kind], op.params);
}

export const defaultStack: PipelineOp[] = [
  createPolygonOp({ polygonType: "prism", numSides: 5 }),
  createConwayOp("a"),
];

export const defaultDisplay: DisplayOptions = {
  verticesActive: true,
  edgesActive: true,
  facesActive: true,
};

export const OFF_COLOR_PRESETS = [
  { value: "", label: "(omit)" },
  { value: "N", label: "N — by sides / count" },
  { value: "U", label: "U — unique colours" },
  { value: "P", label: "P — proper colouring" },
  { value: "S", label: "S — symmetry" },
  { value: "u", label: "u — unique (index)" },
  { value: "n", label: "n — by sides (index)" },
] as const;
