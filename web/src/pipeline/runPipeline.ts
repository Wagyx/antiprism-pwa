import { looksLikeOff } from "../io/loadOff";
import { runAntiprism } from "../wasm/client";
import type { AntiprismTool } from "../wasm/runTool";
import { isSeedOp, opToArgs, wasmToolForOp, type PipelineOp } from "./types";

export type PipelineResult = {
  ok: boolean;
  offText: string | null;
  error: string | null;
  failedStep: number | null;
};

export async function runPipeline(ops: PipelineOp[]): Promise<PipelineResult> {
  if (ops.length === 0) {
    return { ok: false, offText: null, error: "Stack is empty", failedStep: null };
  }

  if (!ops.some((op) => op.enabled)) {
    return {
      ok: false,
      offText: null,
      error: "All operations are off",
      failedStep: null,
    };
  }

  let off = "";
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op.enabled) continue;

    if (op.kind === "import_off") {
      const text = op.offText.trim();
      if (!text) {
        return {
          ok: false,
          offText: off || null,
          error: `Step ${i + 1} (import_off): no OFF file loaded`,
          failedStep: i,
        };
      }
      if (!looksLikeOff(text)) {
        return {
          ok: false,
          offText: off || null,
          error: `Step ${i + 1} (import_off): file is not OFF`,
          failedStep: i,
        };
      }
      off = op.offText;
      continue;
    }

    const args = opToArgs(op);
    const stdin = isSeedOp(op) ? "" : off;
    const result = await runAntiprism(
      wasmToolForOp(op) as AntiprismTool,
      args,
      stdin,
    );

    if (!result.ok) {
      const msg =
        result.stderr.trim() ||
        `${op.kind} exited with code ${result.code}`;
      return {
        ok: false,
        offText: off || null,
        error: `Step ${i + 1} (${op.kind}): ${msg}`,
        failedStep: i,
      };
    }
    off = result.stdout;
  }

  return { ok: true, offText: off, error: null, failedStep: null };
}
