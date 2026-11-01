import { ISO_DELTA_MODEL_OPTIONS } from "./isoDeltaModels";
import type { FlagsToolKind } from "./types";

export type ParamValue = string | number | boolean;

export type SelectOption = { value: string; label: string };

type FieldBase = {
  key: string;
  label: string;
  hint?: string;
  /** Show in UI only when params[key] === equals. */
  visibleWhen?: { key: string; equals: string | number | boolean };
  /** UI control only — never serialized to argv. */
  uiOnly?: boolean;
};

export type ParamField =
  | (FieldBase & {
      type: "bool";
      /** Flag emitted when true (e.g. "-S"). */
      flag: string;
      default: boolean;
    })
  | (FieldBase & {
      type: "number";
      /** If set, emit `flag value`; if omitted, value is positional. */
      flag?: string;
      default: number;
      min?: number;
      max?: number;
      step?: number;
    })
  | (FieldBase & {
      type: "text";
      /** If set, emit `flag value`; if omitted, value is positional. */
      flag?: string;
      default: string;
      placeholder?: string;
    })
  | (FieldBase & {
      type: "select";
      flag?: string;
      options: SelectOption[];
      default: string;
      /** When true, empty value omits the flag entirely. */
      omitIfEmpty?: boolean;
    });

export type ToolParamSchema = {
  fields: ParamField[];
};

export function defaultParams(schema: ToolParamSchema): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const f of schema.fields) out[f.key] = f.default;
  return out;
}

export function isFieldVisible(
  field: ParamField,
  params: Record<string, ParamValue>,
): boolean {
  if (!field.visibleWhen) return true;
  const cur = params[field.visibleWhen.key];
  return cur === field.visibleWhen.equals;
}

/** Build argv from structured params + schema. */
export function paramsToArgs(
  schema: ToolParamSchema,
  params: Record<string, ParamValue>,
): string[] {
  const args: string[] = [];
  for (const f of schema.fields) {
    if (f.uiOnly) continue;
    if (!isFieldVisible(f, params)) continue;
    const raw = params[f.key] ?? f.default;
    switch (f.type) {
      case "bool":
        if (raw === true) {
          // Support multi-token flags like "-z -1"
          args.push(...f.flag.split(/\s+/).filter(Boolean));
        }
        break;
      case "number": {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) break;
        if (f.flag) args.push(f.flag, String(n));
        else args.push(String(n));
        break;
      }
      case "text": {
        const s = String(raw ?? "").trim();
        if (!s) break;
        if (f.flag) args.push(f.flag, s);
        else args.push(s);
        break;
      }
      case "select": {
        const s = String(raw ?? "");
        if (f.omitIfEmpty && !s) break;
        if (f.flag) {
          if (s) args.push(f.flag, s);
        } else if (s) {
          args.push(s);
        }
        break;
      }
    }
  }
  return args;
}

export function paramsSummary(
  schema: ToolParamSchema,
  params: Record<string, ParamValue>,
): string {
  const args = paramsToArgs(schema, params);
  return args.length ? args.join(" ") : "(defaults)";
}

const ON_OFF = [
  { value: "", label: "(off)" },
  { value: "positive", label: "positive" },
  { value: "negative", label: "negative" },
  { value: "reverse", label: "reverse" },
  { value: "flip", label: "flip" },
];

