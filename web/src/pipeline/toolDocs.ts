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

  import_file: {
    title: "import_file",
    blurb:
      "Seed the pipeline from an OFF or OBJ file on disk. The loaded geometry replaces any previous OFF in the stack (like polygon, it does not read stdin).",
    sections: [
      {
        heading: "Usage",
        entries: [
          {
            symbol: "Load file",
            summary: "Choose OFF or OBJ; the file contents are stored on this step.",
          },
          {
            symbol: "OFF file",
            summary: "Plain-text OFF (Geomview / Antiprism). Header must start with OFF.",
          },
          {
            symbol: "OBJ file",
            summary: "Wavefront OBJ; converted to OFF via Antiprism obj2off.",
          },
          {
            symbol: "Clear",
            summary: "Remove the loaded file from this step.",
          },
        ],
      },
    ],
  },

  conway_seed: {
    title: "conway_seed",
    blurb:
      "Start from a Conway seed only (T/C/O/I/D or Pn/An/Yn/Zn/Rn). Runs the Antiprism `conway` CLI with that seed and no operators.",
    sections: [
      {
        heading: "Seeds",
        entries: CONWAY_SEEDS.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          summary: s.summary,
        })),
      },
    ],
  },

  conway: {
    title: "conway",
    blurb:
      "Apply a stack of Conway operators to the previous OFF (stdin). Operators run top→bottom via `conway -r`. Put seeds in a separate conway_seed step.",
    sections: [
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

  zono: {
    title: "zono",
    blurb:
      "Make a zonohedron from a star of vectors (from the input model), or a polar zonohedron (-P).",
    sections: [
      {
        heading: "Star / polar",
        entries: [
          { symbol: "-m v|e|i|a", summary: "Star from vertices / edges / implicit / all pairs." },
          { symbol: "-c", summary: "Centre for method v (default origin; C = centroid)." },
          { symbol: "-u", summary: "Unit-length star vectors." },
          { symbol: "-P n|/d", summary: "Polar zonohedron from an offset polygon." },
          { symbol: "-S poly", summary: "Add zones onto a convex seed." },
        ],
      },
    ],
  },

  poly_kscope: {
    title: "poly_kscope",
    blurb:
      "Polyhedral kaleidoscope: repeat the input in a symmetric arrangement. Requires -s symmetry.",
    sections: [
      {
        heading: "Options",
        entries: [
          {
            symbol: "-s",
            summary: "Symmetry (Schoenflies), e.g. Ih, Oh, Th, D5h; optional subgroup/conjugation.",
          },
          { symbol: "-c vef", summary: "Colour elements per kaleidoscope part." },
          { symbol: "-y", summary: "Compound alignment to a subsymmetry (advanced)." },
        ],
      },
    ],
  },

  stellate: {
    title: "stellate",
    blurb:
      "Stellate a polyhedron using stellation diagram facelets. Works best on fullerenes / regular solids (e.g. after conway D).",
    sections: [
      {
        heading: "Options",
        entries: [
          {
            symbol: "-f",
            summary: "Base face index, then stellation-diagram face indexes (comma-separated).",
          },
          { symbol: "-s", summary: "Symmetry subgroup (Schoenflies)." },
          { symbol: "-R / -D", summary: "Resolve facelets / remove multiples." },
          { symbol: "-M / -I / -S", summary: "Skip merge / inline cleanup / pinched split." },
        ],
      },
    ],
  },

  leonardo: {
    title: "leonardo",
    blurb:
      "Thicken faces and cut centre holes (Leonardo-style panels). Width/height accept % of max.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-w", summary: "Perimeter border width (default 30%)." },
          { symbol: "-l", summary: "Extrusion height (default 100% of width)." },
          { symbol: "-p", summary: "Solid panels without holes." },
          { symbol: "-m", summary: "Distribute height equally on both sides." },
          { symbol: "-x / -e", summary: "Hide join edges / take colours from edges." },
        ],
      },
    ],
  },

  wythoff: {
    title: "wythoff",
    blurb:
      "Tile the meta-triangulated surface with a Wythoff-style path pattern (-p).",
    sections: [
      {
        heading: "Pattern",
        entries: [
          {
            symbol: "-p",
            summary: "[Coords…]Path… — barycentric V/E/F points and triangle steps (v/e/f).",
          },
          { symbol: "-a", summary: "Also add the meta-transformed base." },
          { symbol: "-u", summary: "One example of each tile type only." },
          { symbol: "-f ht", summary: "Lift face centres by height." },
        ],
      },
    ],
  },

  to_nfold: {
    title: "to_nfold",
    blurb:
      "Change rotational symmetry about z from m-fold to n-fold (or n/d). Pass the fraction as the first argument (e.g. 5 or 7/2).",
    sections: [
      {
        heading: "Args",
        entries: [
          { symbol: "n or n/d", summary: "Required positional fraction after flags." },
          { symbol: "-x idxs", summary: "Rings to flip 180° before/after processing." },
          { symbol: "-p", summary: "Transform a ring only (scale/translate); skips normal mode." },
        ],
      },
    ],
  },

  off_normals: {
    title: "off_normals",
    blurb: "Visualise face / edge / vertex normals as geometry (useful for debugging orientation).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-u", summary: "Unit normals." },
          { symbol: "-e", summary: "Connect normals to element centroids." },
          { symbol: "-s vef", summary: "Which elements to show normals for." },
          { symbol: "-p o|i|r", summary: "Force outward / inward / reverse polarity." },
          { symbol: "-i oih", summary: "Include outward / inward / hemispherical." },
        ],
      },
    ],
  },

  repel: {
    title: "repel",
    blurb:
      "Relax vertices under mutual repulsion. Always cap -n in the browser; use -z -1 to hide status.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-n", summary: "Max iterations (UI default 80; native default unlimited)." },
          { symbol: "-z", summary: "Status/termination reporting; -1 = quiet." },
          { symbol: "-r", summary: "Force exponent: 1/distance^exp (default 2)." },
          { symbol: "-s", summary: "Shorten travel distance (%)." },
          { symbol: "-N", summary: "Ignore input; start from N random points." },
        ],
      },
    ],
  },

  poly_form: {
    title: "poly_form",
    blurb:
      "Make face-regular models or unscramble graphs on a sphere/ellipsoid. Cap -n in the browser.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-a r|u|U|e|p", summary: "Regular faces / unscramble / equalise / planarise." },
          { symbol: "-n", summary: "Max iterations (UI default 80)." },
          { symbol: "-z -1", summary: "Quiet status reports." },
          { symbol: "-y", summary: "Maintain base symmetry (-a e/r/p)." },
          { symbol: "-s / -k / -f", summary: "Shorten / radius / flatten percentages." },
          { symbol: "-E", summary: "Ellipsoid axis lengths (optional power)." },
        ],
      },
    ],
  },

  off_color_radial: {
    title: "off_color_radial",
    blurb: "Colour faces in a radial pattern from symmetry axes (or append the axes).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-d radial|axes", summary: "Colour faces radially, or show axes." },
          { symbol: "-a", summary: "Axis order: primary / secondary / tertiary / all." },
          { symbol: "-s", summary: "Symmetry subgroup (Schoenflies)." },
          { symbol: "-f", summary: "Element index list as radial seeds (overrides -a)." },
          { symbol: "-r / -m / -c", summary: "Reverse map / colour maps / map stepping." },
        ],
      },
    ],
  },

  miller: {
    title: "miller",
    blurb:
      "Miller’s stellations of the icosahedron (list 1–75) plus later discoveries via cell strings.",
    sections: [
      {
        heading: "Args",
        entries: [
          { symbol: "1…75", summary: "Miller list number (number mode)." },
          { symbol: "m_…", summary: "Cell string mode (A–H, e1, f1, …), optional ,I / ,Ih." },
          { symbol: "-M", summary: "Merge stellation facelets (cell strings)." },
          { symbol: "-r", summary: "Rebuild compound to separate vertices." },
          { symbol: "-O s|d", summary: "Output stellation or diagram." },
        ],
      },
    ],
  },

  iso_delta: {
    title: "iso_delta",
    blurb: "Isohedral deltahedra (Shephard). Pick list 1–44 by number/name, or special compounds.",
    sections: [
      {
        heading: "Options",
        entries: [
          {
            symbol: "polyhedron",
            summary: "Pick from the `iso_delta -L` list (1–44) in the dropdown.",
          },
          { symbol: "-L", summary: "List models (source of the UI dropdown)." },
          { symbol: "-c a…q", summary: "Compound / special cases." },
          { symbol: "-d / -n", summary: "Dipyramid set with n/d (6/5 ≤ n/d ≤ 6)." },
          { symbol: "-t", summary: "Output a single triangle only." },
        ],
      },
    ],
  },

  iso_kite: {
    title: "iso_kite",
    blurb:
      "Isohedral kite-faced polyhedra from a Schwarz triangle (T1, O1, I1, …) or fractions A B C.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "model", summary: "Schwarz name or fractions; single fraction → trapezohedron." },
          { symbol: "-A / -B / -C", summary: "Kite vertex heights along OA / OB / OC." },
          { symbol: "-l", summary: "List compounds, or pick by list number." },
          { symbol: "-a / -N", summary: "Compound angle / number of parts." },
          { symbol: "-k / -q", summary: "Single kite only / quiet report." },
        ],
      },
    ],
  },

  symmetro: {
    title: "symmetro",
    blurb:
      "Symmetrohedra and twisters: regular polygons on symmetry axes (Kaplan–Hart, twister, S/C).",
    sections: [
      {
        heading: "Modes (pick one)",
        entries: [
          { symbol: "-k", summary: "Kaplan–Hart: s,l,m,n,a e.g. I,2,*,4,1." },
          { symbol: "-t", summary: "Twister: s[p,q]i,m1,m2 e.g. T[3,2],1,2." },
          { symbol: "-s / -c", summary: "S- or C-symmetry twisters." },
        ],
      },
      {
        heading: "Scene",
        entries: [
          { symbol: "-C", summary: "Convex hull: polygons / suppress / force / auto." },
          { symbol: "-x", summary: "Remove free faces." },
          { symbol: "-M x|y|z", summary: "Mirror (may create a compound)." },
        ],
      },
    ],
  },

  sph_rings: {
    title: "sph_rings",
    blurb: "Distribute points on latitude rings of a sphere (optionally stagger, omit poles).",
    sections: [
      {
        heading: "Args",
        entries: [
          { symbol: "num_rings", summary: "Rings between the poles." },
          { symbol: "num_divs", summary: "Points on each ring." },
          { symbol: "-s / -x", summary: "Stagger rings / omit polar points." },
        ],
      },
    ],
  },

  waterman: {
    title: "waterman",
    blurb: "Waterman polyhedra from SC / FCC / BCC lattice sphere clips. Cap -r in the browser.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "lattice", summary: "SC, FCC, or BCC." },
          { symbol: "-r", summary: "Clip radius (optional root n as r,n)." },
          { symbol: "-M 1|2", summary: "Sphere-ray or z-guess method." },
          { symbol: "-C c|i|s", summary: "Hull only / keep interior / suppress." },
          { symbol: "-f", summary: "Fill interior lattice points." },
        ],
      },
    ],
  },

  tetra59: {
    title: "tetra59",
    blurb:
      "59 sporadic tetrahedra with rational dihedral angles (Kedlaya et al.), from `tetra59 -L i`.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "1…59", summary: "Sporadic tetrahedron list number." },
          { symbol: "-d a…f", summary: "Dihedral-angle permutation." },
          { symbol: "-r / -z", summary: "Reflect / scale volume to 1." },
          { symbol: "-s / -a", summary: "Special infinite families + angle (advanced)." },
        ],
      },
    ],
  },

  bravais: {
    title: "bravais",
    blurb: "Generate Bravais lattices (14 types from `bravais -B`) as OFF point/cell models.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "1…14", summary: "Lattice index (or crystal system + centering)." },
          { symbol: "-g", summary: "Cell grid size (N or I,J,K)." },
          { symbol: "-u", summary: "Add cubic cell struts before transform." },
          { symbol: "-v / -a", summary: "Vector lengths / angles (advanced)." },
        ],
      },
    ],
  },

  unitile2d: {
    title: "unitile2d",
    blurb: "Uniform tilings mapped onto a plane, torus, Klein bottle, and other surfaces.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "pattern 1…11", summary: "Archimedean tiling pattern." },
          { symbol: "-s", summary: "Surface: plane, torus, Möbius, Klein, …" },
          { symbol: "-w / -l", summary: "Tiling width / height (keep small in-browser)." },
          { symbol: "-g", summary: "Use exact width×height (do not expand to tile)." },
        ],
      },
    ],
  },

  n_icons: {
    title: "n_icons",
    blurb: "Sphericon / streptohedron models. Keep -M longitudes modest in the browser.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-n n|/d", summary: "Order n (≥ 3); optional star denominator." },
          { symbol: "-t", summary: "Number of twists (can be negative)." },
          { symbol: "-M", summary: "Longitude resolution of the model." },
          { symbol: "-s / -H", summary: "Side-cut / hybrid (even order)." },
          { symbol: "-z 1|2|3", summary: "Construction method." },
        ],
      },
    ],
  },

  kcycle: {
    title: "kcycle",
    blurb:
      "Make a kaleidocycle from a polyhedron using two hinge edges (four vertex indexes).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "u,v,w,x", summary: "Hinge vertex indexes (positional)." },
          { symbol: "-i -", summary: "Read previous OFF from stdin (default in UI)." },
          { symbol: "-n", summary: "Number of polyhedron pairs in the cycle." },
          { symbol: "-a", summary: "Rotate first hinge from horizontal (degrees)." },
        ],
      },
    ],
  },

  lat_util: {
    title: "lat_util",
    blurb:
      "Lattice-style processing of OFF geometry: strip/keep faces, clip, struts, hull, Voronoi cells.",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-z", summary: "Keep faces (default UI on; native strips faces)." },
          { symbol: "-C c|i", summary: "Convex hull only / keep interior." },
          { symbol: "-c / -r", summary: "Cube/sphere container and radius." },
          { symbol: "-s", summary: "Add struts of given length." },
          { symbol: "-D c|i", summary: "Voronoi cells." },
        ],
      },
    ],
  },

  col_util: {
    title: "col_util",
    blurb: "Visualise colour maps as 3D plots, wheels, or grids (OFF geometry).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-m", summary: "Colour map name(s)." },
          { symbol: "-Z", summary: "Cap entries from open-ended maps (UI default 32)." },
          { symbol: "-d 1|2|3", summary: "Plot / wheel / grid output." },
          { symbol: "-M 1|2|3", summary: "HSV / HSL / RGB colour system." },
          { symbol: "-y / -c", summary: "RYB blend / CMY complementary mode." },
        ],
      },
    ],
  },

  off_report: {
    title: "off_report",
    blurb:
      "Print global measures, maxima, and counts for the current geometry (text; passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-S", summary: "Report sections (A G F E S a D s)." },
          { symbol: "-C", summary: "Value counts (A F E w S D s o …)." },
          { symbol: "-c", summary: "Centre: 0, C, or X,Y,Z." },
          { symbol: "-E", summary: "Edge set for the report." },
          { symbol: "-k", summary: "Keep orientation." },
        ],
      },
    ],
  },

  off_query: {
    title: "off_query",
    blurb:
      "List per-element data for vertices, edges, or faces (text; passes OFF through).",
    sections: [
      {
        heading: "Query",
        entries: [
          { symbol: "V…", summary: "Vertex values (c d f a n o g K …)." },
          { symbol: "E…", summary: "Edge values (v d f D a l c C K …)." },
          { symbol: "F…", summary: "Face values (v d n A N C a l s p P K …)." },
          { symbol: "-I", summary: "Element index ranges (default -)." },
        ],
      },
    ],
  },

  off2obj: {
    title: "off2obj",
    blurb: "Convert the current OFF to Wavefront OBJ text (passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-d", summary: "Significant digits." },
          {
            symbol: "note",
            summary: "Edge colours are not preserved in OBJ.",
          },
        ],
      },
    ],
  },

  off2crds: {
    title: "off2crds",
    blurb: "Extract vertex coordinates as text (passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-s", summary: "Coordinate separator." },
          { symbol: "-d", summary: "Significant digits." },
        ],
      },
    ],
  },

  off2pov: {
    title: "off2pov",
    blurb: "Convert the current OFF to a POV-Ray scene (text; passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-v / -e", summary: "Vertex sphere / edge cylinder radius." },
          { symbol: "-x", summary: "Hide v/e/f elements." },
          { symbol: "-O", summary: "a=all-in-one, o=objects, t=template." },
        ],
      },
    ],
  },

  off2vrml: {
    title: "off2vrml",
    blurb: "Convert the current OFF to VRML (text; passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-v / -e", summary: "Vertex sphere / edge cylinder radius." },
          { symbol: "-x", summary: "Hide v/e/f elements." },
        ],
      },
    ],
  },

  off2dae: {
    title: "off2dae",
    blurb: "Convert the current OFF to Collada DAE (text; passes OFF through).",
    sections: [
      {
        heading: "Options",
        entries: [
          { symbol: "-v / -e", summary: "Vertex sphere / edge cylinder radius." },
          { symbol: "-x", summary: "Hide v/e/f elements." },
          { symbol: "-K", summary: "Smoothing level for spheres/cylinders." },
          { symbol: "-d", summary: "Significant digits." },
        ],
      },
    ],
  },
};
