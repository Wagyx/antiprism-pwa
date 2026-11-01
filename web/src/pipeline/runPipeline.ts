import { looksLikeOff } from "../io/loadOff";
import { runAntiprism } from "../wasm/client";
import type { AntiprismTool } from "../wasm/runTool";
import {
  isSeedOp,
  isTextTool,
  opToArgs,
  wasmToolForOp,
  type PipelineOp,
} from "./types";

export type PipelineResult = {
  ok: boolean;
  offText: string | null;
  error: string | null;
  failedStep: number | null;
  /** Text/export stdout keyed by operation id (pass-through tools). */
  stepText: Record<string, string>;
};

export async function runPipeline(ops: PipelineOp[]): Promise<PipelineResult> {
  const stepText: Record<string, string> = {};

  if (ops.length === 0) {
    return {
      ok: false,
      offText: null,
      error: "Stack is empty",
      failedStep: null,
      stepText,
    };
  }

  if (!ops.some((op) => op.enabled)) {
    return {
      ok: false,
      offText: null,
      error: "All operations are off",
      failedStep: null,
      stepText,
    };
  }

  let off = "";
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op.enabled) continue;

    if (op.kind === "import_file") {
      const text = op.fileText.trim();
      if (!text) {
        return {
          ok: false,
          offText: off || null,
          error: `Step ${i + 1} (import_file): no file loaded`,
          failedStep: i,
          stepText,
        };
      }

      if (op.format === "obj") {
        const result = await runAntiprism(
          "obj2off",
          opToArgs(op),
          op.fileText,
        );
        if (!result.ok) {
          const msg =
            result.stderr.trim() ||
            `obj2off exited with code ${result.code}`;
          return {
            ok: false,
            offText: off || null,
            error: `Step ${i + 1} (import_file): ${msg}`,
            failedStep: i,
            stepText,
          };
        }
        if (!looksLikeOff(result.stdout)) {
          return {
            ok: false,
            offText: off || null,
            error: `Step ${i + 1} (import_file): OBJ conversion did not produce OFF`,
            failedStep: i,
            stepText,
          };
        }
        off = result.stdout;
        continue;
      }

      if (!looksLikeOff(text)) {
        return {
          ok: false,
          offText: off || null,
          error: `Step ${i + 1} (import_file): file is not OFF`,
          failedStep: i,
          stepText,
        };
      }
      off = op.fileText;
      continue;
    }

    if (isTextTool(op.kind) && !off.trim()) {
      return {
        ok: false,
        offText: null,
        error: `Step ${i + 1} (${op.kind}): needs geometry from a prior step`,
        failedStep: i,
        stepText,
      };
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
        stepText,
      };
    }

    if (isTextTool(op.kind)) {
      stepText[op.id] = result.stdout;
      continue;
    }

    off = result.stdout;
  }

  return { ok: true, offText: off, error: null, failedStep: null, stepText };
}
