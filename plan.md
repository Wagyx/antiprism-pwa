The goal of this application is to load, build, view, browse and save polyhedra.

This application is a progressive web app using Node.js and works client side only.

The core geometry engine is based on [antiprism](https://antiprism.com/) which proposes a list of programs that generate, transform, apply various operations upon polyhedra.
It may be necessary to build a wasm version of antiprism.

Viewing the polyhedra is done using Three.js based on this viewer : 
https://asliceofcuriosity.fr/blog/extra/polyhedra-viewer-antiprism.html

The application has a library manager module. This module allows the user to store and view polyhedra created by the editor.
- The library module let the user browse through the libraries. The user can create a new library or import one. Each library is a json file. The json file reflects the hierarchy of files and folders like a filesystem would.
- the json library files should not be deleted by the application at any point even when updating, this is very important. User needs to be able to trust the system and not loose their data.
- a library can be renamed, names are unique
- a library json file can be exported to the user computer
- all the output OFF files in a library can also be exported to a zip archive with the same folder hierarchy
- At each level in a library the folders, parent folder and entries appears as cards in a grid.
- each entry in the library stores the input file content (if any), the OFF output of the pipeline as well as the pipeline state and date of creation, date of modification.
- folders as well as entries can be renamed, deleted, created. Names are unique
- Each card shows the name, n_vertices, n_edges, n_faces.
- A search bar lets the user search by the out polyhedron properties (name, n_vertices, n_edges, n_faces for now, more later) but also by the antiprism command. the scope of the search is the current folder and subfolders. at the top level, the scope is all the libraries.
- at the top level, the first folder is MyLibrary by default, at this level a button Import library let the user import a json library next to the existing libraries
- entries have an edit button that opens it in the editor.
- the browsing lives on the right panel, the left panel shows a live view of the last selected entry (based on the output OFF, there is no need to rerun the whole pipeline)

TODOS Library
- Double clicking on an entry opens it in the editor, on a folder enters it instead of single clicking
- entry and folder can be moved to another folder or to parent folder
- multiple selection for moving entries and folders
- multiple selection for deletion (with a confirmation popup in red)
- Button New : dropdown to "Folder", "Polyhedron"
- Button Export at the libraries level : dropdown to "Export database", "Zip all OFF files"

The application has an editor module that lets the user inspect the polyhedron in a 3D view and call the programs from antiprism. Some operations from antiprism can be piped like the geometry modifiers from Blender.

Let's rework how commands are handled. The raw command pipeline created or loaded by the user is the source of truth. The stack in the editor splits and show the command line operations. Each element does show the command line which should in first instead of last. The text field should be editable. Then the inteface should reflect the fields that it supports and allow modifications back. Also store in the piepline the raw commands instead of the operations.
Also when creating a polyhedron from CLI, adds an input file for the starting polyhedron.

TODOS:
- save the raw cli in the json and create a mapper that auto fill in the gui parameters
- populate an example library based on the examples from the antiprism website
- move button
- dropdown buttons have uncecessary down arrow
- settings panel (nothing yet)
- undo/redo (history wired; UI buttons hidden)
- importer (WRL ?)

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
| `import_file` | Load OFF / OBJ from disk as seed | Done | App-native; OBJ via Wasm `obj2off` |
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
| `col_util` | Colour plots / blends | Done | Cap `-Z` in UI |
| `symmetro` | Regular polygons at axes | Done | |
| `miller` | Miller stellations (icosahedron) | Done | |
| `iso_delta` | Isohedral deltahedra | Done | |
| `iso_kite` | Isohedral kite-faced | Done | |
| `kcycle` | Kaleidocycle rings | Done | Uses `-i -` for stdin |
| `lat_util` | Lattice utilities | Done | |
| `bravais` | Bravais / lattice models | Done | |
| `unitile2d` | Uniform tilings on a surface | Done | Keep -w/-l modest |
| `sph_rings` | Rings of points on a sphere | Done | |
| `n_icons` | n-icons | Done | Cap `-M` in UI |
| `waterman` | Waterman polyhedra | Done | Cap -r in UI |
| `tetra59` | Tetra59 models | Done | List from `-L i` |
| `off_query` | List element data | Done | Text out; pass-through OFF |
| `off_report` | Global measures / counts | Done | Text out; pass-through OFF |

### Format converters & viewer

| Tool | Role | Status | Notes |
|---|---|---|---|
| `obj2off` | OBJ → OFF | Done | Used by `import_file` (not a separate stack tool) |
| `off2obj` | OFF → OBJ | Done | Text out + download; pass-through OFF |
| `off2crds` | OFF → coordinates | Done | Text out + download; pass-through OFF |
| `off2pov` | OFF → POV-Ray | Done | Text out + download; pass-through OFF |
| `off2vrml` | OFF → VRML | Done | Text out + download; pass-through OFF |
| `off2dae` | OFF → Collada | Done | Text out + download; pass-through OFF |
| `antiview` | Native OpenGL viewer | N/A | Replaced by Three.js viewer |

**Counts:** Done **42** Antiprism CLIs (+ `import_file`) · Todo **1** (`off_align`) · N/A **1**
