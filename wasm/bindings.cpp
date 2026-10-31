/*
 * Low-level Wasm exports for Antiprism polygon / conway.
 * JS catches Emscripten ExitStatus when tools call exit().
 */

#include <emscripten/bind.h>

#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

extern int polygon_main(int argc, char **argv);
extern int conway_main(int argc, char **argv);

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
