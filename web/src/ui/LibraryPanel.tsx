import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { entryCommand } from "../library/snapshot";
import { searchLibraries } from "../library/search";
import {
  countEntries,
  folderByPath,
  sortLibraries,
} from "../library/tree";
import type {
  EntryRef,
  LibraryDocument,
  LibraryEntry,
  LibraryFolder,
  LibraryLocation,
  LibraryNode,
} from "../library/types";
import { APP_VERSION } from "../version";
import { ModeSwitch, type Mode } from "./ModeSwitch";

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  libraries: LibraryDocument[];
  ready: boolean;
  loadError: string | null;
  nav: LibraryLocation;
  onNavigate: (nav: LibraryLocation) => void;
  query: string;
  onQuery: (query: string) => void;
  selected: EntryRef | null;
  onSelect: (ref: EntryRef) => void;
  onEdit: (ref: EntryRef) => void;
  onCreateLibrary: (name: string) => Promise<void>;
  onRenameLibrary: (libraryId: string, name: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onExportJson: (libraryId: string) => Promise<void>;
  onExportZip: (libraryId: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameNode: (libraryId: string, nodeId: string, name: string) => Promise<void>;
  onDeleteNode: (libraryId: string, nodeId: string) => Promise<void>;
  canSaveCurrent: boolean;
  onSaveCurrent: () => void;
};

type RenameState = {
  kind: "library" | "node";
  libraryId: string;
  nodeId: string;
  value: string;
  original: string;
};

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sortedNodes(nodes: LibraryNode[]): LibraryNode[] {
  const folders = nodes.filter((node) => node.type === "folder").sort(byName);
  const entries = nodes.filter((node) => node.type === "entry").sort(byName);
  return [...folders, ...entries];
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LibraryPanel({
  mode,
  onModeChange,
  libraries,
  ready,
  loadError,
  nav,
  onNavigate,
  query,
  onQuery,
  selected,
  onSelect,
  onEdit,
  onCreateLibrary,
  onRenameLibrary,
  onImport,
  onExportJson,
  onExportZip,
  onCreateFolder,
  onRenameNode,
  onDeleteNode,
  canSaveCurrent,
  onSaveCurrent,
}: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composer, setComposer] = useState<"library" | "folder" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renaming, setRenaming] = useState<RenameState | null>(null);
  const renameLock = useRef(false);
  const cancelRename = useRef(false);

  const ordered = sortLibraries(libraries);
  const openLibrary = nav.libraryId
    ? ordered.find((library) => library.id === nav.libraryId) ?? null
    : null;
  const openFolder = openLibrary ? folderByPath(openLibrary, nav.folderIds) : null;
  const searching = query.trim().length > 0;
  const search = searchLibraries(libraries, nav, query);

  const run = async (fn: () => Promise<void>) => {
    try {
      setActionError(null);
      await fn();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const goUp = () => {
    if (!openLibrary) return;
    if (nav.folderIds.length === 0) {
      onNavigate({ libraryId: null, folderIds: [] });
      return;
    }
    onNavigate({
      libraryId: openLibrary.id,
      folderIds: nav.folderIds.slice(0, -1),
    });
  };

  const parentName = (() => {
    if (!openLibrary) return "Libraries";
    if (nav.folderIds.length === 0) return "Libraries";
    if (nav.folderIds.length === 1) return openLibrary.name;
    const parent = folderByPath(openLibrary, nav.folderIds.slice(0, -1));
    return parent?.name || openLibrary.name;
  })();

  const submitComposer = () => {
    const name = draftName;
    const kind = composer;
    setComposer(null);
    setDraftName("");
    if (!kind) return;
    void run(() =>
      kind === "library" ? onCreateLibrary(name) : onCreateFolder(name),
    );
  };

  const commitRename = (state: RenameState) => {
    if (renameLock.current || cancelRename.current) return;
    const next = state.value.trim();
    setRenaming(null);
    if (!next || next === state.original) return;
    renameLock.current = true;
    void run(async () => {
      try {
        if (state.kind === "library") await onRenameLibrary(state.libraryId, next);
        else await onRenameNode(state.libraryId, state.nodeId, next);
      } finally {
        renameLock.current = false;
      }
    });
  };

  const onRenameKey = (event: ReactKeyboardEvent<HTMLInputElement>, state: RenameState) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(state);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelRename.current = true;
      setRenaming(null);
    }
  };

  const crumbs: { label: string; nav: LibraryLocation }[] = [
    { label: "Libraries", nav: { libraryId: null, folderIds: [] } },
  ];
  if (openLibrary) {
    crumbs.push({
      label: openLibrary.name,
      nav: { libraryId: openLibrary.id, folderIds: [] },
    });
    let folder = openLibrary.root;
    const ids: string[] = [];
    for (const id of nav.folderIds) {
      const next = folder.children.find(
        (child) => child.type === "folder" && child.id === id,
      );
      if (!next || next.type !== "folder") break;
      ids.push(id);
      crumbs.push({
        label: next.name,
        nav: { libraryId: openLibrary.id, folderIds: [...ids] },
      });
      folder = next;
    }
  }

  return (
    <aside className="controls library-panel">
      <div className="brand">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          width={36}
          height={36}
          alt=""
        />
        <div className="brand-text">
          <h1>Library</h1>
          <p className="brand-version">v{APP_VERSION}</p>
        </div>
      </div>
      <ModeSwitch mode={mode} onChange={onModeChange} />

      <label className="field">
        <span>Search</span>
        <input
          value={query}
          placeholder="name, n_faces:20, command…"
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
        />
      </label>
      <p className="lib-scope">
        {searching
          ? openLibrary
            ? "This folder and subfolders"
            : "All libraries"
          : "\u00a0"}
      </p>

      <div className="lib-toolbar">
        {!openLibrary ? (
          <>
            <button
              type="button"
              className="tool-btn"
              onClick={() => {
                setComposer("library");
                setDraftName("");
              }}
            >
              New library
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => importRef.current?.click()}
            >
              Import library
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="tool-btn"
              onClick={() => {
                setComposer("folder");
                setDraftName("");
              }}
            >
              New folder
            </button>
            <button
              type="button"
              className="tool-btn"
              disabled={!canSaveCurrent}
              title={canSaveCurrent ? "Save the editor result here" : "Nothing to save yet"}
              onClick={onSaveCurrent}
            >
              Save current
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => void run(() => onExportJson(openLibrary.id))}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => void run(() => onExportZip(openLibrary.id))}
            >
              Export OFF zip
            </button>
          </>
        )}
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(() => onImport(file));
        }}
      />

      {composer ? (
        <form
          className="lib-name-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitComposer();
          }}
        >
          <input
            autoFocus
            value={draftName}
            placeholder={composer === "library" ? "Library name" : "Folder name"}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button type="submit" className="tool-btn">
            Create
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => setComposer(null)}
          >
            Cancel
          </button>
        </form>
      ) : null}

      <nav className="lib-crumbs" aria-label="Library location">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="lib-crumb">
              {index > 0 ? <span className="lib-crumb-sep">/</span> : null}
              {last ? (
                <span>{crumb.label}</span>
              ) : (
                <button type="button" onClick={() => onNavigate(crumb.nav)}>
                  {crumb.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      {loadError || actionError || search.error ? (
        <p className="error" role="alert">
          {actionError || search.error || loadError}
        </p>
      ) : null}

      {!ready ? <p className="hint">Loading libraries…</p> : null}

      <div className="lib-grid">
        {searching ? (
          search.error || !search.hits ? null : search.hits.length === 0 ? (
            <p className="lib-empty">No matches.</p>
          ) : (
            search.hits.map((hit) => (
              <EntryCard
                key={`${hit.libraryId}:${hit.entry.id}`}
                entry={hit.entry}
                command={hit.command}
                path={[hit.libraryName, ...hit.folderNames].filter(Boolean).join(" / ")}
                selected={
                  selected?.libraryId === hit.libraryId &&
                  selected.entryId === hit.entry.id
                }
                renaming={
                  renaming?.kind === "node" &&
                  renaming.libraryId === hit.libraryId &&
                  renaming.nodeId === hit.entry.id
                    ? renaming
                    : null
                }
                onOpen={() => onSelect({ libraryId: hit.libraryId, entryId: hit.entry.id })}
                onEdit={() =>
                  void run(() => Promise.resolve(onEdit({ libraryId: hit.libraryId, entryId: hit.entry.id })))
                }
                onShow={() => {
                  onQuery("");
                  onNavigate({ libraryId: hit.libraryId, folderIds: hit.folderIds });
                  onSelect({ libraryId: hit.libraryId, entryId: hit.entry.id });
                }}
                onStartRename={() =>
                  setRenaming({
                    kind: "node",
                    libraryId: hit.libraryId,
                    nodeId: hit.entry.id,
                    value: hit.entry.name,
                    original: hit.entry.name,
                  })
                }
                onRenameChange={(value) =>
                  setRenaming((current) => (current ? { ...current, value } : current))
                }
                onRenameKey={(event) => renaming && onRenameKey(event, renaming)}
                onRenameBlur={() => {
                  if (cancelRename.current) {
                    cancelRename.current = false;
                    return;
                  }
                  if (renaming) commitRename(renaming);
                }}
                onDelete={() => {
                  const ok = window.confirm(`Delete "${hit.entry.name}"?`);
                  if (!ok) return;
                  void run(() => onDeleteNode(hit.libraryId, hit.entry.id));
                }}
              />
            ))
          )
        ) : (
          <>
            {openLibrary && openFolder ? (
              <button type="button" className="lib-card lib-card-up" onClick={goUp}>
                <span className="lib-kicker">Up</span>
                <span className="lib-card-name">{parentName}</span>
              </button>
            ) : null}

            {!openLibrary
              ? ordered.map((library) => (
                  <LibraryCard
                    key={library.id}
                    library={library}
                    renaming={
                      renaming?.kind === "library" && renaming.libraryId === library.id
                        ? renaming
                        : null
                    }
                    onOpen={() =>
                      onNavigate({ libraryId: library.id, folderIds: [] })
                    }
                    onStartRename={() =>
                      setRenaming({
                        kind: "library",
                        libraryId: library.id,
                        nodeId: library.id,
                        value: library.name,
                        original: library.name,
                      })
                    }
                    onRenameChange={(value) =>
                      setRenaming((current) => (current ? { ...current, value } : current))
                    }
                    onRenameKey={(event) => renaming && onRenameKey(event, renaming)}
                    onRenameBlur={() => {
                      if (cancelRename.current) {
                        cancelRename.current = false;
                        return;
                      }
                      if (renaming) commitRename(renaming);
                    }}
                    onExportJson={() => void run(() => onExportJson(library.id))}
                    onExportZip={() => void run(() => onExportZip(library.id))}
                  />
                ))
              : null}

            {openLibrary && openFolder
              ? sortedNodes(openFolder.children).map((node) =>
                  node.type === "folder" ? (
                    <FolderCard
                      key={node.id}
                      folder={node}
                      renaming={
                        renaming?.kind === "node" && renaming.nodeId === node.id
                          ? renaming
                          : null
                      }
                      onOpen={() =>
                        onNavigate({
                          libraryId: openLibrary.id,
                          folderIds: [...nav.folderIds, node.id],
                        })
                      }
                      onStartRename={() =>
                        setRenaming({
                          kind: "node",
                          libraryId: openLibrary.id,
                          nodeId: node.id,
                          value: node.name,
                          original: node.name,
                        })
                      }
                      onRenameChange={(value) =>
                        setRenaming((current) =>
                          current ? { ...current, value } : current,
                        )
                      }
                      onRenameKey={(event) => renaming && onRenameKey(event, renaming)}
                      onRenameBlur={() => {
                        if (cancelRename.current) {
                          cancelRename.current = false;
                          return;
                        }
                        if (renaming) commitRename(renaming);
                      }}
                      onDelete={() => {
                        const ok = window.confirm(
                          `Delete folder "${node.name}" and everything inside it? The library file is kept.`,
                        );
                        if (!ok) return;
                        void run(() => onDeleteNode(openLibrary.id, node.id));
                      }}
                    />
                  ) : (
                    <EntryCard
                      key={node.id}
                      entry={node}
                      command={entryCommand(node.pipeline)}
                      selected={
                        selected?.libraryId === openLibrary.id &&
                        selected.entryId === node.id
                      }
                      renaming={
                        renaming?.kind === "node" && renaming.nodeId === node.id
                          ? renaming
                          : null
                      }
                      onOpen={() =>
                        onSelect({ libraryId: openLibrary.id, entryId: node.id })
                      }
                      onEdit={() =>
                        void run(() =>
                          Promise.resolve(
                            onEdit({ libraryId: openLibrary.id, entryId: node.id }),
                          ),
                        )
                      }
                      onStartRename={() =>
                        setRenaming({
                          kind: "node",
                          libraryId: openLibrary.id,
                          nodeId: node.id,
                          value: node.name,
                          original: node.name,
                        })
                      }
                      onRenameChange={(value) =>
                        setRenaming((current) =>
                          current ? { ...current, value } : current,
                        )
                      }
                      onRenameKey={(event) => renaming && onRenameKey(event, renaming)}
                      onRenameBlur={() => {
                        if (cancelRename.current) {
                          cancelRename.current = false;
                          return;
                        }
                        if (renaming) commitRename(renaming);
                      }}
                      onDelete={() => {
                        const ok = window.confirm(`Delete "${node.name}"?`);
                        if (!ok) return;
                        void run(() => onDeleteNode(openLibrary.id, node.id));
                      }}
                    />
                  ),
                )
              : null}

            {openLibrary && openFolder && openFolder.children.length === 0 ? (
              <p className="lib-empty">
                This folder is empty. Save a polyhedron from the editor to add an entry.
              </p>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

type RenameProps = {
  renaming: RenameState | null;
  onStartRename: () => void;
  onRenameChange: (value: string) => void;
  onRenameKey: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onRenameBlur: () => void;
};

function NameField({
  name,
  renaming,
  onRenameChange,
  onRenameKey,
  onRenameBlur,
}: {
  name: string;
} & Omit<RenameProps, "onStartRename">) {
  if (!renaming) return <span className="lib-card-name">{name}</span>;
  return (
    <input
      className="lib-rename"
      autoFocus
      value={renaming.value}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onRenameChange(event.target.value)}
      onKeyDown={onRenameKey}
      onBlur={onRenameBlur}
    />
  );
}

function LibraryCard({
  library,
  onOpen,
  onExportJson,
  onExportZip,
  ...rename
}: {
  library: LibraryDocument;
  onOpen: () => void;
  onExportJson: () => void;
  onExportZip: () => void;
} & RenameProps) {
  const count = countEntries(library.root);
  return (
    <article
      className="lib-card"
      tabIndex={0}
      aria-label={library.name}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
    >
      <span className="lib-kicker">Library</span>
      <NameField
        name={library.name}
        renaming={rename.renaming}
        onRenameChange={rename.onRenameChange}
        onRenameKey={rename.onRenameKey}
        onRenameBlur={rename.onRenameBlur}
      />
      <p className="lib-meta">
        {count} {count === 1 ? "entry" : "entries"}
      </p>
      <div className="lib-card-actions">
        <button type="button" onClick={(event) => { event.stopPropagation(); rename.onStartRename(); }}>
          Rename
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onExportJson(); }}>
          JSON
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onExportZip(); }}>
          OFF zip
        </button>
      </div>
    </article>
  );
}

function FolderCard({
  folder,
  onOpen,
  onDelete,
  ...rename
}: {
  folder: LibraryFolder;
  onOpen: () => void;
  onDelete: () => void;
} & RenameProps) {
  return (
    <article
      className="lib-card"
      tabIndex={0}
      aria-label={folder.name}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
    >
      <span className="lib-kicker">Folder</span>
      <NameField
        name={folder.name}
        renaming={rename.renaming}
        onRenameChange={rename.onRenameChange}
        onRenameKey={rename.onRenameKey}
        onRenameBlur={rename.onRenameBlur}
      />
      <p className="lib-meta">
        {folder.children.length} {folder.children.length === 1 ? "item" : "items"}
      </p>
      <div className="lib-card-actions">
        <button type="button" onClick={(event) => { event.stopPropagation(); rename.onStartRename(); }}>
          Rename
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }}>
          Delete
        </button>
      </div>
    </article>
  );
}

