export type AntiprismTool =
  | "polygon"
  | "conway"
  | "geodesic"
  | "off_color"
  | "off_util"
  | "off_trans"
  | "pol_recip"
  | "canonical"
  | "conv_hull"
  | "planar"
  | "zono"
  | "poly_kscope"
  | "stellate"
  | "leonardo"
  | "wythoff"
  | "to_nfold"
  | "off_normals"
  | "repel"
  | "poly_form"
  | "off_color_radial"
  | "miller"
  | "iso_delta"
  | "iso_kite"
  | "symmetro"
  | "sph_rings"
  | "waterman"
  | "tetra59"
  | "bravais"
  | "unitile2d"
  | "n_icons"
  | "kcycle"
  | "lat_util"
  | "col_util";

export type ToolResult = {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
};

/** Shape of the embind exports we use from the Wasm module. */
export type AntiprismModule = {
  VectorString: new () => {
    push_back(s: string): void;
    delete(): void;
  };
  setup_io(stdinOff: string): void;
  call_tool(tool: string, args: unknown): number;
  flush_io(): void;
  read_stdout(): string;
  read_stderr(): string;
};

export function runTool(
  Module: AntiprismModule,
  tool: AntiprismTool,
  args: string[] = [],
  stdinOff = "",
): ToolResult {
  const vec = new Module.VectorString();
  try {
    for (const a of args) vec.push_back(String(a));
    Module.setup_io(stdinOff || "");
    let code = 0;
    try {
      code = Module.call_tool(tool, vec);
    } catch (e: unknown) {
      const err = e as { name?: string; status?: number };
      if (err && (err.name === "ExitStatus" || typeof err.status === "number")) {
        code = err.status ?? 1;
      } else {
        throw e;
      }
    }
    const stdout = Module.read_stdout();
    const stderr = Module.read_stderr();
    // conv_hull returns the hull dimension (2/3) as its exit status on success
    const ok =
      code === 0 ||
      (tool === "conv_hull" && /^\s*OFF\b/i.test(stdout));
    return { ok, code, stdout, stderr };
  } finally {
    vec.delete();
  }
}
