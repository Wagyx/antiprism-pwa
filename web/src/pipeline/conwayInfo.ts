/** Conway notation reference from Antiprism `conway -H`. */

export type ConwayInfoEntry = {
  symbol: string;
  name: string;
  summary: string;
};

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
