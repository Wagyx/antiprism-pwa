import { useEffect, useId, useRef, useState } from "react";

type Props = {
  defaultName: string;
  canUpdate: boolean;
  updateLabel: string | null;
  createLabel: string;
  onUpdate: (name: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
};

export function SaveToLibraryDialog({
  defaultName,
  canUpdate,
  updateLabel,
  createLabel,
  onUpdate,
  onCreate,
  onClose,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"update" | "create" | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (action: "update" | "create") => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is empty");
      return;
    }
    setPending(action);
    setError(null);
    try {
      if (action === "update") await onUpdate(trimmed);
      else await onCreate(trimmed);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPending(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(canUpdate ? "update" : "create");
        }}
      >
        <h2 id={titleId}>Save to library</h2>
        <label className="field">
          <span>Name</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </label>
        {canUpdate && updateLabel ? (
          <p className="modal-note">Update keeps this entry in {updateLabel}.</p>
        ) : null}
        <p className="modal-note">A new entry is saved in {createLabel}.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          {canUpdate ? (
            <button
              type="submit"
              className="tool-btn"
              disabled={pending != null}
            >
              Update entry
            </button>
          ) : null}
          <button
            type="button"
            className="tool-btn"
            disabled={pending != null}
            onClick={() => void submit("create")}
          >
            {canUpdate ? "Save as new" : "Save entry"}
          </button>
          <button
            type="button"
            className="tool-btn"
            disabled={pending != null}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
