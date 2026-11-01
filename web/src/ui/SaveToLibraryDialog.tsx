import { useEffect, useId, useRef, useState } from "react";
import { folderByPath, sortLibraries } from "../library/tree";
import type { LibraryDocument, LibraryLocation } from "../library/types";

type SaveLocation = { libraryId: string; folderIds: string[] };

type SaveProps = {
  libraries: LibraryDocument[];
  initialLocation: SaveLocation;
  defaultName: string;
  title: string;
  onSave: (name: string, location: SaveLocation) => Promise<void>;
  onClose: () => void;
};

export function SavePolyhedronDialog({
  libraries,
  initialLocation,
  defaultName,
  title,
  onSave,
  onClose,
}: SaveProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);
  const [location, setLocation] = useState<LibraryLocation>(initialLocation);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  const doc = location.libraryId
    ? libraries.find((library) => library.id === location.libraryId) ?? null
    : null;
  const folder = doc ? folderByPath(doc, location.folderIds) : null;
  const folderNames = (() => {
    if (!doc) return [];
    const names: string[] = [];
    let current = doc.root;
    for (const id of location.folderIds) {
      const next = current.children.find((child) => child.type === "folder" && child.id === id);
      if (!next || next.type !== "folder") break;
      names.push(next.name);
      current = next;
    }
    return names;
  })();
  const place = doc ? [doc.name, ...folderNames].join(" / ") : "Libraries";
  const folders = folder
    ? folder.children
        .filter((child) => child.type === "folder")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    : [];
  const libraryChoices = sortLibraries(libraries);

  const goUp = () => {
    if (!location.libraryId) return;
    if (location.folderIds.length === 0) {
      setLocation({ libraryId: null, folderIds: [] });
      return;
    }
    setLocation({
      libraryId: location.libraryId,
      folderIds: location.folderIds.slice(0, -1),
    });
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is empty");
      return;
    }
    if (!doc || !folder || !location.libraryId) {
      setError("Choose a library");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave(trimmed, { libraryId: location.libraryId, folderIds: location.folderIds });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPending(false);
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
          void submit();
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <label className="field">
          <span>Name</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </label>
        <p className="modal-note">Save in {place}</p>
        <ul className="move-list">
          {location.libraryId ? (
            <li>
              <button type="button" onClick={goUp} disabled={pending}>
                Up
              </button>
            </li>
          ) : null}
          {doc
            ? folders.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      setLocation({
                        libraryId: doc.id,
                        folderIds: [...location.folderIds, child.id],
                      })
                    }
                  >
                    {child.name}
                  </button>
                </li>
              ))
            : libraryChoices.map((library) => (
                <li key={library.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setLocation({ libraryId: library.id, folderIds: [] })}
                  >
                    {library.name}
                  </button>
                </li>
              ))}
        </ul>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="submit" className="tool-btn" disabled={pending}>
            Save
          </button>
          <button type="button" className="tool-btn" disabled={pending} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

type LeaveProps = {
  name: string | null;
  pending: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function UnsavedChangesDialog({
  name,
  pending,
  error,
  onSave,
  onDiscard,
  onCancel,
}: LeaveProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>Unsaved changes</h2>
        <p className="modal-note">
          {name
            ? `Save changes to "${name}" before leaving the editor?`
            : "Save this polyhedron before leaving the editor?"}
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="tool-btn" disabled={pending} onClick={onSave}>
            Save
          </button>
          <button type="button" className="tool-btn is-danger" disabled={pending} onClick={onDiscard}>
            Discard
          </button>
          <button type="button" className="tool-btn" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