function EntryCard({
  entry,
  command,
  path,
  selected,
  onOpen,
  onEdit,
  onShow,
  onDelete,
  ...rename
}: {
  entry: LibraryEntry;
  command: string;
  path?: string;
  selected: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onShow?: () => void;
  onDelete: () => void;
} & RenameProps) {
  return (
    <article
      className={`lib-card${selected ? " is-selected" : ""}`}
      tabIndex={0}
      aria-label={entry.name}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
    >
      <span className="lib-kicker">{shortDate(entry.modifiedAt) || "Entry"}</span>
      <NameField
        name={entry.name}
        renaming={rename.renaming}
        onRenameChange={rename.onRenameChange}
        onRenameKey={rename.onRenameKey}
        onRenameBlur={rename.onRenameBlur}
      />
      {path ? <p className="lib-path">{path}</p> : null}
      <ul className="lib-counts">
        <li>
          <span>n_vertices</span> {entry.counts.nVertices}
        </li>
        <li>
          <span>n_edges</span> {entry.counts.nEdges}
        </li>
        <li>
          <span>n_faces</span> {entry.counts.nFaces}
        </li>
      </ul>
      <p className="lib-cmd" title={command}>
        {command || "—"}
      </p>
      <div className="lib-card-actions">
        <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }}>
          Edit
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); rename.onStartRename(); }}>
          Rename
        </button>
        {onShow ? (
          <button type="button" onClick={(event) => { event.stopPropagation(); onShow(); }}>
            Show
          </button>
        ) : null}
        <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }}>
          Delete
        </button>
      </div>
    </article>
  );
}
