# Antiprism GUI

Client-only progressive web app for building and viewing polyhedra with a
[Antiprism](https://antiprism.com/)-backed Wasm pipeline and a Three.js viewer.

The Antiprism C++ sources and the compiled Wasm artifacts are **not** stored in
git. You generate `web/public/wasm/` locally (or in CI) before running the app.

## Prerequisites

- [Node.js](https://nodejs.org/) (for the Vite app under `web/`)
- [Emscripten SDK (emsdk)](https://emscripten.org/docs/getting_started/downloads.html)
- A checkout of [antiprism/antiprism](https://github.com/antiprism/antiprism) at
  the repo root as `antiprism/` (gitignored)

```bash
# Example: emsdk (once)
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
~/emsdk/emsdk install latest
~/emsdk/emsdk activate latest

# Antiprism sources next to this repo’s wasm/ and web/
git clone https://github.com/antiprism/antiprism.git antiprism
# Optional: pin to the revision used when developing
# (cd antiprism && git checkout 7805b34)
```

## Build the Wasm module

From the repository root (with `emcc` on your `PATH`, or emsdk at `~/emsdk` /
`$EMSDK`):

```bash
source ~/emsdk/emsdk_env.sh   # if needed
bash wasm/build.sh
```

This compiles selected Antiprism tools into a single module and copies:

- `wasm/dist/antiprism.js`
- `wasm/dist/antiprism.wasm`
- `wasm/dist/antiprism.data`

into `web/public/wasm/` for the PWA (that directory is gitignored).

### Verify against native CLIs

With Antiprism binaries built under `antiprism/src/`:

```bash
node tests/wasm/golden.mjs
```

## Run the web app

```bash
cd web
npm install
npm run dev
```

Open the printed local URL. Rebuild Wasm (`bash wasm/build.sh`) whenever you
change tools under `wasm/` or update the `antiprism/` checkout, then refresh
the app.
