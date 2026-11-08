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
  -fexceptions
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
  if [[ ! -f "$obj" || "$src" -nt "$obj" || "$WASM_DIR/config.h" -nt "$obj" || "$WASM_DIR/build.sh" -nt "$obj" ]]; then
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

echo "==> Compiling editor tools (renamed main + disambiguated locals)"
# Tool .cc files reuse short names (pr_opts, cn_opts, make_skeleton, …).
# Prefix those with -D so multiple tools can link into one Wasm module.
rm -f "$OBJ_DIR/src"/{polygon,conway,geodesic,off_color,off_util,off_trans,pol_recip,canonical,conv_hull,planar,zono,poly_kscope,stellate,leonardo,wythoff,to_nfold,off_normals,repel,poly_form,off_color_radial,miller,iso_delta,iso_kite,symmetro,sph_rings,waterman,tetra59,bravais,unitile2d,n_icons,kcycle,lat_util,col_util,off_report,off_query,off2obj,off2crds,obj2off,off2pov,off2vrml,off2dae}.o
compile_one "$ANTI/src/polygon.cc" "$OBJ_DIR/src/polygon.o" -Dmain=polygon_main
compile_one "$ANTI/src/conway.cc" "$OBJ_DIR/src/conway.o" \
  -Dmain=conway_main -Dcn_opts=conway_cn_opts -Dextended_help=conway_extended_help
compile_one "$ANTI/src/geodesic.cc" "$OBJ_DIR/src/geodesic.o" -Dmain=geodesic_main
compile_one "$ANTI/src/off_color.cc" "$OBJ_DIR/src/off_color.o" -Dmain=off_color_main
compile_one "$ANTI/src/off_util.cc" "$OBJ_DIR/src/off_util.o" \
  -Dmain=off_util_main -Dpr_opts=off_util_pr_opts -Dmake_skeleton=off_util_make_skeleton
compile_one "$ANTI/src/off_trans.cc" "$OBJ_DIR/src/off_trans.o" -Dmain=off_trans_main
compile_one "$ANTI/src/pol_recip.cc" "$OBJ_DIR/src/pol_recip.o" \
  -Dmain=pol_recip_main -Dpr_opts=pol_recip_pr_opts
compile_one "$ANTI/src/canonical.cc" "$OBJ_DIR/src/canonical.o" \
  -Dmain=canonical_main -Dcn_opts=canonical_cn_opts -Dextended_help=canonical_extended_help
compile_one "$ANTI/src/conv_hull.cc" "$OBJ_DIR/src/conv_hull.o" -Dmain=conv_hull_main
compile_one "$ANTI/src/planar.cc" "$OBJ_DIR/src/planar.o" \
  -Dmain=planar_main -Dmake_skeleton=planar_make_skeleton
compile_one "$ANTI/src/zono.cc" "$OBJ_DIR/src/zono.o" -Dmain=zono_main
compile_one "$ANTI/src/poly_kscope.cc" "$OBJ_DIR/src/poly_kscope.o" -Dmain=poly_kscope_main
compile_one "$ANTI/src/stellate.cc" "$OBJ_DIR/src/stellate.o" -Dmain=stellate_main
compile_one "$ANTI/src/leonardo.cc" "$OBJ_DIR/src/leonardo.o" -Dmain=leonardo_main
compile_one "$ANTI/src/wythoff.cc" "$OBJ_DIR/src/wythoff.o" -Dmain=wythoff_main
compile_one "$ANTI/src/to_nfold.cc" "$OBJ_DIR/src/to_nfold.o" -Dmain=to_nfold_main
compile_one "$ANTI/src/off_normals.cc" "$OBJ_DIR/src/off_normals.o" -Dmain=off_normals_main
compile_one "$ANTI/src/repel.cc" "$OBJ_DIR/src/repel.o" -Dmain=repel_main
compile_one "$ANTI/src/poly_form.cc" "$OBJ_DIR/src/poly_form.o" -Dmain=poly_form_main
compile_one "$ANTI/src/off_color_radial.cc" "$OBJ_DIR/src/off_color_radial.o" \
  -Dmain=off_color_radial_main
compile_one "$ANTI/src/miller.cc" "$OBJ_DIR/src/miller.o" -Dmain=miller_main
compile_one "$ANTI/src/iso_delta.cc" "$OBJ_DIR/src/iso_delta.o" -Dmain=iso_delta_main
compile_one "$ANTI/src/iso_kite.cc" "$OBJ_DIR/src/iso_kite.o" -Dmain=iso_kite_main
compile_one "$ANTI/src/symmetro.cc" "$OBJ_DIR/src/symmetro.o" \
  -Dmain=symmetro_main \
  -Ddelete_free_faces=symmetro_delete_free_faces \
  -Dis_point_on_polygon_edges=symmetro_is_point_on_polygon_edges
compile_one "$ANTI/src/sph_rings.cc" "$OBJ_DIR/src/sph_rings.o" -Dmain=sph_rings_main
compile_one "$ANTI/src/waterman.cc" "$OBJ_DIR/src/waterman.o" -Dmain=waterman_main
compile_one "$ANTI/src/tetra59.cc" "$OBJ_DIR/src/tetra59.o" \
  -Dmain=tetra59_main -Dextended_help=tetra59_extended_help
compile_one "$ANTI/src/bravais.cc" "$OBJ_DIR/src/bravais.o" \
  -Dmain=bravais_main -Dextended_help=bravais_extended_help
