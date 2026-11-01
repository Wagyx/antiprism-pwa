The goal of this application is to load, build, view, browse and save polyhedra.

This application is a progressive web app using Node.js and works client side only.

The core geometry engine is based on [antiprism](https://antiprism.com/) which proposes a list of programs that generate, transform, apply various operations upon polyhedra.
It may be necessary to build a wasm version of antiprism.

Viewing the polyhedra is done using Three.js based on this viewer : 
https://asliceofcuriosity.fr/blog/extra/polyhedra-viewer-antiprism.html

The application has a library module that allows to load polyhedra in (OFF and OBJ file formats). It also allows to browse and search through the library. There is a default internal library and the user can create its own which is stored locally.

The application has an editor module that lets the user inspect the polyhedron in a 3D view and call the programs from antiprism. Some operations from antiprism can be piped like the geometry modifiers from Blender.


TODOS:
- github repo
- change logo
- Antiview Web
- library
- exporter (OBJ, …)
- importer (OBJ, WRL ?)
- undo/redo (history wired; UI buttons hidden)

## Antiprism tool support

Status of Antiprism CLIs (from `antiprism/src/*.1`) in the Wasm editor pipeline.
App-only seeds are listed separately.

| Status | Meaning |
|---|---|
| Done | Compiled into Wasm, wired in the stack UI (presets + docs) |
| Partial | Wasm and/or UI incomplete |
| Todo | Not started |
| N/A | Out of scope for the editor (viewer / format I/O handled elsewhere) |

### Seeds & pipeline tools

| Tool | Role | Status | Notes |
|---|---|---|---|
| `polygon` | Polygon-based polyhedra | Done | Seed |
| `import_off` | Load OFF from disk as seed | Done | App-native (not an Antiprism CLI) |
| `conway` | Conway notation | Done | |
| `geodesic` | Geodesic spheres / frequency | Done | |
| `off_color` | Colour V/E/F | Done | |
| `off_util` | OFF utilities (orient, sphere, …) | Done | |
| `off_trans` | Transforms | Done | |
| `pol_recip` | Duals / polar reciprocal | Done | |
| `canonical` | Planarize / canonicalize | Done | Iteration caps in UI |
| `conv_hull` | Convex hull (Qhull) | Done | Exit code = dimension |
| `planar` | Coplanar face tiling | Done | |
| `zono` | Zonohedra | Done | |
| `poly_kscope` | Polyhedral kaleidoscope | Done | |
| `stellate` | Stellations | Done | Prefer rich seeds (e.g. `conway D`) |
| `leonardo` | Leonardo-style panels | Done | |
| `wythoff` | Wythoff-style tilings | Done | |
| `to_nfold` | Change axial fold | Done | Positional `n` / `n/d` |
| `off_normals` | Normals as geometry | Done | |
| `repel` | Repelling points | Done | Caps `-n`; quiet `-z -1` |
| `poly_form` | Face-regular / unscramble | Done | Iteration caps in UI |
| `off_color_radial` | Radial colouring | Done | |
| `off_align` | Align / brick compound | Todo | Needs two geometries |
| `col_util` | Colour plots / blends | Todo | |
| `symmetro` | Regular polygons at axes | Done | |
| `miller` | Miller stellations (icosahedron) | Done | |
| `iso_delta` | Isohedral deltahedra | Done | |
| `iso_kite` | Isohedral kite-faced | Done | |
| `kcycle` | Kaleidocycle rings | Todo | Needs input + indices |
| `lat_util` | Lattice utilities | Todo | |
| `bravais` | Bravais / lattice models | Done | |
| `unitile2d` | Uniform tilings on a surface | Done | Keep -w/-l modest |
| `sph_rings` | Rings of points on a sphere | Done | |
| `n_icons` | n-icons | Todo | Large TU |
| `waterman` | Waterman polyhedra | Done | Cap -r in UI |
| `tetra59` | Tetra59 models | Done | List from `-L i` |
| `off_query` | List element data | Todo | Diagnostic / text-oriented |
| `off_report` | Global measures / counts | Todo | Diagnostic / text-oriented |

### Format converters & viewer

| Tool | Role | Status | Notes |
|---|---|---|---|
| `obj2off` | OBJ → OFF | Todo | Future importer |
| `off2obj` | OFF → OBJ | Todo | Future exporter |
| `off2crds` | OFF → coordinates | Todo | |
| `off2pov` | OFF → POV-Ray | Todo | |
| `off2vrml` | OFF → VRML | Todo | |
| `off2dae` | OFF → Collada | Todo | |
| `antiview` | Native OpenGL viewer | N/A | Replaced by Three.js viewer |

**Counts:** Done **30** Antiprism CLIs (+ `import_off`) · Todo **12** · N/A **1**
