import { defaultParams, TOOL_PARAM_SCHEMAS } from "../pipeline/toolParams";
import {
  isFlagsTool,
  opToCommandLine,
  PIPELINE_KINDS,
  type FlagsOp,
  type ImportFileFormat,
  type PipelineOp,
} from "../pipeline/types";
import type { LibraryEntry, LibraryInputFile } from "./types";

function isFlagsOp(op: PipelineOp): op is FlagsOp {
  return isFlagsTool(op.kind);
}

export function entryCommand(pipeline: PipelineOp[]): string {
  return pipeline
    .filter((op) => op.enabled !== false)
    .map((op) => {
      try {
        return opToCommandLine(op);
      } catch {
        return op.kind;
      }
    })
    .join(" | ");
}

/** First loaded seed file in the pipeline, if any. */
export function inputFromPipeline(ops: PipelineOp[]): LibraryInputFile | null {
  const found = ops.find(
    (op) => op.kind === "import_file" && op.fileText.trim().length > 0,
  );
  if (!found || found.kind !== "import_file") return null;
  return {
    fileName: found.fileName,
    format: found.format,
    text: found.fileText,
  };
}

/** Clone a saved pipeline into an editor stack. */
export function pipelineForEditor(entry: LibraryEntry): PipelineOp[] {
  if (!Array.isArray(entry.pipeline)) {
    throw new Error("This entry has no pipeline");
  }
  for (const op of entry.pipeline) {
    if (!op || typeof op !== "object") {
      throw new Error("This entry's pipeline is unreadable");
    }
    const kind = op.kind;
    if (
      typeof kind !== "string" ||
      !(PIPELINE_KINDS as readonly string[]).includes(kind)
    ) {
      throw new Error(`This entry uses an unknown tool (${String(kind)})`);
    }
    if (typeof op.id !== "string") {
      throw new Error("This entry's pipeline is unreadable");
    }
  }

  const ops = JSON.parse(JSON.stringify(entry.pipeline)) as PipelineOp[];
  for (const op of ops) {
    if (!isFlagsOp(op)) continue;
    if (op.params == null || typeof op.params !== "object") {
      op.params = defaultParams(TOOL_PARAM_SCHEMAS[op.kind]);
    }
  }

  const input = entry.inputFile;
  if (input?.text) {
    for (const op of ops) {
      if (op.kind === "import_file" && !op.fileText.trim()) {
        op.fileText = input.text;
        if (!op.fileName) op.fileName = input.fileName;
        if (input.format === "off" || input.format === "obj") {
          op.format = input.format as ImportFileFormat;
        }
      }
    }
  }
  return ops;
}

export function clonePipeline(ops: PipelineOp[]): PipelineOp[] {
  return JSON.parse(JSON.stringify(ops)) as PipelineOp[];
}