compile_one "$ANTI/src/unitile2d.cc" "$OBJ_DIR/src/unitile2d.o" -Dmain=unitile2d_main
compile_one "$ANTI/src/n_icons.cc" "$OBJ_DIR/src/n_icons.o" \
  -Dmain=n_icons_main -Dfilter=n_icons_filter
compile_one "$ANTI/src/kcycle.cc" "$OBJ_DIR/src/kcycle.o" -Dmain=kcycle_main
compile_one "$ANTI/src/lat_util.cc" "$OBJ_DIR/src/lat_util.o" \
  -Dmain=lat_util_main -Dmake_skeleton=lat_util_make_skeleton
compile_one "$ANTI/src/col_util.cc" "$OBJ_DIR/src/col_util.o" -Dmain=col_util_main
compile_one "$ANTI/src/off_report.cc" "$OBJ_DIR/src/off_report.o" -Dmain=off_report_main
compile_one "$ANTI/src/off_query.cc" "$OBJ_DIR/src/off_query.o" -Dmain=off_query_main
compile_one "$ANTI/src/off2obj.cc" "$OBJ_DIR/src/off2obj.o" -Dmain=off2obj_main
compile_one "$ANTI/src/off2crds.cc" "$OBJ_DIR/src/off2crds.o" -Dmain=off2crds_main
compile_one "$ANTI/src/obj2off.cc" "$OBJ_DIR/src/obj2off.o" -Dmain=obj2off_main
compile_one "$ANTI/src/off2pov.cc" "$OBJ_DIR/src/off2pov.o" -Dmain=off2pov_main
compile_one "$ANTI/src/off2vrml.cc" "$OBJ_DIR/src/off2vrml.o" -Dmain=off2vrml_main
compile_one "$ANTI/src/off2dae.cc" "$OBJ_DIR/src/off2dae.o" -Dmain=off2dae_main
compile_one "$ANTI/src/canonical_common.cc" "$OBJ_DIR/src/canonical_common.o"
compile_one "$ANTI/src/color_common.cc" "$OBJ_DIR/src/color_common.o"
compile_one "$ANTI/src/lat_util_common.cc" "$OBJ_DIR/src/lat_util_common.o"
compile_one "$ANTI/src/rep_print.cc" "$OBJ_DIR/src/rep_print.o"

echo "==> Compiling bindings"
em++ -O2 -std=c++17 \
  -I"$WASM_DIR" \
  -c "$WASM_DIR/bindings.cpp" -o "$OBJ_DIR/bindings.o"

echo "==> Linking antiprism.js / antiprism.wasm"
em++ -O2 -fexceptions \
  "${BASE_OBJS[@]}" \
  "${QHULL_OBJS[@]}" \
  "${MUP_OBJS[@]}" \
  "${TESS_OBJS[@]}" \
  "$OBJ_DIR/src/polygon.o" \
  "$OBJ_DIR/src/conway.o" \
  "$OBJ_DIR/src/geodesic.o" \
  "$OBJ_DIR/src/off_color.o" \
  "$OBJ_DIR/src/off_util.o" \
  "$OBJ_DIR/src/off_trans.o" \
  "$OBJ_DIR/src/pol_recip.o" \
  "$OBJ_DIR/src/canonical.o" \
  "$OBJ_DIR/src/conv_hull.o" \
  "$OBJ_DIR/src/planar.o" \
  "$OBJ_DIR/src/zono.o" \
  "$OBJ_DIR/src/poly_kscope.o" \
  "$OBJ_DIR/src/stellate.o" \
  "$OBJ_DIR/src/leonardo.o" \
  "$OBJ_DIR/src/wythoff.o" \
  "$OBJ_DIR/src/to_nfold.o" \
  "$OBJ_DIR/src/off_normals.o" \
  "$OBJ_DIR/src/repel.o" \
  "$OBJ_DIR/src/poly_form.o" \
  "$OBJ_DIR/src/off_color_radial.o" \
  "$OBJ_DIR/src/miller.o" \
  "$OBJ_DIR/src/iso_delta.o" \
  "$OBJ_DIR/src/iso_kite.o" \
  "$OBJ_DIR/src/symmetro.o" \
  "$OBJ_DIR/src/sph_rings.o" \
  "$OBJ_DIR/src/waterman.o" \
  "$OBJ_DIR/src/tetra59.o" \
  "$OBJ_DIR/src/bravais.o" \
  "$OBJ_DIR/src/unitile2d.o" \
  "$OBJ_DIR/src/n_icons.o" \
  "$OBJ_DIR/src/kcycle.o" \
  "$OBJ_DIR/src/lat_util.o" \
  "$OBJ_DIR/src/col_util.o" \
  "$OBJ_DIR/src/off_report.o" \
  "$OBJ_DIR/src/off_query.o" \
  "$OBJ_DIR/src/off2obj.o" \
  "$OBJ_DIR/src/off2crds.o" \
  "$OBJ_DIR/src/obj2off.o" \
  "$OBJ_DIR/src/off2pov.o" \
  "$OBJ_DIR/src/off2vrml.o" \
  "$OBJ_DIR/src/off2dae.o" \
  "$OBJ_DIR/src/canonical_common.o" \
  "$OBJ_DIR/src/color_common.o" \
  "$OBJ_DIR/src/lat_util_common.o" \
  "$OBJ_DIR/src/rep_print.o" \
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
