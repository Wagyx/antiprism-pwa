/** Conway notation reference from Antiprism `conway -H`. */

export type ConwayInfoEntry = {
  symbol: string;
  name: string;
  summary: string;
};

/** Selectable operator for the Conway ops stack UI. */
export type ConwayOpChoice = {
  id: string;
  /** Base letter(s) written into the notation string. */
  letter: string;
  name: string;
  summary: string;
  /**
   * none — letter only
   * suffix — letter + n (b3, k5)
   * usuffix — letter + _n (L_3)
   * n_m — letter + n_m (e2_1)
   */
  param: "none" | "suffix" | "usuffix" | "n_m";
  defaultN?: number;
  defaultM?: number;
  minN?: number;
};

/** Operators offered in the stack dropdown (seed marker omitted). */
export const CONWAY_OP_CHOICES: ConwayOpChoice[] = [
  { id: "a", letter: "a", name: "ambo", summary: "Rectify", param: "none" },
  {
    id: "b",
    letter: "b",
    name: "bevel",
    summary: "Omnitruncate (bX = taX)",
    param: "suffix",
    defaultN: 2,
    minN: 1,
  },
  { id: "c", letter: "c", name: "chamfer", summary: "Edges → hexagons", param: "none" },
  { id: "d", letter: "d", name: "dual", summary: "Swap verts / faces", param: "none" },
  {
    id: "e",
    letter: "e",
    name: "expand",
    summary: "Cantellate (eX = aaX)",
    param: "n_m",
    defaultN: 0,
    defaultM: 0,
    minN: 0,
  },
  {
    id: "g",
    letter: "g",
    name: "gyro",
    summary: "Dual of snub",
    param: "suffix",
    defaultN: 1,
    minN: 1,
  },
  { id: "j", letter: "j", name: "join", summary: "Dual of ambo", param: "none" },
  {
    id: "k",
    letter: "k",
    name: "kis",
    summary: "Pyramid on faces (optional r-gons only)",
    param: "suffix",
    minN: 3,
  },
  {
    id: "m",
    letter: "m",
    name: "meta",
    summary: "Kis + ortho triangulation",
    param: "suffix",
    defaultN: 1,
    minN: 1,
  },
  {
    id: "o",
    letter: "o",
    name: "ortho",
    summary: "Dual of expand",
    param: "n_m",
    defaultN: 0,
    defaultM: 0,
    minN: 0,
  },
  { id: "p", letter: "p", name: "propeller", summary: "n-gon + quads", param: "none" },
  { id: "r", letter: "r", name: "reflect", summary: "Mirror chiral solids", param: "none" },
  {
    id: "s",
    letter: "s",
    name: "snub",
    summary: "Chiral snub",
    param: "suffix",
    defaultN: 1,
    minN: 1,
  },
  {
    id: "t",
    letter: "t",
    name: "truncate",
    summary: "Cut vertices (optional order-r only)",
    param: "suffix",
    minN: 3,
  },
  { id: "w", letter: "w", name: "whirl", summary: "Gyro then truncate centres", param: "none" },
  { id: "z", letter: "z", name: "zip", summary: "Bitruncation / dual of kis", param: "none" },
  { id: "n", letter: "n", name: "needle", summary: "Dual of truncate", param: "none" },
  { id: "q", letter: "q", name: "quinto", summary: "Ortho then truncate centres", param: "none" },
  {
    id: "u",
    letter: "u",
    name: "subdivide",
    summary: "Ambo retaining original verts",
    param: "n_m",
    defaultN: 0,
    defaultM: 0,
    minN: 0,
  },
  {
    id: "l",
    letter: "l",
    name: "loft",
    summary: "Prism augmentation",
    param: "usuffix",
    minN: 3,
  },
  {
    id: "L",
    letter: "L",
    name: "lace",
    summary: "Antiprism augmentation",
    param: "usuffix",
    minN: 3,
  },
  {
    id: "L0",
    letter: "L_0",
    name: "joined-lace",
    summary: "Lace without splitting new quads",
    param: "none",
  },
  { id: "B", letter: "B", name: "bowtie", summary: "Bowtie triangles", param: "none" },
  { id: "E", letter: "E", name: "ethyl", summary: "Expand with kite split", param: "none" },
  { id: "G", letter: "G", name: "opposite-lace", summary: "Lace-like opposite splits", param: "none" },
  { id: "J", letter: "J", name: "joined-medial", summary: "Medial with rhombs", param: "none" },
  {
    id: "K",
    letter: "K",
    name: "stake",
    summary: "Central quads + triangles",
    param: "suffix",
    minN: 3,
  },
  {
    id: "M",
    letter: "M",
    name: "medial",
    summary: "Meta without diagonals",
    param: "suffix",
    defaultN: 1,
    minN: 1,
  },
  { id: "W", letter: "W", name: "waffle", summary: "Truncate then section faces", param: "none" },
  {
    id: "X",
    letter: "X",
    name: "cross",
    summary: "Kis + subdivide",
    param: "suffix",
    defaultN: 1,
    minN: 1,
  },
  { id: "+", letter: "+", name: "orient +", summary: "Positive orientation", param: "none" },
  { id: "-", letter: "-", name: "orient −", summary: "Negative orientation", param: "none" },
];

