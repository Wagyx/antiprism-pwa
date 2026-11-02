import { looksLikeOff } from "../io/loadOff";
import type { LibraryInputFile } from "../library/types";
import { runAntiprism } from "../wasm/client";
import type { AntiprismTool } from "../wasm/runTool";
import {
  commandGeneratesGeometry,
  commandTool,
  type CommandStep,
} from "./commandStep";
import { commandName, tokenize } from "./parseCommand";
import { isTextTool, WASM_STDIN_PATH } from "./types";

export type PipelineResult = {
  ok: boolean;
  offText: string | null;
  error: string | null;
  failedStep: number | null;
  /** Text/export stdout keyed by step id (pass-through tools). */
  stepText: Record<string, string>;
};

export async function runPipeline(
  steps: CommandStep[],
  inputFile: LibraryInputFile | null = null,
): Promise<PipelineResult> {
  const stepText: Record<string, string> = {};
  const first = steps.find((step) => step.enabled && step.command.trim());
  const feedFile = Boolean(inputFile?.text.trim()) && (!first || !commandGeneratesGeometry(first.command));

  let off = "";
  if (feedFile && inputFile) {
    const firstTool = first ? commandTool(first.command) : "";
    if (firstTool === "obj2off") {
      off = inputFile.text;
    } else {
      const seeded = await offFromFile(inputFile);
      if (!seeded.ok) {
        return {
          ok: false,
          offText: null,
          error: `Starting file: ${seeded.error}`,
          failedStep: null,
          stepText,
        };
      }
      off = seeded.off;
    }
  }

  const runnable = steps.some((step) => step.enabled && step.command.trim());
  if (!runnable) {
    if (off && looksLikeOff(off)) {
      return { ok: true, offText: off, error: null, failedStep: null, stepText };
    }
    return { ok: true, offText: null, error: null, failedStep: null, stepText };
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.enabled || !step.command.trim()) continue;

    let tokens: string[];
    try {
      tokens = tokenize(step.command);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      return {
        ok: false,
        offText: off || null,
        error: `Step ${i + 1}: ${message}`,
        failedStep: i,
        stepText,
      };
    }
    if (tokens.length === 0) continue;
    const tool = commandName(tokens[0]);
    const args = tokens.slice(1);

    if (isTextTool(tool) && !off.trim()) {
      return {
        ok: false,
        offText: null,
        error: `Step ${i + 1} (${tool}): needs geometry from a prior step`,
        failedStep: i,
        stepText,
      };
    }

    const stdin = commandGeneratesGeometry(step.command) ? "" : off;
    const result = await runAntiprism(tool as AntiprismTool, args, stdin);
    if (!result.ok) {
      const msg = result.stderr.trim() || `${tool} exited with code ${result.code}`;
      return {
        ok: false,
        offText: off || null,
        error: `Step ${i + 1} (${tool}): ${msg}`,
        failedStep: i,
        stepText,
      };
    }

    if (isTextTool(tool)) {
      stepText[step.id] = result.stdout;
      continue;
    }

    off = result.stdout;
  }

  return { ok: true, offText: off, error: null, failedStep: null, stepText };
}

async function offFromFile(
  file: LibraryInputFile,
): Promise<{ ok: true; off: string } | { ok: false; error: string }> {
  const obj = file.format === "obj" || file.fileName.toLowerCase().endsWith(".obj");
  if (obj) {
    const result = await runAntiprism("obj2off", ["-d", "8", WASM_STDIN_PATH], file.text);
    if (!result.ok) {
      return {
        ok: false,
        error: result.stderr.trim() || `obj2off exited with code ${result.code}`,
      };
    }
    if (!looksLikeOff(result.stdout)) {
      return { ok: false, error: "OBJ conversion did not produce OFF" };
    }
    return { ok: true, off: result.stdout };
  }
  if (!looksLikeOff(file.text)) return { ok: false, error: "file is not OFF" };
  return { ok: true, off: file.text };
}
