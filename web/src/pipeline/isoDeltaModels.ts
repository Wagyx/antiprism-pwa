/** Isohedral deltahedra list from `iso_delta -L` (Antiprism). */

export type IsoDeltaModel = {
  num: number;
  symbol: string;
  group: string;
  fractions: string;
  name: string;
};

export const ISO_DELTA_MODELS: IsoDeltaModel[] = [
  { num: 1, symbol: "T1(1)", group: "Oh", fractions: "[1/3,2/3,1/3]", name: "Augmented Cube (=O5(1))" },
  { num: 2, symbol: "T1(2)", group: "Oh", fractions: "[2/3,2/3,2/3]", name: "Excavated Cube (=O5(2))" },
  { num: 3, symbol: "T1(3)", group: "Td", fractions: "[1/3,2/3,1/3]", name: "Additonal Isomer of T1(1) (Mobius)" },
  { num: 4, symbol: "T2(1)", group: "Td", fractions: "[1/3,1/3,2/3]", name: "Augmented Tetrahedron" },
  { num: 5, symbol: "T2(2)", group: "Td", fractions: "[2/3,1/3,1/3]", name: "Tetrahedron" },
  { num: 6, symbol: "O1", group: "Oh", fractions: "[1/2,1/2,2/3]", name: "COMPOUND of 3 Octahedra (UD08)" },
  { num: 7, symbol: "O2(1)", group: "Oh", fractions: "[1/2,1/3,1/4]", name: "Relaxed Excavated Rhombic Dodecahedron (Mobius)" },
  { num: 8, symbol: "O2(2)", group: "Oh", fractions: "[1/2,1/3,1/4]", name: "Relaxed Augmented Rhombic Dodecahedron (Mobius)" },
  { num: 9, symbol: "O3", group: "Oh", fractions: "[1/2,1/4,2/4]", name: "COMPOUND of 3 8/3 Star Bipyramids" },
  { num: 10, symbol: "O4(1)", group: "Oh", fractions: "[1/3,1/3,2/3]", name: "COMPOUND of 2 Augmented Tetrahedra T2(1) (UC54_d)" },
  { num: 11, symbol: "O4(2)", group: "Oh", fractions: "[2/3,1/3,1/3]", name: "COMPOUND of 2 Tetrahedra (Stella Octangula UC04)" },
  { num: 12, symbol: "O5(1)", group: "Oh", fractions: "[1/3,2/3,1/3]", name: "Augmented Cube (=T1(1)) (Repeat of 1)" },
  { num: 13, symbol: "O5(2)", group: "Oh", fractions: "[2/3,2/3,2/3]", name: "Excavated Cube (=T1(2)) (Repeat of 2)" },
  { num: 14, symbol: "O5(3)", group: "Oh", fractions: "[1/3,2/3,1/3]", name: "COMPOUND of 2 T1(3)" },
  { num: 15, symbol: "O6(1)", group: "Oh", fractions: "[2/3,1/4,1/4]", name: "Augmented Octahedron" },
  { num: 16, symbol: "O6(2)", group: "Oh", fractions: "[2/3,3/4,3/4]", name: "Excavated Octahedron" },
  { num: 17, symbol: "O7", group: "Oh", fractions: "[2/4,2/4,2/4]", name: "Octahedron" },
  { num: 18, symbol: "I1(1)", group: "Ih", fractions: "[1/2,1/3,1/5]", name: "Relaxed Excavated Rhombic Triacontahedron (Mobius)" },
  { num: 19, symbol: "I1(2)", group: "Ih", fractions: "[1/2,1/3,1/5]", name: "Relaxed Augmented Rhombic Triacontahedron (Mobius)" },
  { num: 20, symbol: "I2(1)", group: "Ih", fractions: "[1/2,2/5,4/5]", name: "Relaxed Augmented Did (U36) *" },
  { num: 21, symbol: "I2(2)", group: "Ih", fractions: "[1/2,3/5,4/5]", name: "Relaxed Excavated Did (U36) *" },
  { num: 22, symbol: "I3(1)", group: "Ih", fractions: "[1/2,1/3,2/5]", name: "Relaxed Augmented Gid (U54) *" },
  { num: 23, symbol: "I3(2)", group: "Ih", fractions: "[1/2,1/3,2/5]", name: "Relaxed Excavated Gid (U54) *" },
  { num: 24, symbol: "I3(3)", group: "Ih", fractions: "[1/2,2/3,3/5]", name: "Relaxed Dual of Gaquatid (UD73) *" },
  { num: 25, symbol: "I3(4)", group: "Ih", fractions: "[1/2,2/3,2/5]", name: "Additional Isomer of Augmented RT I1(2) **" },
  { num: 26, symbol: "I4", group: "Ih", fractions: "[1/2,1/2,1/2]", name: "COMPOUND of 5 Octahedra (UC17)" },
  { num: 27, symbol: "I5(1)", group: "Ih", fractions: "[2/3,3/5,4/5]", name: "Relaxed Augmented Dual of Ditdid (UD41)" },
  { num: 28, symbol: "I5(2)", group: "Ih", fractions: "[1/3,2/5,4/5]", name: "Relaxed Excavated Dual of Ditdid (UD41)" },
  { num: 29, symbol: "I6(1)", group: "Ih", fractions: "[2/3,1/5,1/5]", name: "Augmented Icosahedron" },
  { num: 30, symbol: "I6(2)", group: "Ih", fractions: "[2/3,4/5,4/5]", name: "Excavated Icosahedron" },
  { num: 31, symbol: "I7(1)", group: "Ih", fractions: "[1/3,2/5,3/5]", name: "Excavated Gike (U53)" },
  { num: 32, symbol: "I7(2)", group: "Ih", fractions: "[2/3,2/5,3/5]", name: "Augmented Gike (U53)" },
  { num: 33, symbol: "I7(3)", group: "Ih", fractions: "[1/3,2/5,3/5]", name: "Additional Isomer of Augmented Icosahedron I6(1)" },
  { num: 34, symbol: "I8(1)", group: "Ih", fractions: "[1/3,1/3,4/5]", name: "Augmented Gissid (U52)" },
  { num: 35, symbol: "I8(2)", group: "Ih", fractions: "[1/3,1/3,4/5]", name: "Excavated Gissid (U52)" },
  { num: 36, symbol: "I9(1)", group: "Ih", fractions: "[1/3,1/3,2/5]", name: "Augmented Dodecahedron" },
  { num: 37, symbol: "I9(2)", group: "Ih", fractions: "[1/3,1/3,2/5]", name: "Excavated Dodecahedron" },
  { num: 38, symbol: "I9(3)", group: "Ih", fractions: "[1/3,1/3,2/5]", name: "Relaxed Excavated Dual of Sidtid (UD30)" },
  { num: 39, symbol: "I9(4)", group: "Ih", fractions: "[1/3,1/3,2/5]", name: "Relaxed Excavated Dual of Sidtid (UD30) (Repeat of 38)" },
  { num: 40, symbol: "I10(1)", group: "Ih", fractions: "[4/5,4/5,4/5]", name: "Great Icosahedron or Gike (U53)" },
  { num: 41, symbol: "I10(2)", group: "Ih", fractions: "[1/5,1/5,4/5]", name: "Augmented Sissid (U34)" },
  { num: 42, symbol: "I10(3)", group: "Ih", fractions: "[1/5,1/5,4/5]", name: "Augmented Sissid (U34) (Repeat 41)" },
  { num: 43, symbol: "I11(1)", group: "Ih", fractions: "[2/5,2/5,2/5]", name: "Icosahedron" },
  { num: 44, symbol: "I11(2)", group: "Ih", fractions: "[2/5,3/5,3/5]", name: "Excavated Gad (U35)" },
];

export const ISO_DELTA_MODEL_OPTIONS = [
  { value: "", label: "(none — use -c / -d)" },
  ...ISO_DELTA_MODELS.map((m) => ({
    value: String(m.num),
    label: `${m.num}) ${m.symbol} — ${m.name}`,
  })),
] as const;