export const CONWAY_OP_CHOICE_BY_ID: Record<string, ConwayOpChoice> =
  Object.fromEntries(CONWAY_OP_CHOICES.map((c) => [c.id, c]));

export type ConwayOpStep = {
  id: string;
  /** Matches ConwayOpChoice.id */
  op: string;
  /** Optional numeric param (n or r). Omit / empty → letter only when allowed. */
  n?: number;
  m?: number;
};

export function newConwayOpStep(op = "a"): ConwayOpStep {
  const choice = CONWAY_OP_CHOICE_BY_ID[op] ?? CONWAY_OP_CHOICES[0];
  const step: ConwayOpStep = { id: crypto.randomUUID(), op: choice.id };
  if (choice.param === "suffix" || choice.param === "usuffix") {
    if (choice.defaultN != null) step.n = choice.defaultN;
  } else if (choice.param === "n_m") {
    step.n = choice.defaultN ?? 0;
    step.m = choice.defaultM ?? 0;
  }
  return step;
}

/** Build one notation token from a stack step. */
export function conwayStepToken(step: ConwayOpStep): string {
  const choice = CONWAY_OP_CHOICE_BY_ID[step.op];
  if (!choice) return "";
  const n = step.n;
  const m = step.m;
  switch (choice.param) {
    case "none":
      return choice.letter;
    case "suffix":
      return n != null && Number.isFinite(n) ? `${choice.letter}${n}` : choice.letter;
    case "usuffix":
      return n != null && Number.isFinite(n) ? `${choice.letter}_${n}` : choice.letter;
    case "n_m": {
      if (n != null && m != null && Number.isFinite(n) && Number.isFinite(m)) {
        return `${choice.letter}${n}_${m}`;
      }
      if (n != null && Number.isFinite(n)) return `${choice.letter}${n}`;
      return choice.letter;
    }
  }
}

/** Full notation string; steps are applied top→bottom via `conway -r`. */
export function conwayNotationFromSteps(steps: ConwayOpStep[]): string {
  return steps.map(conwayStepToken).join("");
}

export const CONWAY_SEEDS: ConwayInfoEntry[] = [
  { symbol: "T", name: "tetrahedron", summary: "Platonic tetrahedron" },
  { symbol: "C", name: "cube", summary: "Platonic cube" },
  { symbol: "O", name: "octahedron", summary: "Platonic octahedron" },
  { symbol: "I", name: "icosahedron", summary: "Platonic icosahedron" },
  { symbol: "D", name: "dodecahedron", summary: "Platonic dodecahedron" },
  { symbol: "Pn", name: "prism", summary: "n-gonal prism (n ≥ 3), e.g. P5" },
  { symbol: "An", name: "antiprism", summary: "n-gonal antiprism (n ≥ 3)" },
  { symbol: "Yn", name: "pyramid", summary: "n-gonal pyramid (n ≥ 3)" },
  { symbol: "Zn", name: "polygon", summary: "n-gon as flat seed (n ≥ 3)" },
  { symbol: "Rn", name: "random", summary: "random seed with n (n ≥ 3)" },
];

