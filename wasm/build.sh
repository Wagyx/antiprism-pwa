#!/usr/bin/env bash
# Build Antiprism polygon + conway as a single Wasm module (no aview).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM_DIR="$ROOT/wasm"
ANTI="$ROOT/antiprism"
OUT_DIR="$WASM_DIR/dist"
OBJ_DIR="$WASM_DIR/build"

if [[ -f "${EMSDK:-$HOME/emsdk}/emsdk_env.sh" ]]; then
  # shellcheck disable=SC1090
  source "${EMSDK:-$HOME/emsdk}/emsdk_env.sh" >/dev/null 2>&1 || true
fi

if ! command -v emcc >/dev/null 2>&1; then
  echo "emcc not found; install/activate emsdk first" >&2
  exit 1
fi

mkdir -p "$OUT_DIR" "$OBJ_DIR"/{base,qhull,muparser,tesselator,src}

# Force-include wasm config (VERSION, …) instead of antiprism/config.h / HAVE_CONFIG_H.
CXXFLAGS=(
  -O2
  -std=c++17
  -DSUPDIR=\"/share\"
  -I"$WASM_DIR"
  -I"$ANTI"
  -I"$ANTI/base"
  -I"$ANTI/base/qhull"
  -I"$ANTI/base/muparser"
  -I"$ANTI/base/tesselator"
  -I"$ANTI/src"
  -include "$WASM_DIR/config.h"
  -Wno-deprecated-declarations
  -Wno-unused-variable
  -Wno-unused-but-set-variable
  -Wno-parentheses
  -Wno-sign-compare
)

compile_one() {
  local src="$1"
  local obj="$2"
  local extra=("${@:3}")
  if [[ ! -f "$obj" || "$src" -nt "$obj" || "$WASM_DIR/config.h" -nt "$obj" ]]; then
    echo "  CC $(basename "$src")"
    em++ "${CXXFLAGS[@]}" "${extra[@]}" -c "$src" -o "$obj"
  fi
}

echo "==> Compiling base/libantiprism sources"
BASE_SRCS=(
  off_read.cc off_write.cc crds_read.cc displaypoly.cc
  geometry.cc geometryutils.cc colormap.cc color.cc dual.cc
  programopts.cc status.cc vec3d.cc trans3d.cc
  vec4d.cc trans4d.cc vec_utils.cc vec_utils_norm.cc vec_utils_cent.cc
  utils.cc utils_parser.cc getopt.cc mathutils.cc
  normal.cc c_hull.cc triangulate.cc iteration.cc
  symmetry.cc sort_merge.cc boundbox.cc geometryinfo.cc
  coloring.cc prop_col.cc named_cols.cc geodesic.cc zonohedron.cc
  johnson.cc uniform.cc std_polys.cc skilling.cc stellations.cc
  timer.cc polygon.cc povwriter.cc scene.cc
  canonical.cc trans.cc faces.cc vrmlwriter.cc
  wythoff.cc wythoff_tiling.cc wythoff_ops.cc planar.cc
)

BASE_OBJS=()
for f in "${BASE_SRCS[@]}"; do
  obj="$OBJ_DIR/base/${f%.cc}.o"
  compile_one "$ANTI/base/$f" "$obj"
  BASE_OBJS+=("$obj")
done

echo "==> Compiling qhull"
QHULL_SRCS=(
  geom2_r.cc geom_r.cc global_r.cc io_r.cc libqhull_r.cc mem_r.cc
  merge_r.cc poly2_r.cc poly_r.cc qset_r.cc random_r.cc rboxlib_r.cc
  stat_r.cc usermem_r.cc userprintf_rbox_r.cc userprintf_r.cc user_r.cc
)
QHULL_OBJS=()
for f in "${QHULL_SRCS[@]}"; do
  obj="$OBJ_DIR/qhull/${f%.cc}.o"
  compile_one "$ANTI/base/qhull/$f" "$obj"
  QHULL_OBJS+=("$obj")
done

