import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requireUnique } from "../library/tree";
import type { EntryRef, LibraryInputFile } from "../library/types";
import { readStartingFile, type CommandStep } from "../pipeline/commandStep";
import { splitCommands } from "../pipeline/parseCommand";

export type CliImportRow = {
  name: string;
  steps: CommandStep[];
  inputFile: LibraryInputFile | null;
};

type Props = {
  existingNames: string[];
  onImport: (rows: CliImportRow[]) => Promise<EntryRef>;
  onClose: () => void;
};

type Line = {
  id: string;
  name: string;
  command: string;
  file: File | null;
};

function blankLine(): Line {
  return { id: crypto.randomUUID(), name: "", command: "", file: null };
}

function lineFilled(line: Line): boolean {
  return Boolean(line.name.trim() || line.command.trim() || line.file);
}

export function CliPipelineDialog({ existingNames, onImport, onClose }: Props) {
  const titleId = useId();
  const focusId = useRef<string | null>(null);
  const [lines, setLines] = useState<Line[]>(() => [blankLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    document.getElementById(`cli-name-${id}`)?.focus();
  }, [lines]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const patch = (id: string, next: Partial<Line>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...next } : line)));
    setError(null);
  };

  const addLine = () => {
    const line = blankLine();
    focusId.current = line.id;
    setLines((current) => [...current, line]);
  };

  const removeLine = (id: string) => {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
    setError(null);
  };

  const ready = lines.some((line) => line.name.trim() && (line.command.trim() || line.file));

  const submit = async () => {
    const filled = lines.filter(lineFilled);
    if (filled.length === 0) {
      setError("Add a polyhedron");
      return;
    }
    const names = [...existingNames];
    for (let index = 0; index < filled.length; index += 1) {
      const line = filled[index];
      const where = `Line ${index + 1}`;
      if (!line.name.trim()) {
        setError(`${where}: name is empty`);
        return;
      }
      if (!line.command.trim() && !line.file) {
        setError(`${where}: add a command or a starting file`);
        return;
      }
      try {
        names.push(requireUnique(names, line.name));
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(`${where}: ${message}`);
        return;
      }
    }

    setPending(true);
    setError(null);
    try {
      const rows: CliImportRow[] = [];
      for (const line of filled) {
        const commands = line.command.trim() ? splitCommands(line.command) : [];
        rows.push({
          name: line.name.trim(),
          steps: commands.map((command) => ({
            id: crypto.randomUUID(),
            enabled: true,
            command,
          })),
          inputFile: line.file ? await readStartingFile(line.file) : null,
        });
      }
      await onImport(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPending(false);
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
          if (!pending) void submit();
        }}
      >
        <h2 id={titleId}>Import from CLI</h2>
        <p className="modal-note">
          Each line is one polyhedron. Separate commands with |. The starting file is used when
          the command reads a polyhedron.
        </p>
        <ul className="cli-lines">
          {lines.map((line, index) => (
            <li className="cli-row" key={line.id}>
              <label className="field">
                <span>Name</span>
                <input
                  id={`cli-name-${line.id}`}
                  value={line.name}
                  autoFocus={index === 0}
                  disabled={pending}
                  placeholder="prism"
                  onChange={(event) => patch(line.id, { name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Starting file</span>
                <input
                  type="file"
                  accept=".off,.obj,text/plain"
                  disabled={pending}
                  onChange={(event) => patch(line.id, { file: event.target.files?.[0] ?? null })}
                />
              </label>
              <label className="field">
                <span>Command</span>
                <input
                  className="op-command"
                  value={line.command}
                  disabled={pending}
                  spellCheck={false}
                  placeholder="polygon prism 5 | canonical"
                  onChange={(event) => patch(line.id, { command: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="tool-btn cli-remove"
                disabled={pending || lines.length === 1}
                onClick={() => removeLine(line.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="tool-btn cli-add" disabled={pending} onClick={addLine}>
          Add line
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="tool-btn" disabled={pending} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tool-btn" disabled={pending || !ready}>
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
