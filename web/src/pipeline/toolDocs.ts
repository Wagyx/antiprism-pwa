import type { PipelineKind } from "./types";
import { CONWAY_OPERATORS, CONWAY_SEEDS } from "./conwayInfo";

export type DocEntry = {
  symbol: string;
  name?: string;
  summary: string;
};

export type DocSection = {
  heading: string;
  body?: string;
  entries?: DocEntry[];
};

export type ToolDoc = {
  title: string;
  blurb: string;
  sections: DocSection[];
};

export const TOOL_DOCS: Record<PipelineKind, ToolDoc> = {
  polygon: {
    title: "polygon",
    blurb:
      "Make polyhedra based on polygons. Arguments: type and num_sides. num_sides is N or N/D (star polygon step).",
    sections: [
      {
        heading: "Types",
        entries: [
          {
            symbol: "prism",
            summary: "Prisms; angle twists polygons (can form antiprism). Subtypes: antiprism, trapezohedron, crown.",
          },
          {
            symbol: "antiprism",
            summary: "Antiprisms. Subtypes: trapezohedron, antihermaphrodite, scalenohedron, crown.",
          },
          {
            symbol: "pyramid",
            summary: "Pyramids. Subtypes: antihermaphrodite, elongated, gyroelongated.",
          },
          {
            symbol: "dipyramid",
            summary: "Dipyramids. Subtypes: trapezohedron, elongated, gyroelongated, dipyramid_scalenohedron.",
          },
          {
            symbol: "cupola",
            summary: "Cupolas. Subtypes: elongated, gyroelongated, cupoloid.",
          },
          {
            symbol: "orthobicupola",
            summary: "Orthobicupolas. Subtypes: elongated, gyroelongated.",
          },
          {
            symbol: "gyrobicupola",
            summary: "Gyrobicupolas. Subtypes: elongated, gyroelongated.",
          },
          {
            symbol: "snub-antiprism",
            summary: "Snub antiprisms. Subtype: inverted (triangle band inverted).",
          },
          {
            symbol: "dihedron",
            summary: "Dihedra. Subtype: polygon.",
          },
          {
            symbol: "crown",
            summary: "Crown polyhedron; second step via -A or twist via -a.",
          },
        ],
      },
      {
        heading: "Options (CLI)",
        entries: [
          { symbol: "-s", summary: "Subtype number or name" },
          { symbol: "-e", summary: "Polygon edge length (default 1)" },
          { symbol: "-E", summary: "Non-polygon edge length" },
          { symbol: "-r", summary: "Polygon circumradius" },
          { symbol: "-R", summary: "Second radius" },
          { symbol: "-l", summary: "Height of upper vertices above base" },
          { symbol: "-L", summary: "Second height/length" },
          { symbol: "-a / -A", summary: "Twist angles in degrees" },
        ],
      },
    ],
  },

  conway: {
    title: "conway",
    blurb:
      "Conway polyhedron notation. Operators (usually lowercase) precede an optional capital seed. In a pipeline after another step, omit the seed — previous OFF is read from stdin.",
    sections: [
      {
        heading: "Seeds",
        entries: CONWAY_SEEDS.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          summary: s.summary,
        })),
      },
      {
        heading: "Operators",
        entries: CONWAY_OPERATORS.map((op) => ({
          symbol: op.symbol,
          name: op.name,
          summary: op.summary,
        })),
      },
    ],
  },

  geodesic: {
    title: "geodesic",
    blurb:
      "Read OFF and make a higher-frequency plane-faced polyhedron or geodesic sphere. Reads previous stack OFF from stdin.",
    sections: [
      {
        heading: "Options",
        entries: [
          {
            symbol: "-f",
            name: "frequency",
            summary:
              "Pattern frequency (positive integer, default 1): repeats of the pattern along an edge.",
          },
          {
            symbol: "-F",
            name: "step frequency",
            summary:
              "Final step frequency; for pattern m,n equals pattern_frequency/(m+n).",
          },
          {
            symbol: "-c",
            name: "class",
            summary:
              "Face division: 1 = Class I (default), 2 = Class II, or m,n for Class III (n,0 / 0,n → I; n,n → II).",
          },
          {
            symbol: "-M s",
            name: "sphere",
            summary:
              "Geodesic sphere (default): equal-angle edge divisions; vertices projected onto the unit sphere about the origin.",
          },
          {
            symbol: "-M p",
            name: "planar",
            summary:
              "Equal-length edge divisions; new vertices stay on the original surface.",
          },
          {
            symbol: "-C",
            name: "centre",
            summary: 'Centre as "x,y,z" (default 0,0,0) for geodesic spheres.',
          },
        ],
      },
    ],
  },

  off_color: {
    title: "off_color",
    blurb:
      "Add colours to an OFF model from stdin. Colour values: index integer; R,G,B[,A] (0–1 or 0–255); hex xFFFFFF; X11 name; invisible; none. Lowercase letters use indexes; uppercase use colour values (except l).",
    sections: [
      {
        heading: "Faces (-f)",
        entries: [
          { symbol: "value", summary: "Solid colour on all faces" },
          { symbol: "u / U", summary: "Unique colour per face" },
          { symbol: "p / P", summary: "Minimal proper colouring" },
          { symbol: "s / S", summary: "Symmetric colouring [,sub_group,conj_type]" },
          { symbol: "n / N", summary: "By number of sides" },
          { symbol: "a / A", summary: "By average internal angle (nearest degree)" },
          { symbol: "k / K", summary: "Connected face sets" },
          { symbol: "E / V", summary: "Average adjacent edge / vertex colour" },
          { symbol: "g / G", summary: "Gradient on normal z" },
          { symbol: "c / C", summary: "Gradient on centroid z" },
          { symbol: "L / l", summary: "Lighting by normal / centroid (see -l)" },
          { symbol: "M", summary: "Map existing colour indexes via colour map" },
        ],
      },
      {
        heading: "Edges (-e)",
        entries: [
          { symbol: "u / U", summary: "Unique colour" },
          { symbol: "p / P", summary: "Proper colouring" },
          { symbol: "s / S", summary: "Symmetric colouring" },
          { symbol: "n / N", summary: "By number of incident faces" },
          { symbol: "k / K", summary: "Connected edge sets" },
          { symbol: "F / V", summary: "Average adjacent face / vertex colour" },
          { symbol: "d / D", summary: "By edge direction" },
          { symbol: "j / J", summary: "By edge length [,min difference]" },
          { symbol: "g,G / c,C", summary: "Gradients on direction / centroid z" },
          { symbol: "L / l / M", summary: "Lighting / map indexes" },
        ],
      },
      {
        heading: "Vertices (-v)",
        entries: [
          { symbol: "u / U", summary: "Unique colour" },
          { symbol: "p / P", summary: "Proper colouring" },
          { symbol: "s / S", summary: "Symmetric colouring" },
          { symbol: "n / N", summary: "By vertex order" },
          { symbol: "a / A", summary: "By avg internal angle of vertex figure" },
          { symbol: "F / E", summary: "Average adjacent face / edge colour" },
          { symbol: "c / C", summary: "Gradient on z" },
          { symbol: "L / M", summary: "Lighting / map indexes" },
        ],
      },
      {
        heading: "Other options",
        entries: [
          {
            symbol: "-E",
            summary: "Edge type for colouring: e explicit, i implicit, I implicit-only",
          },
          { symbol: "-l", summary: "Lights OFF file for type L" },
          { symbol: "-m", summary: "Colour maps (default spread); optional vef selector" },
          { symbol: "-r", summary: "Map HSVA onto ranges after processing" },
          { symbol: "-I", summary: "Map colour values to indexes for v,e,f" },
          { symbol: "-U", summary: "Only colour unset/indexed/visible/invisible types" },
        ],
      },
    ],
  },

  off_util: {
    title: "off_util",
    blurb:
      "Combine/process OFF geometry from stdin. Flags run in the order given. Useful for skeletonise, orient, sphere project, triangulate, merge, etc.",
    sections: [
      {
        heading: "Common flags",
        entries: [
          {
            symbol: "-M",
            summary:
              "Merge coincident elements: v/e/f/a/b/s [,blend 1–4]. Precision via -l.",
          },
          {
            symbol: "-l",
            summary: "Merge distance as negative exponent (default 12 → 1e-12).",
          },
          {
            symbol: "-O",
            summary: "Orient: positive | negative | reverse | flip.",
          },
          {
            symbol: "-T",
            summary: "Truncate vertices at edge ratio [,vertex order].",
          },
          { symbol: "-s", summary: "Skeleton: keep face edges, drop faces." },
          {
            symbol: "-t",
            summary: "Triangulate; winding: odd, nonzero, positive, negative.",
          },
          {
            symbol: "-g",
            summary: "Geometry only: strip colours and decorative edges.",
          },
          {
            symbol: "-x",
            summary: "Remove elements: v,e,f,V,E,D,F (processed in order).",
          },
          { symbol: "-e", summary: "Fill in missing explicit edges." },
          {
            symbol: "-D / -K",
            summary: "Delete / keep element lists (indexes, connectivity, colour selectors).",
          },
          { symbol: "-A", summary: "Add vertex/edge/face data [:colour]." },
          { symbol: "-c", summary: "Close holes as faces with colour." },
          { symbol: "-S", summary: "Project onto unit sphere at origin." },
          {
            symbol: "-u",
            summary: "Unfold net: base face, dihedral fraction, optional f/z.",
          },
          {
            symbol: "-d",
            summary: "Significant digits (default 16); negative = digits after decimal.",
          },
        ],
      },
    ],
  },

  off_trans: {
    title: "off_trans",
    blurb:
      "Apply geometric transforms to OFF from stdin: translate, rotate, reflect, scale, invert, matrices.",
    sections: [
      {
        heading: "Transforms",
        entries: [
          { symbol: "-T x,y,z", summary: "Translate by displacement." },
          {
            symbol: "-R …",
            summary:
              "Rotate: 3 angles (xyz°), or axis+angle (4), or from→to vectors (6/12).",
          },
          { symbol: "-M x,y,z", summary: "Reflect in plane with this normal." },
          {
            symbol: "-S …",
            summary: "Scale: one factor, xyz factors, or direction+factor.",
          },
          { symbol: "-I", summary: "Inversion through the origin." },
          { symbol: "-X mtrx", summary: "Premultiply by 9- or 12-value matrix." },
          { symbol: "-C", summary: "Translate so centroid is at the origin." },
          { symbol: "-s r|e|…", summary: "Normalise size (radius / edge / …)." },
        ],
      },
    ],
  },

  pol_recip: {
    title: "pol_recip",
    blurb:
      "Polar reciprocal (dual): faces become vertices from face planes. Centre and radius control the dual geometry.",
    sections: [
      {
        heading: "Centre (-c)",
        entries: [
          { symbol: "C", summary: "Vertex centroid (default)." },
          { symbol: "0 / X,Y,Z", summary: "Origin or explicit centre." },
          { symbol: "M", summary: "Approximate mid-sphere." },
          { symbol: "R", summary: "Circumcentre (average)." },
          { symbol: "e / E", summary: "Edge balanced (+ invert)." },
          { symbol: "v / V", summary: "Vert/face balanced (+ invert)." },
          { symbol: "a / A", summary: "V/f/e balanced (+ invert)." },
        ],
      },
      {
        heading: "Other",
        entries: [
          {
            symbol: "-r",
            summary: "Radius: value, or v/V/e/E/f/F nearest/furthest distances.",
          },
          { symbol: "-i", summary: "Reflect dual through the centre." },
          { symbol: "-n / -l", summary: "Iteration cap / convergence limit." },
        ],
      },
    ],
  },

  canonical: {
    title: "canonical",
    blurb:
      "Planarize or canonicalize a polyhedron (George Hart algorithms). Cap -n/-i in the browser so iteration cannot hang.",
    sections: [
      {
        heading: "Modes",
        entries: [
          {
            symbol: "-p p|m|…",
            summary: "Planarize only (or before -c). Methods include poly_form, mathematica.",
          },
          {
            symbol: "-c c|m|…",
            summary: "Canonicalize (circle packing / mathematica / …).",
          },
          {
            symbol: "-n / -i",
            summary: "Max iterations for canonicalize / planarize (UI default 80).",
          },
          {
            symbol: "-l",
            summary: "Convergence limit as negative exponent (default 12).",
          },
          {
            symbol: "-e s",
            summary: "Project vertices onto a sphere (canonicalization).",
          },
          {
            symbol: "-t b|p|c",
            summary: "Work on base, dual (planarize), or dual (full).",
          },
        ],
      },
    ],
  },

  conv_hull: {
    title: "conv_hull",
    blurb: "Replace the model with its convex hull (Qhull), or append the hull to the input.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "(none)", summary: "Output the convex hull only." },
          { symbol: "-a", summary: "Append hull faces/verts to the input model." },
          { symbol: "-Q args", summary: "Extra Qhull args (unsupported / experimental)." },
        ],
      },
    ],
  },

  planar: {
    title: "planar",
    blurb:
      "Convert overlapping coplanar polygons into non-overlapping tiles (or merge adjacent coplanar faces).",
    sections: [
      {
        heading: "Scene",
        entries: [
          {
            symbol: "-d 1|2",
            summary: "1 = tile overlapping faces; 2 = merge adjacent coplanar.",
          },
          {
            symbol: "-p 1–5",
            summary: "Fill algorithm: angular, modulo2, triangulation, …",
          },
          { symbol: "-S", summary: "Stitch seams after tiling/merging." },
          { symbol: "-R", summary: "Split pinched faces." },
          { symbol: "-r", summary: "Rebuild compound model (separate vertices)." },
          { symbol: "-I", summary: "Remove extra in-line face vertices." },
          {
            symbol: "-e / -E",
            summary: "Blend / rebuild explicit edges from face colours.",
          },
        ],
      },
    ],
  },
};
