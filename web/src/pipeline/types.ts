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

export const PIPELINE_KINDS = [
  "polygon",
  "conway",
  "geodesic",
  "off_color",
  "off_util",
] as const;

export type PipelineKind = (typeof PIPELINE_KINDS)[number];

export type PolygonOp = {
  id: string;
  kind: "polygon";
  polygonType: PolygonType;
  numSides: number;
};

/** Conway step: seed notation (e.g. oT) when first, or operators only when piped. */
export type ConwayOp = {
  id: string;
  kind: "conway";
  notation: string;
};

export type GeodesicOp = {
  id: string;
  kind: "geodesic";
  frequency: number;
  /** Class I "1", Class II "2", or Class III "m,n". */
  faceClass: string;
  method: "s" | "p";
};

export type OffColorOp = {
  id: string;
  kind: "off_color";
  /** Value for -f, empty to omit. */
  faces: string;
  /** Value for -e, empty to omit. */
  edges: string;
  /** Value for -v, empty to omit. */
  vertices: string;
};

export type OffUtilOp = {
  id: string;
  kind: "off_util";
  /** Space-separated CLI flags, e.g. "-s" or "-S -O positive". */
  flags: string;
};

export type PipelineOp =
  | PolygonOp
  | ConwayOp
  | GeodesicOp
  | OffColorOp
  | OffUtilOp;

export type DisplayOptions = {
  verticesActive: boolean;
  edgesActive: boolean;
  facesActive: boolean;
};

export function newId(): string {
  return crypto.randomUUID();
}

export function createPolygonOp(
  partial?: Partial<Omit<PolygonOp, "id" | "kind">>,
): PolygonOp {
  return {
    id: newId(),
    kind: "polygon",
    polygonType: partial?.polygonType ?? "prism",
    numSides: partial?.numSides ?? 5,
  };
}

export function createConwayOp(notation = "a"): ConwayOp {
  return {
    id: newId(),
    kind: "conway",
    notation,
  };
}

export function createGeodesicOp(
  partial?: Partial<Omit<GeodesicOp, "id" | "kind">>,
): GeodesicOp {
  return {
    id: newId(),
    kind: "geodesic",
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
    faces: partial?.faces ?? "N",
    edges: partial?.edges ?? "U",
    vertices: partial?.vertices ?? "",
  };
}

export function createOffUtilOp(flags = "-s"): OffUtilOp {
  return {
    id: newId(),
    kind: "off_util",
    flags,
  };
}

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
    case "off_util":
      return createOffUtilOp("-S -O positive");
  }
}

/** Build argv for a tool (excluding the program name). */
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
    case "off_util":
      return op.flags.trim() ? op.flags.trim().split(/\s+/) : [];
  }
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

export const OFF_UTIL_PRESETS = [
  { value: "-s", label: "skeleton (-s)" },
  { value: "-S", label: "unit sphere (-S)" },
  { value: "-S -O positive", label: "sphere + orient" },
  { value: "-t nonzero", label: "triangulate" },
  { value: "-M a", label: "merge coincident" },
  { value: "-g", label: "geometry only" },
  { value: "-e", label: "fill missing edges" },
] as const;
