/** Bravais lattices from `bravais -B`. */

export type BravaisModel = { num: number; system: string; centering: string };

export const BRAVAIS_MODELS: BravaisModel[] = [
  { num: 1, system: "Triclinic", centering: "P" },
  { num: 2, system: "Monoclinic", centering: "P" },
  { num: 3, system: "Monoclinic", centering: "C" },
  { num: 4, system: "Orthorhombic", centering: "P" },
  { num: 5, system: "Orthorhombic", centering: "C" },
  { num: 6, system: "Orthorhombic", centering: "F" },
  { num: 7, system: "Orthorhombic", centering: "I" },
  { num: 8, system: "Tetragonal", centering: "P" },
  { num: 9, system: "Tetragonal", centering: "I" },
  { num: 10, system: "Trigonal", centering: "P" },
  { num: 11, system: "Hexagonal", centering: "P" },
  { num: 12, system: "Cubic", centering: "P" },
  { num: 13, system: "Cubic", centering: "F" },
  { num: 14, system: "Cubic", centering: "I" },
];

export const BRAVAIS_MODEL_OPTIONS = BRAVAIS_MODELS.map((m) => ({
  value: String(m.num),
  label: `${m.num}) ${m.system} ${m.centering}`,
}));