export const CONWAY_OPERATORS: ConwayInfoEntry[] = [
  {
    symbol: "a",
    name: "ambo",
    summary: "Rectify: new vertex per edge; faces for old faces and vertices",
  },
  {
    symbol: "b / bn",
    name: "bevel",
    summary: "Omnitruncate (bX = taX); n ≥ 1 (default 2)",
  },
  {
    symbol: "c",
    name: "chamfer",
    summary: "Replace edges with new hexagonal faces",
  },
  {
    symbol: "d",
    name: "dual",
    summary: "Swap vertices and faces (order two: ddX = X)",
  },
  {
    symbol: "e / en_m",
    name: "expand",
    summary: "Cantellate / Stott expand (eX = aaX); subscripts ≥ 0",
  },
  {
    symbol: "g / gn",
    name: "gyro",
    summary: "Dual of snub; pentagonal faces; n ≥ 1",
  },
  {
    symbol: "j",
    name: "join",
    summary: "Dual of ambo: one 4-gon per original edge",
  },
  {
    symbol: "k / kr",
    name: "kis",
    summary: "Pyramid on faces (or only r-gons); dual of truncate",
  },
  {
    symbol: "m / mn",
    name: "meta",
    summary: "Kis + ortho style triangulation; n ≥ 1",
  },
  {
    symbol: "o / on_m",
    name: "ortho",
    summary: "Dual of expand; kite faces from face centers to edge midpoints",
  },
  {
    symbol: "p",
    name: "propeller",
    summary: "n-gon propeller surrounded by n quads (self-dual)",
  },
  {
    symbol: "r",
    name: "reflect",
    summary: "Mirror chiral solids; no effect on reflexible ones",
  },
  {
    symbol: "s / sn",
    name: "snub",
    summary: "Chiral snub; all vertices 5-fold; n ≥ 1",
  },
  {
    symbol: "t / tr",
    name: "truncate",
    summary: "Cut off vertices (or only order-r vertices)",
  },
  {
    symbol: "w",
    name: "whirl",
    summary: "Gyro then truncate face-centers; hexagons along edges",
  },
  {
    symbol: "z",
    name: "zip",
    summary: "Bitruncation / dual of kis; edges “zipped” between faces",
  },
  {
    symbol: "n",
    name: "needle",
    summary: "Dual of truncate: bisect faces across vertices/edges",
  },
  {
    symbol: "q",
    name: "quinto",
    summary: "Ortho then truncate face centers → pentagons along edges",
  },
  {
    symbol: "u / un_m",
    name: "subdivide",
    summary: "Ambo retaining original vertices (Loop-like on triangles)",
  },
  {
    symbol: "l / l_n",
    name: "loft",
    summary: "Prism augmentation: smaller face + trapezoids; optional :r",
  },
  {
    symbol: "L / L_n",
    name: "lace",
    summary: "Antiprism augmentation with twist; optional :r",
  },
  {
    symbol: "L_0",
    name: "joined-lace",
    summary: "Lace without splitting the new quads",
  },
  {
    symbol: "B",
    name: "bowtie",
    summary: "Bowtie triangles dividing pentagonal faces",
  },
  {
    symbol: "E",
    name: "ethyl",
    summary: "Like expand, but triangles split into 3 kites",
  },
  {
    symbol: "G",
    name: "opposite-lace",
    summary: "Lace-like with opposite quad splits",
  },
  {
    symbol: "J",
    name: "joined-medial",
    summary: "Medial with rhombs replacing original edges",
  },
  {
    symbol: "K / Kr",
    name: "stake",
    summary: "Central quads + triangles on faces; optional r ≥ 3",
  },
  {
    symbol: "M / Mn",
    name: "medial",
    summary: "Like meta without diagonals (quads); n ≥ 1",
  },
  {
    symbol: "W",
    name: "waffle",
    summary: "Truncate all vertices, then section all faces",
  },
  {
    symbol: "X / Xn",
    name: "cross",
    summary: "Kis combined with subdivide; n ≥ 1",
  },
  {
    symbol: "S",
    name: "seed",
    summary: "Mark seed form in the notation string",
  },
  {
    symbol: "+",
    name: "orient +",
    summary: "Positive orientation mode (affects chiral ops)",
  },
  {
    symbol: "-",
    name: "orient −",
    summary: "Negative orientation mode",
  },
];
