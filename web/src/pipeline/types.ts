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

export type PolygonOp = {
  id: string;
  kind: "polygon";
  polygonType: PolygonType;
  numSides: number;
};

/** Conway step: seed notation (e.g. oT) when first, or operators only (e.g. a, k) when piped. */
export type ConwayOp = {
  id: string;
  kind: "conway";
  notation: string;
};

export type PipelineOp = PolygonOp | ConwayOp;

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

export const defaultStack: PipelineOp[] = [
  createPolygonOp({ polygonType: "prism", numSides: 5 }),
  createConwayOp("a"),
];

export const defaultDisplay: DisplayOptions = {
  verticesActive: true,
  edgesActive: true,
  facesActive: true,
};
