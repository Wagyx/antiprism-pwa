import { migrateLibrary, migratePipeline, type CommandStep } from "../pipeline/commandStep";
import type { LibraryEntry, LibraryInputFile } from "./types";

export { migrateLibrary };

/** Enabled commands, joined the way a shell pipeline is written. */
export function entryCommand(pipeline: CommandStep[]): string {
  return pipeline
    .filter((step) => step.enabled !== false && step.command.trim())
    .map((step) => step.command.trim())
    .join(" | ");
}

/** Clone a saved pipeline into an editor stack. */
export function pipelineForEditor(entry: LibraryEntry): CommandStep[] {
  return migratePipeline(entry.pipeline, entry.inputFile).steps;
}

/** Starting file for the editor, including one lifted from an old import_file step. */
export function inputForEditor(entry: LibraryEntry): LibraryInputFile | null {
  return migratePipeline(entry.pipeline, entry.inputFile).inputFile;
}

export function cloneSteps(steps: CommandStep[]): CommandStep[] {
  return steps.map((step) => ({ ...step }));
}