export const TOOL_PARAM_SCHEMAS: Record<FlagsToolKind, ToolParamSchema> = {
  off_util: {
    fields: [
      { key: "skeleton", type: "bool", label: "Skeleton (-s)", flag: "-s", default: false },
      { key: "sphere", type: "bool", label: "Unit sphere (-S)", flag: "-S", default: true },
      {
        key: "orient",
        type: "select",
        label: "Orient (-O)",
        flag: "-O",
        omitIfEmpty: true,
        default: "positive",
        options: ON_OFF,
      },
      {
        key: "triangulate",
        type: "select",
        label: "Triangulate (-t)",
        flag: "-t",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(off)" },
          { value: "odd", label: "odd" },
          { value: "nonzero", label: "nonzero" },
          { value: "positive", label: "positive" },
          { value: "negative", label: "negative" },
        ],
      },
      {
        key: "merge",
        type: "select",
        label: "Merge (-M)",
        flag: "-M",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(off)" },
          { value: "a", label: "a — all" },
          { value: "v", label: "v — vertices" },
          { value: "e", label: "e — edges" },
          { value: "f", label: "f — faces" },
        ],
      },
      { key: "geometryOnly", type: "bool", label: "Geometry only (-g)", flag: "-g", default: false },
      { key: "fillEdges", type: "bool", label: "Fill edges (-e)", flag: "-e", default: false },
    ],
  },

  off_trans: {
    fields: [
      {
        key: "scale",
        type: "text",
        label: "Scale (-S)",
        flag: "-S",
        default: "1.5",
        placeholder: "1.5  or  1,2,1",
      },
      {
        key: "rotate",
        type: "text",
        label: "Rotate ° (-R)",
        flag: "-R",
        default: "",
        placeholder: "0,0,45",
      },
      {
        key: "translate",
        type: "text",
        label: "Translate (-T)",
        flag: "-T",
        default: "",
        placeholder: "0,0,1",
      },
      {
        key: "reflect",
        type: "text",
        label: "Reflect normal (-M)",
        flag: "-M",
        default: "",
        placeholder: "0,0,1",
      },
      { key: "invert", type: "bool", label: "Invert (-I)", flag: "-I", default: false },
      {
        key: "normalize",
        type: "select",
        label: "Normalize size (-s)",
        flag: "-s",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(off)" },
          { value: "r", label: "r — radius" },
          { value: "e", label: "e — edge" },
        ],
      },
    ],
  },

  pol_recip: {
    fields: [
      {
        key: "centre",
        type: "select",
        label: "Centre (-c)",
        flag: "-c",
        default: "C",
        options: [
          { value: "C", label: "C — centroid" },
          { value: "0", label: "0 — origin" },
          { value: "M", label: "M — mid-sphere" },
          { value: "R", label: "R — circumcentre" },
          { value: "e", label: "e — edge balanced" },
          { value: "E", label: "E — edge balanced + invert" },
          { value: "v", label: "v — vert/face balanced" },
          { value: "V", label: "V — vert/face + invert" },
          { value: "a", label: "a — v/f/e balanced" },
          { value: "A", label: "A — v/f/e + invert" },
        ],
      },
      { key: "invert", type: "bool", label: "Invert dual (-i)", flag: "-i", default: false },
      {
        key: "radius",
        type: "text",
        label: "Radius (-r)",
        flag: "-r",
        default: "",
        placeholder: "value or v/V/e/E/f/F",
      },
    ],
  },

  canonical: {
    fields: [
      {
        key: "planarize",
        type: "select",
        label: "Planarize (-p)",
        flag: "-p",
        omitIfEmpty: true,
        default: "p",
        options: [
          { value: "", label: "(off)" },
          { value: "p", label: "p — poly_form" },
          { value: "m", label: "m — mathematica" },
        ],
      },
      {
        key: "canonicalize",
        type: "select",
        label: "Canonicalize (-c)",
        flag: "-c",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(off)" },
          { value: "c", label: "c — circle" },
          { value: "m", label: "m — mathematica" },
        ],
      },
      {
        key: "nIters",
        type: "number",
        label: "Max iters (-n)",
        flag: "-n",
        default: 80,
        min: 1,
        max: 5000,
      },
      {
        key: "iIters",
        type: "number",
        label: "Planarize iters (-i)",
        flag: "-i",
        default: 80,
        min: 1,
        max: 5000,
      },
      {
        key: "sphere",
        type: "bool",
        label: "Project on sphere (-e s)",
        flag: "-e s",
        default: false,
      },
    ],
  },

  conv_hull: {
    fields: [
      { key: "append", type: "bool", label: "Append hull to input (-a)", flag: "-a", default: false },
    ],
  },

  planar: {
    fields: [
      {
        key: "blend",
        type: "select",
        label: "Blend (-d)",
        flag: "-d",
        omitIfEmpty: true,
        default: "1",
        options: [
          { value: "", label: "(off)" },
          { value: "1", label: "1 — tile overlapping" },
          { value: "2", label: "2 — merge coplanar" },
        ],
      },
      {
        key: "fill",
        type: "select",
        label: "Fill algorithm (-p)",
        flag: "-p",
        default: "1",
        options: [
          { value: "1", label: "1 — angular" },
          { value: "2", label: "2 — modulo2" },
          { value: "3", label: "3 — triangulation" },
          { value: "4", label: "4 — even_overlap" },
          { value: "5", label: "5 — alt_modulo2" },
        ],
      },
      { key: "stitch", type: "bool", label: "Stitch seams (-S)", flag: "-S", default: false },
      { key: "splitPinched", type: "bool", label: "Split pinched (-R)", flag: "-R", default: false },
      { key: "rebuild", type: "bool", label: "Rebuild compound (-r)", flag: "-r", default: false },
    ],
  },

  zono: {
    fields: [
      {
        key: "method",
        type: "select",
        label: "Star method (-m)",
        flag: "-m",
        omitIfEmpty: true,
        default: "v",
        options: [
          { value: "", label: "(omit — use polar)" },
          { value: "v", label: "v — centre→vertices" },
          { value: "e", label: "e — explicit edges" },
          { value: "i", label: "i — implicit edges" },
          { value: "a", label: "a — all vertex pairs" },
        ],
      },
      {
        key: "polar",
        type: "text",
        label: "Polar (-P)",
        flag: "-P",
        default: "",
        placeholder: "5  or  7/2",
        hint: "If set, builds a polar zonohedron (star method optional).",
      },
      { key: "unit", type: "bool", label: "Unit vectors (-u)", flag: "-u", default: false },
      {
        key: "centre",
        type: "text",
        label: "Centre (-c)",
        flag: "-c",
        default: "",
        placeholder: "0,0,0  or  C",
      },
    ],
  },

  poly_kscope: {
    fields: [
      {
        key: "symmetry",
        type: "select",
        label: "Symmetry (-s)",
        flag: "-s",
        default: "Ih",
        options: [
          { value: "Ih", label: "Ih" },
          { value: "Oh", label: "Oh" },
          { value: "Th", label: "Th" },
          { value: "I", label: "I" },
          { value: "O", label: "O" },
          { value: "T", label: "T" },
          { value: "D5h", label: "D5h" },
          { value: "D5d", label: "D5d" },
          { value: "D3h", label: "D3h" },
          { value: "C5v", label: "C5v" },
        ],
      },
      {
        key: "colour",
        type: "text",
        label: "Colour parts (-c)",
        flag: "-c",
        default: "",
        placeholder: "vef",
      },
    ],
  },

  stellate: {
    fields: [
      {
        key: "faces",
        type: "text",
        label: "Faces (-f)",
        flag: "-f",
        default: "0,1",
        placeholder: "0,1",
      },
      {
        key: "symmetry",
        type: "text",
        label: "Subgroup (-s)",
        flag: "-s",
        default: "",
        placeholder: "Ih",
      },
      { key: "resolve", type: "bool", label: "Resolve (-R)", flag: "-R", default: false },
      { key: "dedupe", type: "bool", label: "Remove multiples (-D)", flag: "-D", default: false },
      { key: "noMerge", type: "bool", label: "Do not merge (-M)", flag: "-M", default: false },
    ],
  },

  leonardo: {
    fields: [
      {
        key: "width",
        type: "text",
        label: "Border width (-w)",
        flag: "-w",
        default: "30%",
        placeholder: "30%",
      },
      {
        key: "height",
        type: "text",
        label: "Height (-l)",
        flag: "-l",
        default: "",
        placeholder: "100%",
      },
      { key: "panels", type: "bool", label: "Panels, no holes (-p)", flag: "-p", default: false },
      { key: "midplane", type: "bool", label: "Mid-plane height (-m)", flag: "-m", default: false },
      { key: "hideJoins", type: "bool", label: "Hide join edges (-x)", flag: "-x", default: false },
      { key: "fromEdges", type: "bool", label: "Colours from edges (-e)", flag: "-e", default: false },
    ],
  },

  wythoff: {
    fields: [
      {
        key: "pattern",
        type: "text",
        label: "Pattern (-p)",
        flag: "-p",
        default: "[V]0e,0e,0e",
        placeholder: "[V]0e,0e,0e",
      },
      { key: "addMeta", type: "bool", label: "Add meta base (-a)", flag: "-a", default: false },
      { key: "unique", type: "bool", label: "Unique tiles only (-u)", flag: "-u", default: false },
      {
        key: "lift",
        type: "text",
        label: "Lift face centres (-f)",
        flag: "-f",
        default: "",
        placeholder: "0.1",
      },
    ],
  },

  to_nfold: {
    fields: [
      {
        key: "fraction",
        type: "text",
        label: "Fold (n or n/d)",
        default: "5",
        placeholder: "5  or  7/2",
        hint: "Positional argument — required.",
      },
    ],
  },

  off_normals: {
    fields: [
      { key: "unit", type: "bool", label: "Unit normals (-u)", flag: "-u", default: true },
      { key: "centroids", type: "bool", label: "To centroids (-e)", flag: "-e", default: true },
      {
        key: "elements",
        type: "select",
        label: "Elements (-s)",
        flag: "-s",
        default: "f",
        options: [
          { value: "f", label: "f — faces" },
          { value: "v", label: "v — vertices" },
          { value: "e", label: "e — edges" },
          { value: "vef", label: "vef — all" },
          { value: "vf", label: "vf" },
          { value: "ef", label: "ef" },
        ],
      },
      {
        key: "polarity",
        type: "select",
        label: "Polarity (-p)",
        flag: "-p",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(natural)" },
          { value: "o", label: "o — outward" },
          { value: "i", label: "i — inward" },
          { value: "r", label: "r — reverse" },
        ],
      },
    ],
  },

  repel: {
    fields: [
      {
        key: "iterations",
        type: "number",
        label: "Max iterations (-n)",
        flag: "-n",
        default: 80,
        min: 1,
        max: 2000,
      },
      {
        key: "quiet",
        type: "bool",
        label: "Quiet status (-z -1)",
        flag: "-z -1",
        default: true,
      },
      {
        key: "exponent",
        type: "number",
        label: "Force exponent (-r)",
        flag: "-r",
        default: 2,
        min: 0.5,
        max: 8,
        step: 0.5,
      },
    ],
  },

  poly_form: {
    fields: [
      {
        key: "algorithm",
        type: "select",
        label: "Algorithm (-a)",
        flag: "-a",
        default: "r",
        options: [
          { value: "r", label: "r — regular faces" },
          { value: "u", label: "u — unscramble" },
          { value: "U", label: "U — continue unscramble" },
          { value: "e", label: "e — equalise edges" },
          { value: "p", label: "p — planarise" },
        ],
      },
      {
        key: "iterations",
        type: "number",
        label: "Max iterations (-n)",
        flag: "-n",
        default: 80,
        min: 1,
        max: 5000,
      },
      {
        key: "quiet",
        type: "bool",
        label: "Quiet status (-z -1)",
        flag: "-z -1",
        default: true,
      },
      {
        key: "keepSymmetry",
        type: "bool",
        label: "Keep symmetry (-y)",
        flag: "-y",
        default: false,
      },
      {
        key: "shorten",
        type: "number",
        label: "Shorten % (-s)",
        flag: "-s",
        default: 1,
        min: 0.01,
        max: 50,
        step: 0.1,
      },
    ],
  },

  off_color_radial: {
    fields: [
      {
        key: "method",
        type: "select",
        label: "Colouring (-d)",
        flag: "-d",
        default: "radial",
        options: [
          { value: "radial", label: "radial" },
          { value: "axes", label: "axes" },
        ],
      },
      {
        key: "axis",
        type: "select",
        label: "Axis (-a)",
        flag: "-a",
        default: "1",
        options: [
          { value: "1", label: "1 — primary" },
          { value: "2", label: "2 — secondary" },
          { value: "3", label: "3 — tertiary" },
          { value: "4", label: "4 — all" },
        ],
      },
      {
        key: "symmetry",
        type: "text",
        label: "Subgroup (-s)",
        flag: "-s",
        default: "",
        placeholder: "Ih",
      },
      { key: "reverse", type: "bool", label: "Reverse map (-r)", flag: "-r", default: false },
    ],
  },

  miller: {
    fields: [
      {
        key: "modelMode",
        type: "select",
        label: "Model mode",
        uiOnly: true,
        default: "number",
        options: [
          { value: "number", label: "List number (1–75)" },
          { value: "cells", label: "Cell string (m_…)" },
        ],
      },
      {
        key: "listNum",
        type: "number",
        label: "List number",
        default: 1,
        min: 1,
        max: 75,
        visibleWhen: { key: "modelMode", equals: "number" },
      },
      {
        key: "cellString",
        type: "text",
        label: "Cell string",
        default: "m_A",
        placeholder: "m_De1f1g1",
        hint: "Starts with m_; cells A–H, e1, f1, … optional ,I / ,Ih.",
        visibleWhen: { key: "modelMode", equals: "cells" },
      },
      { key: "merge", type: "bool", label: "Merge facelets (-M)", flag: "-M", default: false },
      {
        key: "rebuild",
        type: "bool",
        label: "Rebuild compound (-r)",
        flag: "-r",
        default: false,
      },
    ],
  },

  iso_delta: {
    fields: [
      {
        key: "polyhedron",
        type: "select",
        label: "Polyhedron",
        omitIfEmpty: true,
        default: "1",
        options: [...ISO_DELTA_MODEL_OPTIONS],
        hint: "From `iso_delta -L`. Choose none when using -c / -d only.",
      },
      {
        key: "compound",
        type: "select",
        label: "Compound (-c)",
        flag: "-c",
        omitIfEmpty: true,
        default: "",
        options: [
          { value: "", label: "(off — use polyhedron)" },
          { value: "a", label: "a — k tetrahedra" },
          { value: "b", label: "b — 5/10 tetrahedra" },
          { value: "d", label: "d — 6 octahedra" },
          { value: "g", label: "g — 2 tetrahedra" },
          { value: "i", label: "i — 6 tetrahedra" },
          { value: "j", label: "j — 12 tetrahedra" },
        ],
      },
      {
        key: "dipyramid",
        type: "bool",
        label: "Dipyramid set (-d)",
        flag: "-d",
        default: false,
      },
      {
        key: "fraction",
        type: "text",
        label: "n/d (-n)",
        flag: "-n",
        default: "",
        placeholder: "5/2",
      },
      { key: "triangleOnly", type: "bool", label: "Triangle only (-t)", flag: "-t", default: false },
    ],
  },

  iso_kite: {
    fields: [
      {
        key: "model",
        type: "text",
        label: "Model (Schwarz / fractions)",
        default: "I1",
        placeholder: "I1  or  5 3 2",
        hint: "Positional — T1/O1/I1… or fractions A B C.",
      },
      {
        key: "heightA",
        type: "text",
        label: "Height A (-A)",
        flag: "-A",
        default: "",
        placeholder: "1.0",
      },
      {
        key: "heightB",
        type: "text",
        label: "Height B (-B)",
        flag: "-B",
        default: "",
        placeholder: "1.0",
      },
      {
        key: "heightC",
        type: "text",
        label: "Height C (-C)",
        flag: "-C",
        default: "",
        placeholder: "1.0",
      },
      { key: "quiet", type: "bool", label: "Quiet (-q)", flag: "-q", default: true },
    ],
  },

  symmetro: {
    fields: [
      {
        key: "kaplan",
        type: "text",
        label: "Kaplan–Hart (-k)",
        flag: "-k",
        default: "I,2,*,4,1",
        placeholder: "I,2,*,4,1",
        hint: "One of -k / -t / -s / -c required. Clear others.",
      },
      {
        key: "twister",
        type: "text",
        label: "Twister (-t)",
        flag: "-t",
        default: "",
        placeholder: "T[3,2],1,2",
      },
      {
        key: "sTwister",
        type: "text",
        label: "S twister (-s)",
        flag: "-s",
        default: "",
        placeholder: "5/2",
      },
      {
        key: "cTwister",
        type: "text",
        label: "C twister (-c)",
        flag: "-c",
        default: "",
        placeholder: "5,5,c",
      },
      {
        key: "hull",
        type: "select",
        label: "Convex hull (-C)",
        flag: "-C",
        default: "4",
        options: [
          { value: "1", label: "1 — polygons" },
          { value: "2", label: "2 — suppress" },
          { value: "3", label: "3 — force" },
          { value: "4", label: "4 — auto" },
        ],
      },
      {
        key: "removeFreeFaces",
        type: "bool",
        label: "Remove free faces (-x)",
        flag: "-x",
        default: false,
      },
    ],
  },
};
