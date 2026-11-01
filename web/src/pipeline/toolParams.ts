import type { FlagsToolKind } from "./types";

export type ParamValue = string | number | boolean;

export type SelectOption = { value: string; label: string };

type FieldBase = {
  key: string;
  label: string;
  hint?: string;
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
      flag: string;
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

/** Build argv from structured params + schema. */
export function paramsToArgs(
  schema: ToolParamSchema,
  params: Record<string, ParamValue>,
): string[] {
  const args: string[] = [];
  for (const f of schema.fields) {
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
        args.push(f.flag, String(n));
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
};
