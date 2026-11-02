import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LibraryInputFile } from "../library/types";
import { readStartingFile, type CommandStep } from "../pipeline/commandStep";
import { splitCommands } from "../pipeline/parseCommand";

export type CliDraft = {
  steps: CommandStep[];
  inputFile: LibraryInputFile | null;
};

type Props = {
  onCreate: (draft: CliDraft) => void;
  onClose: () => void;
};

export function CliPipelineDialog({ onCreate, onClose }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    try {
      const commands = text.trim() ? splitCommands(text) : [];
      if (commands.length === 0 && !file) {
        setError("Paste a pipeline or choose a starting file");
        return;
      }
      const inputFile = file ? await readStartingFile(file) : null;
      onCreate({
        steps: commands.map((command) => ({
          id: crypto.randomUUID(),
          enabled: true,
          command,
        })),
        inputFile,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return createPortal(
    <div className="modal-backdrop">
      <form
        className="modal modal-cli"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 id={titleId}>Polyhedron from CLI</h2>
        <label className="field">
          <span>Pipeline</span>
          <textarea
            ref={inputRef}
            value={text}
            rows={8}
            spellCheck={false}
            placeholder="polygon prism 5 | canonical"
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
          />
        </label>
        <label className="field">
          <span>Starting polyhedron</span>
          <input
            type="file"
            accept=".off,.obj,text/plain"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
          />
        </label>
        <p className="modal-note">
          Paste an Antiprism pipeline. Separate commands with |. The file is optional and is used
          when the first command reads a polyhedron.
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="tool-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tool-btn" disabled={!text.trim() && !file}>
            Create
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
