import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parsePipelineCommand } from "../pipeline/parseCommand";
import type { PipelineOp } from "../pipeline/types";

type Props = {
  onCreate: (ops: PipelineOp[]) => void;
  onClose: () => void;
};

export function CliPipelineDialog({ onCreate, onClose }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
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

  const submit = () => {
    try {
      onCreate(parsePipelineCommand(text));
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
          submit();
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
        <p className="modal-note">Paste an Antiprism pipeline. Separate commands with |.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="tool-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tool-btn" disabled={!text.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
