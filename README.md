# Antiprism PWA

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

## Deploy (static hosting)

The app is a static build under `web/dist/`. The Vite `base` defaults to `./`
so it works in a subdirectory (e.g. `/app/antiprism-pwa/`).

```bash
bash wasm/build.sh
cd web && npm install && npm run build
# upload the contents of web/dist/ to your host path
```

Serve over HTTPS. Prefer opening
`…/app/antiprism-pwa/` or `…/app/antiprism-pwa/index.html` — asset URLs are
relative to that folder. For a site-root deploy instead:

```bash
VITE_BASE_PATH=/ npm run build
```

## Versioning

The app version lives in `VERSION` (currently **0.1.5**) and is shown in the UI
as `v…`. `web/package.json` and `web/src/version.ts` stay in sync.

A **pre-commit** hook bumps the **patch** digit on every git commit
(`0.1.5` → `0.1.6` → …). After cloning, install the hook once:

```bash
bash scripts/install-git-hooks.sh
```

Skip a bump for a single commit with `SKIP_VERSION_BUMP=1 git commit …`.
