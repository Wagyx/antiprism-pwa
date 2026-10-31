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

/** Tools configured mainly via CLI flag strings + presets. */
export const FLAGS_TOOL_KINDS = [
  "off_util",
  "off_trans",
  "pol_recip",
  "canonical",
  "conv_hull",
  "planar",
] as const;

export type FlagsToolKind = (typeof FLAGS_TOOL_KINDS)[number];

export const PIPELINE_KINDS = [
  "polygon",
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
  flags: string;
};

export type PipelineOp =
  | PolygonOp
  | ConwayOp
  | GeodesicOp
  | OffColorOp
  | FlagsOp;

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

export function createFlagsOp(kind: FlagsToolKind, flags?: string): FlagsOp {
  return {
    id: newId(),
    kind,
    enabled: true,
    flags: flags ?? DEFAULT_FLAGS[kind],
  };
}

export const DEFAULT_FLAGS: Record<FlagsToolKind, string> = {
  off_util: "-S -O positive",
  off_trans: "-S 1.5",
  pol_recip: "-c C",
  // Cap iterations so browser Wasm cannot hang
  canonical: "-p p -n 80 -i 80",
  conv_hull: "",
  planar: "-d 1",
};

export function createOp(kind: PipelineKind, isFirst: boolean): PipelineOp {
  switch (kind) {
    case "polygon":
      return createPolygonOp();
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
      return op.flags.trim() ? op.flags.trim().split(/\s+/) : [];
  }
}

/** Shell-like argv for display (tool name + args). */
export function opToCommandLine(op: PipelineOp): string {
  const args = opToArgs(op).filter((a) => a.length > 0);
  return [op.kind, ...args].join(" ");
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

export const FLAG_PRESETS: Record<FlagsToolKind, { value: string; label: string }[]> = {
  off_util: [
    { value: "-s", label: "skeleton (-s)" },
    { value: "-S", label: "unit sphere (-S)" },
    { value: "-S -O positive", label: "sphere + orient" },
    { value: "-t nonzero", label: "triangulate" },
    { value: "-M a", label: "merge coincident" },
    { value: "-g", label: "geometry only" },
    { value: "-e", label: "fill missing edges" },
  ],
  off_trans: [
    { value: "-S 1.5", label: "scale ×1.5" },
    { value: "-S 0.5", label: "scale ×0.5" },
    { value: "-R 0,0,45", label: "rotate 45° about Z" },
    { value: "-R 0,90,0", label: "rotate 90° about Y" },
    { value: "-T 0,0,1", label: "translate +Z" },
    { value: "-I", label: "invert through origin" },
    { value: "-M 0,0,1", label: "reflect in XY" },
    { value: "-s r", label: "normalize radius" },
  ],
  pol_recip: [
    { value: "-c C", label: "centre: centroid" },
    { value: "-c 0", label: "centre: origin" },
    { value: "-c M", label: "centre: mid-sphere" },
    { value: "-c C -i", label: "centroid + invert" },
    { value: "-c e", label: "edge balanced" },
    { value: "-c v", label: "vert/face balanced" },
  ],
  canonical: [
    { value: "-p p -n 80 -i 80", label: "planarize (poly_form)" },
    { value: "-p m -n 80 -i 80", label: "planarize (mathematica)" },
    { value: "-c c -n 80", label: "canonicalize (circle)" },
    { value: "-c m -n 80", label: "canonicalize (mathematica)" },
    { value: "-p p -c c -n 80 -i 80", label: "planarize then canonicalize" },
  ],
  conv_hull: [
    { value: "", label: "replace with hull" },
    { value: "-a", label: "append hull to input" },
  ],
  planar: [
    { value: "-d 1", label: "tile overlapping faces" },
    { value: "-d 2", label: "merge overlapping faces" },
    { value: "-d 1 -S", label: "tile + stitch seams" },
    { value: "-d 1 -R", label: "tile + split pinched" },
    { value: "-p 2 -d 1", label: "tile (modulo2 fill)" },
  ],
};