echo "==> Compiling muparser"
MUP_SRCS=(
  muParserBase.cc muParserBytecode.cc muParserCallback.cc muParser.cc
  muParserDLL.cc muParserError.cc muParserInt.cc muParserTest.cc
  muParserTokenReader.cc
)
MUP_OBJS=()
for f in "${MUP_SRCS[@]}"; do
  obj="$OBJ_DIR/muparser/${f%.cc}.o"
  compile_one "$ANTI/base/muparser/$f" "$obj" -Wno-cast-function-type
  MUP_OBJS+=("$obj")
done

echo "==> Compiling tesselator"
TESS_SRCS=(
  dict.cc geom.cc memalloc.cc mesh.cc normal.cc
  priorityq.cc render.cc sweep.cc tess.cc tessmono.cc
)
TESS_OBJS=()
for f in "${TESS_SRCS[@]}"; do
  obj="$OBJ_DIR/tesselator/${f%.cc}.o"
  compile_one "$ANTI/base/tesselator/$f" "$obj"
  TESS_OBJS+=("$obj")
done

echo "==> Compiling editor tools (renamed main)"
compile_one "$ANTI/src/polygon.cc" "$OBJ_DIR/src/polygon.o" -Dmain=polygon_main
compile_one "$ANTI/src/conway.cc" "$OBJ_DIR/src/conway.o" -Dmain=conway_main
compile_one "$ANTI/src/geodesic.cc" "$OBJ_DIR/src/geodesic.o" -Dmain=geodesic_main
compile_one "$ANTI/src/off_color.cc" "$OBJ_DIR/src/off_color.o" -Dmain=off_color_main
compile_one "$ANTI/src/off_util.cc" "$OBJ_DIR/src/off_util.o" -Dmain=off_util_main
compile_one "$ANTI/src/canonical_common.cc" "$OBJ_DIR/src/canonical_common.o"
compile_one "$ANTI/src/color_common.cc" "$OBJ_DIR/src/color_common.o"

echo "==> Compiling bindings"
em++ -O2 -std=c++17 \
  -I"$WASM_DIR" \
  -c "$WASM_DIR/bindings.cpp" -o "$OBJ_DIR/bindings.o"

echo "==> Linking antiprism.js / antiprism.wasm"
em++ -O2 \
  "${BASE_OBJS[@]}" \
  "${QHULL_OBJS[@]}" \
  "${MUP_OBJS[@]}" \
  "${TESS_OBJS[@]}" \
  "$OBJ_DIR/src/polygon.o" \
  "$OBJ_DIR/src/conway.o" \
  "$OBJ_DIR/src/geodesic.o" \
  "$OBJ_DIR/src/off_color.o" \
  "$OBJ_DIR/src/off_util.o" \
  "$OBJ_DIR/src/canonical_common.o" \
  "$OBJ_DIR/src/color_common.o" \
  "$OBJ_DIR/bindings.o" \
  -o "$OUT_DIR/antiprism.js" \
  --bind \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=createAntiprismModule \
  -sENVIRONMENT=web,worker,node \
  -sFILESYSTEM=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sFORCE_FILESYSTEM=1 \
  -sEXIT_RUNTIME=0 \
  -sEXPORTED_RUNTIME_METHODS=FS,UTF8ToString \
  -sSTACK_SIZE=4MB \
  --preload-file "$ANTI/share@/share"

# Sync into the Vite public folder for the PWA
WEB_WASM="$ROOT/web/public/wasm"
mkdir -p "$WEB_WASM"
cp -f "$OUT_DIR/antiprism.js" "$OUT_DIR/antiprism.wasm" "$OUT_DIR/antiprism.data" "$WEB_WASM/"
# Node golden tests still import CommonJS-friendly path; also keep a CJS copy for require()
cp -f "$OUT_DIR/antiprism.js" "$OUT_DIR/antiprism.mjs"

echo "Built: $OUT_DIR/antiprism.js $OUT_DIR/antiprism.wasm $OUT_DIR/antiprism.data"
ls -lh "$OUT_DIR"
ls -lh "$WEB_WASM"
