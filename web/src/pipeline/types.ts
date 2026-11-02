import {
  conwayNotationFromSteps,
  newConwayOpStep,
  type ConwayOpStep,
} from "./conwayInfo";
import {
  defaultParams,
  paramsSummary,
  paramsToArgs,
  TOOL_PARAM_SCHEMAS,
} from "./toolParams";

export type { ConwayOpStep } from "./conwayInfo";

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
  "poly_form",
  "off_color_radial",
  "miller",
  "iso_delta",
  "iso_kite",
  "symmetro",
  "sph_rings",
  "waterman",
  "tetra59",
  "bravais",
  "unitile2d",
  "n_icons",
  "kcycle",
  "lat_util",
  "col_util",
  "off_report",
  "off_query",
  "off2obj",
  "off2crds",
  "off2pov",
  "off2vrml",
  "off2dae",
] as const;

export type FlagsToolKind = (typeof FLAGS_TOOL_KINDS)[number];

export const PIPELINE_KINDS = [
  "polygon",
  "import_file",
  "conway_seed",
  "conway",
  "geodesic",
  "off_color",
  ...FLAGS_TOOL_KINDS,
] as const;

export type PipelineKind = (typeof PIPELINE_KINDS)[number];

/** Conway seed families; parametric ones append n (e.g. P5). */
export const CONWAY_SEED_FAMILIES = [
  "T",
  "C",
  "O",
  "I",
  "D",
  "P",
  "A",
  "Y",
  "Z",
  "R",
] as const;

export type ConwaySeedFamily = (typeof CONWAY_SEED_FAMILIES)[number];

export const CONWAY_PARAMETRIC_SEEDS = new Set<ConwaySeedFamily>([
  "P",
  "A",
  "Y",
  "Z",
  "R",
]);

export type PipelineCategoryId = "seed" | "transform" | "refine" | "utility";

/** Grouped catalog for the Add operation menu. */
export const PIPELINE_CATEGORIES: {
  id: PipelineCategoryId;
  label: string;
  tools: { kind: PipelineKind; blurb: string }[];
}[] = [
  {
    id: "seed",
    label: "Seed",
    tools: [
      { kind: "polygon", blurb: "Prism, pyramid, …" },
      { kind: "import_file", blurb: "Load OFF / OBJ" },
      { kind: "conway_seed", blurb: "Conway seed" },
      { kind: "geodesic", blurb: "Frequency spheres" },
      { kind: "zono", blurb: "Zonohedra" },
      { kind: "wythoff", blurb: "Wythoff tilings" },
      { kind: "miller", blurb: "Icosa stellations" },
      { kind: "iso_delta", blurb: "Isohedral deltas" },
      { kind: "iso_kite", blurb: "Isohedral kites" },
      { kind: "symmetro", blurb: "Symmetrohedra" },
      { kind: "sph_rings", blurb: "Points on sphere rings" },
      { kind: "waterman", blurb: "Waterman polyhedra" },
      { kind: "tetra59", blurb: "Rational tetrahedra" },
      { kind: "bravais", blurb: "Bravais lattices" },
      { kind: "unitile2d", blurb: "Uniform tilings" },
      { kind: "n_icons", blurb: "Sphericons / n-icons" },
      { kind: "col_util", blurb: "Colour map plots" },
    ],
  },
  {
    id: "transform",
    label: "Transform",
    tools: [
      { kind: "conway", blurb: "Conway operators" },
      { kind: "off_trans", blurb: "Scale, rotate, …" },
      { kind: "pol_recip", blurb: "Dual / reciprocal" },
      { kind: "to_nfold", blurb: "Change axial fold" },
      { kind: "poly_kscope", blurb: "Kaleidoscope" },
      { kind: "stellate", blurb: "Stellations" },
      { kind: "leonardo", blurb: "Panel borders" },
      { kind: "kcycle", blurb: "Kaleidocycle" },
      { kind: "lat_util", blurb: "Lattice utilities" },
    ],
  },
  {
    id: "refine",
    label: "Refine",
    tools: [
      { kind: "canonical", blurb: "Planarize" },
      { kind: "planar", blurb: "Coplanar faces" },
      { kind: "conv_hull", blurb: "Convex hull" },
      { kind: "repel", blurb: "Repel points" },
      { kind: "poly_form", blurb: "Regular faces" },
    ],
  },
  {
    id: "utility",
    label: "Utility",
    tools: [
      { kind: "off_util", blurb: "Orient, sphere, …" },
      { kind: "off_color", blurb: "Colour V/E/F" },
      { kind: "off_color_radial", blurb: "Radial colouring" },
      { kind: "off_normals", blurb: "Normals as geom" },
      { kind: "off_report", blurb: "Measures & counts" },
      { kind: "off_query", blurb: "Element data" },
      { kind: "off2obj", blurb: "Export Wavefront OBJ" },
      { kind: "off2crds", blurb: "Export coordinates" },
      { kind: "off2pov", blurb: "Export POV-Ray" },
      { kind: "off2vrml", blurb: "Export VRML" },
      { kind: "off2dae", blurb: "Export Collada DAE" },
    ],
  },
];

