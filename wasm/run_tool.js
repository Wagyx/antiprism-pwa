/**
 * Shared helper used by Node golden tests and the browser worker.
 * Expects an initialized Emscripten module with setup_io / call_tool / …
 */
export function runTool(Module, tool, args = [], stdinOff = "") {
  const vec = new Module.VectorString();
  try {
    for (const a of args) vec.push_back(String(a));
    Module.setup_io(stdinOff || "");
    let code = 0;
    try {
      code = Module.call_tool(tool, vec);
    } catch (e) {
      if (e && (e.name === "ExitStatus" || typeof e.status === "number")) {
        code = e.status ?? 1;
      } else {
        throw e;
      }
    }
    const stdout = Module.read_stdout();
    const stderr = Module.read_stderr();
    return { ok: code === 0, code, stdout, stderr };
  } finally {
    vec.delete();
  }
}
