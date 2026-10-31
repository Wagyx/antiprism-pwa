import { runAntiprism } from "../wasm/client";
import { opToArgs, type PipelineOp } from "./types";

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

  let off = "";
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const args = opToArgs(op);
    const stdin = op.kind === "polygon" ? "" : off;
    const result = await runAntiprism(op.kind, args, stdin);

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