const KIND_TO_CATEGORY = new Map<PipelineKind, PipelineCategoryId>(
  PIPELINE_CATEGORIES.flatMap((cat) =>
    cat.tools.map(({ kind }) => [kind, cat.id] as const),
  ),
);

export function categoryIdForKind(kind: PipelineKind): PipelineCategoryId {
  return KIND_TO_CATEGORY.get(kind) ?? "utility";
}

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

export type ImportFileFormat = "off" | "obj";

/** Seed that injects a loaded OFF or OBJ file into the pipeline. */
export type ImportFileOp = OpBase & {
  kind: "import_file";
  format: ImportFileFormat;
  fileName: string;
  /** Raw file text (OFF, or OBJ converted via Wasm `obj2off`). */
  fileText: string;
  /** Significant digits for obj2off (-d); used when format is obj. */
  digits: number;
};

/** Seed-only Conway step (capital letter / Pn…); calls Wasm `conway`. */
export type ConwaySeedOp = OpBase & {
  kind: "conway_seed";
  family: ConwaySeedFamily;
  /** Used when family is P/A/Y/Z/R. */
  numSides: number;
};

/** Operators-only Conway transform; pipes previous OFF. */
export type ConwayOp = OpBase & {
  kind: "conway";
  /** Applied top→bottom (`conway -r` + joined tokens). */
  steps: ConwayOpStep[];
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
  | ImportFileOp
  | ConwaySeedOp
  | ConwayOp
  | GeodesicOp
  | OffColorOp
  | FlagsOp;

export const GENERATOR_SEED_KINDS = new Set<string>([
  "conway_seed",
  "miller",
  "iso_delta",
  "iso_kite",
  "symmetro",
  "sph_rings",
  "waterman",
  "tetra59",
  "bravais",
  "unitile2d",
  "n_icons",
  "col_util",
]);

/** Ops that produce OFF without reading previous stdin. */
export function isSeedOp(op: PipelineOp): boolean {
  return (
    op.kind === "polygon" ||
    op.kind === "import_file" ||
    GENERATOR_SEED_KINDS.has(op.kind)
  );
}

/** Tools that print text/export formats and leave pipeline OFF unchanged. */
export const TEXT_TOOL_KINDS = [
  "off_report",
  "off_query",
  "off2obj",
  "off2crds",
  "off2pov",
  "off2vrml",
  "off2dae",
] as const;

export type TextToolKind = (typeof TEXT_TOOL_KINDS)[number];

export function isTextTool(kind: string): kind is TextToolKind {
  return (TEXT_TOOL_KINDS as readonly string[]).includes(kind);
}

export function textToolDownloadName(kind: TextToolKind): string {
  switch (kind) {
    case "off2obj":
      return "polyhedron.obj";
    case "off2crds":
      return "coordinates.txt";
    case "off_report":
      return "report.txt";
    case "off_query":
      return "query.txt";
    case "off2pov":
      return "polyhedron.pov";
    case "off2vrml":
      return "polyhedron.wrl";
    case "off2dae":
      return "polyhedron.dae";
  }
}

/** Formats offered by the stack Export menu. */
export const SAVE_AS_OPTIONS = [
  {
    id: "off",
    label: "OFF",
    fileName: "polyhedron.off",
    tool: null,
    args: [] as string[],
    mime: "model/off",
  },
  {
    id: "obj",
    label: "OBJ",
    fileName: "polyhedron.obj",
    tool: "off2obj" as const,
    args: ["-d", "8"],
    mime: "model/obj",
  },
  {
    id: "crds",
    label: "Coordinates",
    fileName: "coordinates.txt",
    tool: "off2crds" as const,
    args: ["-d", "8"],
    mime: "text/plain;charset=utf-8",
  },
  {
    id: "pov",
    label: "POV-Ray",
    fileName: "polyhedron.pov",
    tool: "off2pov" as const,
    args: [] as string[],
    mime: "text/plain;charset=utf-8",
  },
  {
    id: "vrml",
    label: "VRML",
    fileName: "polyhedron.wrl",
    tool: "off2vrml" as const,
    args: [] as string[],
    mime: "model/vrml",
  },
  {
    id: "dae",
    label: "Collada DAE",
    fileName: "polyhedron.dae",
    tool: "off2dae" as const,
    args: [] as string[],
    mime: "model/vnd.collada+xml",
  },
] as const;

export type SaveAsFormatId = (typeof SAVE_AS_OPTIONS)[number]["id"];

export function saveAsOption(
  id: SaveAsFormatId,
): (typeof SAVE_AS_OPTIONS)[number] {
  const opt = SAVE_AS_OPTIONS.find((o) => o.id === id);
  if (!opt) throw new Error(`Unknown save format: ${id}`);
  return opt;
}

/** Path written by Wasm setup_io; obj2off needs a real file for tinyobj. */
export const WASM_STDIN_PATH = "/tmp/ap_stdin";

/** Notation token for a Conway seed step (e.g. T, P5). */
export function conwaySeedToken(op: ConwaySeedOp): string {
  if (CONWAY_PARAMETRIC_SEEDS.has(op.family)) {
    return `${op.family}${Math.max(3, Math.floor(op.numSides))}`;
  }
  return op.family;
}

/** Wasm CLI name for a pipeline kind (aliases like conway_seed → conway). */
export function wasmToolForOp(op: PipelineOp): string {
  if (op.kind === "conway_seed") return "conway";
  return op.kind;
}

export type DisplayOptions = {
  verticesActive: boolean;
  edgesActive: boolean;
  facesActive: boolean;
  axesActive: boolean;
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

export function createImportFileOp(
  partial?: Partial<Omit<ImportFileOp, "id" | "kind">>,
): ImportFileOp {
  return {
    id: newId(),
    kind: "import_file",
    enabled: partial?.enabled ?? true,
    format: partial?.format ?? "off",
    fileName: partial?.fileName ?? "",
    fileText: partial?.fileText ?? "",
    digits: partial?.digits ?? 8,
  };
}

export function createConwaySeedOp(
  partial?: Partial<Omit<ConwaySeedOp, "id" | "kind">>,
): ConwaySeedOp {
  return {
    id: newId(),
    kind: "conway_seed",
    enabled: partial?.enabled ?? true,
    family: partial?.family ?? "T",
    numSides: partial?.numSides ?? 5,
  };
}

export function createConwayOp(
  steps?: ConwayOpStep[],
  partial?: Partial<Omit<ConwayOp, "id" | "kind" | "steps">>,
): ConwayOp {
  return {
    id: newId(),
    kind: "conway",
    enabled: partial?.enabled ?? true,
    steps: steps ?? [newConwayOpStep("a")],
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

export function createOp(kind: PipelineKind, _isFirst: boolean): PipelineOp {
  switch (kind) {
    case "polygon":
      return createPolygonOp();
    case "import_file":
      return createImportFileOp();
    case "conway_seed":
      return createConwaySeedOp();
    case "conway":
      return createConwayOp();
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
    case "import_file":
      if (op.format === "obj") {
        // tinyobj loads by path; Wasm setup_io writes stdin bytes to this file.
        return ["-d", String(op.digits), WASM_STDIN_PATH];
      }
      return op.fileName ? [op.fileName] : [];
    case "conway_seed":
      return [conwaySeedToken(op)];
    case "conway": {
      const notation = conwayNotationFromSteps(op.steps);
      // -r: apply tokens left→right so stack order matches apply order
      return notation ? ["-r", notation] : [];
    }
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
  if (op.kind === "import_file") {
    const file = op.fileName || "(no file)";
    if (op.format === "obj") {
      return `obj2off -d ${op.digits} ${file}`;
    }
    return op.fileName ? `import_file ${file}` : "import_file (no file)";
  }
  const tool = wasmToolForOp(op);
  const args = opToArgs(op).filter((a) => a.length > 0);
  return [tool, ...args].join(" ");
}

export function flagsOpSummary(op: FlagsOp): string {
  return paramsSummary(TOOL_PARAM_SCHEMAS[op.kind], op.params);
}

/** Default: U27 rhombicosidodecahedron via Conway eD. */
export const defaultStack: PipelineOp[] = [
  createConwaySeedOp({ family: "D" }),
  createConwayOp([{ id: newId(), op: "e" }]),
];

export const defaultDisplay: DisplayOptions = {
  verticesActive: true,
  edgesActive: true,
  facesActive: true,
  axesActive: true,
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
