/*
 * Low-level Wasm exports for Antiprism editor tools.
 * JS catches Emscripten ExitStatus when tools call exit().
 */

#include <emscripten/bind.h>

#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

extern int polygon_main(int argc, char **argv);
extern int conway_main(int argc, char **argv);
extern int geodesic_main(int argc, char **argv);
extern int off_color_main(int argc, char **argv);
extern int off_util_main(int argc, char **argv);
extern int off_trans_main(int argc, char **argv);
extern int pol_recip_main(int argc, char **argv);
extern int canonical_main(int argc, char **argv);
extern int conv_hull_main(int argc, char **argv);
extern int planar_main(int argc, char **argv);
extern int zono_main(int argc, char **argv);
extern int poly_kscope_main(int argc, char **argv);
extern int stellate_main(int argc, char **argv);
extern int leonardo_main(int argc, char **argv);
extern int wythoff_main(int argc, char **argv);
extern int to_nfold_main(int argc, char **argv);
extern int off_normals_main(int argc, char **argv);
extern int repel_main(int argc, char **argv);
extern int poly_form_main(int argc, char **argv);
extern int off_color_radial_main(int argc, char **argv);
extern int miller_main(int argc, char **argv);
extern int iso_delta_main(int argc, char **argv);
extern int iso_kite_main(int argc, char **argv);
extern int symmetro_main(int argc, char **argv);
extern int sph_rings_main(int argc, char **argv);
extern int waterman_main(int argc, char **argv);
extern int tetra59_main(int argc, char **argv);
extern int bravais_main(int argc, char **argv);
extern int unitile2d_main(int argc, char **argv);

namespace {

void write_file(const char *path, const std::string &data)
{
  FILE *f = fopen(path, "wb");
  if (!f)
    throw std::runtime_error(std::string("cannot write ") + path);
  if (!data.empty())
    fwrite(data.data(), 1, data.size(), f);
  fclose(f);
}

std::string read_file(const char *path)
{
  FILE *f = fopen(path, "rb");
  if (!f)
    return {};
  std::string out;
  char buf[4096];
  size_t n;
  while ((n = fread(buf, 1, sizeof(buf), f)) > 0)
    out.append(buf, n);
  fclose(f);
  return out;
}

std::vector<std::string> g_argv_storage;
std::vector<char *> g_argv_ptrs;

} // namespace

void setup_io(const std::string &stdin_off)
{
  write_file("/tmp/ap_stdout", "");
  write_file("/tmp/ap_stderr", "");
  write_file("/tmp/ap_stdin", stdin_off);

  if (!freopen("/tmp/ap_stdout", "w", stdout))
    throw std::runtime_error("freopen stdout failed");
  if (!freopen("/tmp/ap_stderr", "w", stderr))
    throw std::runtime_error("freopen stderr failed");
  if (!freopen("/tmp/ap_stdin", "r", stdin))
    throw std::runtime_error("freopen stdin failed");
}

int call_tool(const std::string &tool, const std::vector<std::string> &args)
{
  g_argv_storage.clear();
  g_argv_storage.push_back(tool);
  for (const auto &a : args)
    g_argv_storage.push_back(a);

  g_argv_ptrs.clear();
  g_argv_ptrs.reserve(g_argv_storage.size());
  for (auto &s : g_argv_storage)
    g_argv_ptrs.push_back(s.data());

  int argc = static_cast<int>(g_argv_ptrs.size());
  if (tool == "polygon")
    return polygon_main(argc, g_argv_ptrs.data());
  if (tool == "conway")
    return conway_main(argc, g_argv_ptrs.data());
  if (tool == "geodesic")
    return geodesic_main(argc, g_argv_ptrs.data());
  if (tool == "off_color")
    return off_color_main(argc, g_argv_ptrs.data());
  if (tool == "off_util")
    return off_util_main(argc, g_argv_ptrs.data());
  if (tool == "off_trans")
    return off_trans_main(argc, g_argv_ptrs.data());
  if (tool == "pol_recip")
    return pol_recip_main(argc, g_argv_ptrs.data());
  if (tool == "canonical")
    return canonical_main(argc, g_argv_ptrs.data());
  if (tool == "conv_hull")
    return conv_hull_main(argc, g_argv_ptrs.data());
  if (tool == "planar")
    return planar_main(argc, g_argv_ptrs.data());
  if (tool == "zono")
    return zono_main(argc, g_argv_ptrs.data());
  if (tool == "poly_kscope")
    return poly_kscope_main(argc, g_argv_ptrs.data());
  if (tool == "stellate")
    return stellate_main(argc, g_argv_ptrs.data());
  if (tool == "leonardo")
    return leonardo_main(argc, g_argv_ptrs.data());
  if (tool == "wythoff")
    return wythoff_main(argc, g_argv_ptrs.data());
  if (tool == "to_nfold")
    return to_nfold_main(argc, g_argv_ptrs.data());
  if (tool == "off_normals")
    return off_normals_main(argc, g_argv_ptrs.data());
  if (tool == "repel")
    return repel_main(argc, g_argv_ptrs.data());
  if (tool == "poly_form")
    return poly_form_main(argc, g_argv_ptrs.data());
  if (tool == "off_color_radial")
    return off_color_radial_main(argc, g_argv_ptrs.data());
  if (tool == "miller")
    return miller_main(argc, g_argv_ptrs.data());
  if (tool == "iso_delta")
    return iso_delta_main(argc, g_argv_ptrs.data());
  if (tool == "iso_kite")
    return iso_kite_main(argc, g_argv_ptrs.data());
  if (tool == "symmetro")
    return symmetro_main(argc, g_argv_ptrs.data());
  if (tool == "sph_rings")
    return sph_rings_main(argc, g_argv_ptrs.data());
  if (tool == "waterman")
    return waterman_main(argc, g_argv_ptrs.data());
  if (tool == "tetra59")
    return tetra59_main(argc, g_argv_ptrs.data());
  if (tool == "bravais")
    return bravais_main(argc, g_argv_ptrs.data());
  if (tool == "unitile2d")
    return unitile2d_main(argc, g_argv_ptrs.data());
  fprintf(stderr, "unknown tool: %s\n", tool.c_str());
  return 1;
}

void flush_io()
{
  fflush(stdout);
  fflush(stderr);
}

std::string read_stdout()
{
  flush_io();
  return read_file("/tmp/ap_stdout");
}

std::string read_stderr()
{
  flush_io();
  return read_file("/tmp/ap_stderr");
}

EMSCRIPTEN_BINDINGS(antiprism_module)
{
  emscripten::register_vector<std::string>("VectorString");
  emscripten::function("setup_io", &setup_io);
  emscripten::function("call_tool", &call_tool);
  emscripten::function("flush_io", &flush_io);
  emscripten::function("read_stdout", &read_stdout);
  emscripten::function("read_stderr", &read_stderr);
}
