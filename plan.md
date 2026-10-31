The goal of this application is to load, build, view, browse and save polyhedra.

This application is a progressive web app using Node.js and works client side only.

The core geometry engine is based on [antiprism](https://antiprism.com/) which proposes a list of programs that generate, transform, apply various operations upon polyhedra.
It may be necessary to build a wasm version of antiprism.

Viewing the polyhedra is done using Three.js based on this viewer : 
https://asliceofcuriosity.fr/blog/extra/polyhedra-viewer-antiprism.html

The application has a library module that allows to load polyhedra in (OFF and OBJ file formats). It also allows to browse and search through the library. There is a default internal library and the user can create its own which is stored locally.

The application has an editor module that lets the user inspect the polyhedron in a 3D view and call the programs from antiprism. Some operations from antiprism can be piped like the geometry modifiers from Blender.


TODOS:
- exporter (OBJ, …)
- importer (OBJ, OFF, WRL ?)
- undo/redo