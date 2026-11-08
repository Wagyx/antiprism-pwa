import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { BookOpen, Box, EllipsisVertical, Folder, Link } from "lucide-react";
import { createPortal } from "react-dom";
import { EXTERNAL_LIBRARIES, type ExternalLibrary } from "../library/externalLibraries";
import { entryCommand } from "../library/snapshot";
import { searchLibraries, EMPTY_SEARCH_FILTERS, searchFiltersActive, type RangeFilter, type SearchFilters } from "../library/search";
import {
  countEntries,
  findNode,
  folderByPath,
  moveDestinations,
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
import { AboutButton } from "./AboutButton";
import { CliPipelineDialog, type CliImportRow } from "./CliPipelineDialog";
import { useDismissDetails } from "./useDismissDetails";

type Props = {
  libraries: LibraryDocument[];
  ready: boolean;
  loadError: string | null;
  nav: LibraryLocation;
  onNavigate: (nav: LibraryLocation) => void;
  query: string;
  onQuery: (query: string) => void;
  selected: EntryRef | null;
  onSelect: (ref: EntryRef | null) => void;
  onEdit: (ref: EntryRef) => void;
  onCreateLibrary: (name: string) => Promise<void>;
  onRenameLibrary: (libraryId: string, name: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onImportExternal: (url: string) => Promise<void>;
  onExportJson: (libraryId: string) => Promise<void>;
  onExportZip: (libraryId: string) => Promise<void>;
  onExportDatabase: () => Promise<void>;
  onExportAllOff: () => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameNode: (libraryId: string, nodeId: string, name: string) => Promise<void>;
  onMoveNodes: (libraryId: string, nodeIds: string[], folderIds: string[]) => Promise<void>;
  onMoveUp: (libraryId: string, nodeIds: string[]) => Promise<void>;
  onDeleteLibrary: (libraryId: string) => Promise<void>;
  onDeleteNodes: (libraryId: string, nodeIds: string[]) => Promise<void>;
  onCreatePolyhedron: () => void;
  onImportFromCli: (rows: CliImportRow[]) => Promise<EntryRef>;
  onImportCatalog: (file: File, report: (message: string) => void) => Promise<EntryRef | null>;
};

type Pick = {
  libraryId: string;
  nodeId: string;
};

type DirItem =
  | { key: "up"; kind: "up" }
  | { key: string; kind: "library"; libraryId: string }
  | { key: string; kind: "external"; url: string }
  | { key: string; kind: "folder"; libraryId: string; nodeId: string }
  | { key: string; kind: "entry"; libraryId: string; nodeId: string };

function nodeKey(libraryId: string, nodeId: string): string {
  return `node:${libraryId}:${nodeId}`;
}

function pickKey(item: Pick): string {
  return `${item.libraryId}:${item.nodeId}`;
}

function fromCardControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("button, input, a, summary, details"));
}

function closeMenu(target: HTMLElement) {
  target.closest("details")?.removeAttribute("open");
}

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

function entryStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${day}/${month}/${date.getFullYear()}, ${hour}:${minute}`;
}

function entryStampTitle(entry: LibraryEntry): string {
  const created = entryStamp(entry.createdAt);
  const modified = entryStamp(entry.modifiedAt);
  if (!created || created === modified) return created ? `Created ${created}` : "";
  return `Created ${created}. Modified ${modified}`;
}

function RangeFields({
  label,
  kind,
  range,
  title,
  onChange,
}: {
  label: string;
  kind: "date" | "number";
  range: RangeFilter;
  title?: string;
  onChange: (patch: Partial<RangeFilter>) => void;
}) {
  const minLabel = kind === "date" ? `${label} from` : `${label} minimum`;
  const maxLabel = kind === "date" ? `${label} to` : `${label} maximum`;
  return (
    <div className={`lib-filter${range.enabled ? "" : " is-off"}`}>
      <label className="lib-filter-toggle" title={title}>
        <input
          type="checkbox"
          checked={range.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
        <span>{label}</span>
      </label>
      <div className="lib-filter-range">
        <input
          type={kind === "date" ? "text" : "number"}
          inputMode={kind === "date" ? "numeric" : undefined}
          aria-label={minLabel}
          placeholder={kind === "date" ? "dd/mm/yyyy" : "min"}
          value={range.min}
          disabled={!range.enabled}
          min={kind === "number" ? 0 : undefined}
          step={kind === "number" ? 1 : undefined}
          maxLength={kind === "date" ? 10 : undefined}
          autoComplete="off"
          onChange={(event) => onChange({ min: event.target.value })}
        />
        <span aria-hidden="true">–</span>
        <input
          type={kind === "date" ? "text" : "number"}
          inputMode={kind === "date" ? "numeric" : undefined}
          aria-label={maxLabel}
          placeholder={kind === "date" ? "dd/mm/yyyy" : "max"}
          value={range.max}
          disabled={!range.enabled}
          min={kind === "number" ? 0 : undefined}
          step={kind === "number" ? 1 : undefined}
          maxLength={kind === "date" ? 10 : undefined}
          autoComplete="off"
          onChange={(event) => onChange({ max: event.target.value })}
        />
      </div>
    </div>
  );
}

export function LibraryPanel({
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
  onImportExternal,
  onExportJson,
  onExportZip,
  onExportDatabase,
  onExportAllOff,
  onCreateFolder,
  onRenameNode,
  onMoveNodes,
  onMoveUp,
  onDeleteLibrary,
  onDeleteNodes,
  onCreatePolyhedron,
  onImportFromCli,
  onImportCatalog,
}: Props) {
  const importRef = useRef<HTMLInputElement>(null);
  const externalLock = useRef(false);
  const catalogRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composer, setComposer] = useState<"library" | "folder" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renaming, setRenaming] = useState<RenameState | null>(null);
  const [picked, setPicked] = useState<Pick[]>([]);
  const [cursorKey, setCursorKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Pick[] | null>(null);
  const [confirmLibraryId, setConfirmLibraryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cliOpen, setCliOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const renameLock = useRef(false);
  const cancelRename = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const dropKeyRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    libraryId: string;
    nodeIds: string[];
    label: string;
    active: boolean;
  } | null>(null);
  const actionRef = useRef<{
    libraryId: string | null;
    folderIds: string[];
    onMoveNodes: Props["onMoveNodes"];
    onMoveUp: Props["onMoveUp"];
    run: (fn: () => Promise<void>) => Promise<void>;
  } | null>(null);
  useDismissDetails();

  const ordered = sortLibraries(libraries);
  const openLibrary = nav.libraryId
    ? ordered.find((library) => library.id === nav.libraryId) ?? null
    : null;
  const openFolder = openLibrary ? folderByPath(openLibrary, nav.folderIds) : null;
  const filtering = searchFiltersActive(filters);
  const searching = query.trim().length > 0 || filtering;
  const search = searchLibraries(libraries, nav, query, filters);
  const moveLibraryId =
    picked.length > 0 && picked.every((item) => item.libraryId === picked[0]?.libraryId)
      ? picked[0].libraryId
      : null;
  const moveDoc = moveLibraryId
    ? ordered.find((library) => library.id === moveLibraryId) ?? null
    : null;

  const clearPick = () => {
    setPicked([]);
    anchorRef.current = null;
    setMoveOpen(false);
    setConfirmDelete(null);
    setConfirmLibraryId(null);
  };

  const navigate = (next: LibraryLocation) => {
    clearPick();
    onNavigate(next);
  };

  const changeQuery = (value: string) => {
    clearPick();
    onQuery(value);
  };

  const setFilter = (key: keyof SearchFilters, patch: Partial<RangeFilter>) => {
    clearPick();
    setFilters((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (picked.length === 0 || confirmDelete || confirmLibraryId || moveOpen) return;
      event.preventDefault();
      setConfirmDelete(picked);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, confirmDelete, confirmLibraryId, moveOpen]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardRef = useRef({
    blocked: false,
    items: [] as DirItem[],
    currentKey: null as string | null,
    select: (_item: DirItem) => {},
    open: (_item: DirItem) => {},
  });

  useEffect(() => {
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Enter") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const kb = keyboardRef.current;
      const searchInput = searchInputRef.current;
      if (event.target === searchInput && searchInput instanceof HTMLInputElement) {
        if (event.key === "Enter") return;
        const start = searchInput.selectionStart ?? 0;
        const end = searchInput.selectionEnd ?? 0;
        const collapsed = start === end;
        if (event.key === "ArrowRight" && !(collapsed && end === searchInput.value.length)) return;
        if (event.key === "ArrowLeft" && !(collapsed && start === 0)) return;
      } else if (typing(event.target)) {
        return;
      }
      if (kb.blocked || document.querySelector(".library-panel details[open]:not(.lib-advanced)")) return;
      if (event.key === "Enter") {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(".lib-grid article, .lib-grid a.lib-card")
        ) {
          return;
        }
        const item = kb.items.find((candidate) => candidate.key === kb.currentKey);
        if (!item) return;
        event.preventDefault();
        kb.open(item);
        return;
      }
      const count = kb.items.length;
      if (count === 0) return;
      const index = kb.items.findIndex((candidate) => candidate.key === kb.currentKey);
      const next =
        index < 0
          ? 0
          : event.key === "ArrowRight"
            ? (index + 1) % count
            : (index - 1 + count) % count;
      const item = kb.items[next];
      if (!item) return;
      event.preventDefault();
      kb.select(item);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!confirmDelete && !confirmLibraryId && !moveOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setConfirmDelete(null);
      setConfirmLibraryId(null);
      setMoveOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete, confirmLibraryId, moveOpen]);

  const run = async (fn: () => Promise<void>) => {
    try {
      setActionError(null);
      await fn();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const addExternal = (url: string) => {
    if (externalLock.current) return;
    externalLock.current = true;
    const library = EXTERNAL_LIBRARIES.find((entry) => entry.url === url);
    void run(async () => {
      setImportStatus(`Downloading ${library?.name ?? "library"}…`);
      try {
        await onImportExternal(url);
      } finally {
        externalLock.current = false;
        setImportStatus(null);
      }
    });
  };

  useEffect(() => {
    actionRef.current = {
      libraryId: openLibrary?.id ?? null,
      folderIds: nav.folderIds,
      onMoveNodes,
      onMoveUp,
      run,
    };
  });

  useEffect(() => {
    const canDrop = (libraryId: string, nodeIds: string[], key: string) => {
      const action = actionRef.current;
      if (!action || libraryId !== action.libraryId) return false;
      if (key === "up") return action.folderIds.length > 0;
      return nodeIds.some((id) => id !== key);
    };

    const showDrop = (key: string | null) => {
      if (dropKeyRef.current === key) return;
      dropKeyRef.current = key;
      setDropKey(key);
    };

    const clearDrag = () => {
      dragRef.current = null;
      showDrop(null);
      setDraggingIds(null);
      setDragGhost(null);
    };

    const releaseClick = () => {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 50);
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (dx * dx + dy * dy < 36) return;
        drag.active = true;
        suppressClick.current = true;
        setDraggingIds(drag.nodeIds);
      }
      event.preventDefault();
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const key =
        hit instanceof Element ? hit.closest("[data-drop]")?.getAttribute("data-drop") ?? null : null;
      showDrop(key && canDrop(drag.libraryId, drag.nodeIds, key) ? key : null);
      setDragGhost({
        x: event.clientX,
        y: event.clientY,
        label: drag.nodeIds.length === 1 ? drag.label : `${drag.nodeIds.length} items`,
      });
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const key = dropKeyRef.current;
      const active = drag.active;
      const libraryId = drag.libraryId;
      const nodeIds = drag.nodeIds;
      clearDrag();
      if (active) releaseClick();
      const action = actionRef.current;
      if (!active || !key || !action || !canDrop(libraryId, nodeIds, key)) return;
      const ids = key === "up" ? nodeIds : nodeIds.filter((id) => id !== key);
      if (ids.length === 0) return;
      const folderIds = key === "up" ? null : [...action.folderIds, key];
      void action.run(async () => {
        if (folderIds) await action.onMoveNodes(libraryId, ids, folderIds);
        else await action.onMoveUp(libraryId, ids);
        const moved = new Set(ids);
        setPicked((current) =>
          current.filter((item) => item.libraryId !== libraryId || !moved.has(item.nodeId)),
        );
        setCursorKey((current) =>
          current && ids.some((id) => current === nodeKey(libraryId, id)) ? null : current,
        );
        if (anchorRef.current && ids.some((id) => anchorRef.current === `${libraryId}:${id}`)) {
          anchorRef.current = null;
        }
      });
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current?.active) return;
      releaseClick();
      clearDrag();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const ignoreDragClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };

  const startDrag = (event: ReactPointerEvent, item: Pick, label: string) => {
    if (event.button !== 0 || fromCardControl(event.target)) return;
    const selected = picked.some((entry) => entry.libraryId === item.libraryId && entry.nodeId === item.nodeId);
    const group = selected ? picked.filter((entry) => entry.libraryId === item.libraryId) : [item];
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      libraryId: item.libraryId,
      nodeIds: group.map((entry) => entry.nodeId),
      label,
      active: false,
    };
  };

  const copyCommand = (command: string) => {
    void run(() => navigator.clipboard.writeText(command));
  };

  const goUp = () => {
    if (!openLibrary) return;
    if (nav.folderIds.length === 0) {
      navigate({ libraryId: null, folderIds: [] });
      return;
    }
    navigate({
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
  const parentKind: CardKind = nav.folderIds.length <= 1 ? "library" : "folder";

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

  const applyPick = (
    items: Pick[],
    index: number,
    event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  ) => {
    const item = items[index];
    if (!item) return;
    const key = pickKey(item);
    setCursorKey(nodeKey(item.libraryId, item.nodeId));
    if (event.shiftKey && anchorRef.current) {
      const anchor = items.findIndex((candidate) => pickKey(candidate) === anchorRef.current);
      if (anchor >= 0) {
        const lo = Math.min(anchor, index);
        const hi = Math.max(anchor, index);
        setPicked(items.slice(lo, hi + 1));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      setPicked((current) =>
        current.some((candidate) => pickKey(candidate) === key)
          ? current.filter((candidate) => pickKey(candidate) !== key)
          : [...current, item],
      );
    } else {
      setPicked([item]);
    }
    anchorRef.current = key;
  };

  const requestDelete = (item: Pick) => {
    const key = pickKey(item);
    const inPick = picked.some((candidate) => pickKey(candidate) === key);
    const group =
      inPick && picked.length > 1
        ? picked.filter((candidate) => candidate.libraryId === item.libraryId)
        : [item];
    setConfirmDelete(group);
  };

  const commitDelete = () => {
    const items = confirmDelete;
    if (!items || items.length === 0) return;
    setConfirmDelete(null);
    const byLib = new Map<string, string[]>();
    for (const item of items) {
      const list = byLib.get(item.libraryId) ?? [];
      list.push(item.nodeId);
      byLib.set(item.libraryId, list);
    }
    void run(async () => {
      const gone = new Set(items.map(pickKey));
      try {
        for (const [libraryId, ids] of byLib) await onDeleteNodes(libraryId, ids);
      } finally {
        setPicked((current) => current.filter((item) => !gone.has(pickKey(item))));
        anchorRef.current = null;
      }
    });
  };

  const commitLibraryDelete = () => {
    const libraryId = confirmLibraryId;
    if (!libraryId) return;
    setConfirmLibraryId(null);
    void run(() => onDeleteLibrary(libraryId));
  };

  const commitMove = (folderIds: string[]) => {
    if (!moveLibraryId) return;
    const ids = picked.map((item) => item.nodeId);
    setMoveOpen(false);
    void run(async () => {
      await onMoveNodes(moveLibraryId, ids, folderIds);
      setPicked([]);
      anchorRef.current = null;
    });
  };

  const commitMoveUp = () => {
    if (!moveLibraryId) return;
    const ids = picked.map((item) => item.nodeId);
    setMoveOpen(false);
    void run(async () => {
      await onMoveUp(moveLibraryId, ids);
      setPicked([]);
      anchorRef.current = null;
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

  const visibleNodes = openLibrary && openFolder ? sortedNodes(openFolder.children) : [];
  const dirItems: DirItem[] = searching
    ? (search.hits ?? []).map((hit) => ({
        key: nodeKey(hit.libraryId, hit.entry.id),
        kind: "entry" as const,
        libraryId: hit.libraryId,
        nodeId: hit.entry.id,
      }))
    : !openLibrary
      ? [
          ...ordered.map((library) => ({
            key: `library:${library.id}`,
            kind: "library" as const,
            libraryId: library.id,
          })),
          ...EXTERNAL_LIBRARIES.map((library) => ({
            key: `external:${library.id}`,
            kind: "external" as const,
            url: library.url,
          })),
        ]
      : openFolder
        ? [
            { key: "up" as const, kind: "up" as const },
            ...visibleNodes.map((node): DirItem =>
              node.type === "folder"
                ? {
                    key: nodeKey(openLibrary.id, node.id),
                    kind: "folder",
                    libraryId: openLibrary.id,
                    nodeId: node.id,
                  }
                : {
                    key: nodeKey(openLibrary.id, node.id),
                    kind: "entry",
                    libraryId: openLibrary.id,
                    nodeId: node.id,
                  },
            ),
          ]
        : [];
  const currentKey =
    (cursorKey && dirItems.some((item) => item.key === cursorKey) ? cursorKey : null) ??
    (selected
      ? dirItems.find(
          (item) =>
            item.kind === "entry" &&
            item.libraryId === selected.libraryId &&
            item.nodeId === selected.entryId,
        )?.key ?? null
      : null);

  const selectDirItem = (item: DirItem) => {
    setCursorKey(item.key);
    if (item.kind === "entry") {
      const pick = { libraryId: item.libraryId, nodeId: item.nodeId };
      setPicked([pick]);
      anchorRef.current = pickKey(pick);
      onSelect({ libraryId: item.libraryId, entryId: item.nodeId });
    } else if (item.kind === "folder") {
      const pick = { libraryId: item.libraryId, nodeId: item.nodeId };
      setPicked([pick]);
      anchorRef.current = pickKey(pick);
      onSelect(null);
    } else {
      setPicked([]);
      anchorRef.current = null;
      onSelect(null);
    }
    requestAnimationFrame(() => {
      const card = gridRef.current?.querySelector<HTMLElement>(
        `[data-dir="${CSS.escape(item.key)}"]`,
      );
      card?.scrollIntoView({ block: "nearest" });
      card?.focus({ preventScroll: true });
    });
  };

  const openDirItem = (item: DirItem) => {
    if (item.kind === "up") {
      goUp();
      return;
    }
    if (item.kind === "library") {
      navigate({ libraryId: item.libraryId, folderIds: [] });
      return;
    }
    if (item.kind === "external") {
      addExternal(item.url);
      return;
    }
    if (item.kind === "folder") {
      navigate({
        libraryId: item.libraryId,
        folderIds: [...nav.folderIds, item.nodeId],
      });
      return;
    }
    void run(() =>
      Promise.resolve(onEdit({ libraryId: item.libraryId, entryId: item.nodeId })),
    );
  };

  keyboardRef.current = {
    blocked: Boolean(confirmDelete || confirmLibraryId || moveOpen || cliOpen || renaming),
    items: dirItems,
    currentKey,
    select: selectDirItem,
    open: openDirItem,
  };

  const visiblePicks: Pick[] = searching
    ? (search.hits ?? []).map((hit) => ({ libraryId: hit.libraryId, nodeId: hit.entry.id }))
    : openLibrary
      ? visibleNodes.map((node) => ({ libraryId: openLibrary.id, nodeId: node.id }))
      : [];
  const pickedKeys = new Set(picked.map(pickKey));
  let destinations: ReturnType<typeof moveDestinations> | null = null;
  let destinationError: string | null = null;
  if (moveOpen && moveDoc && picked.length > 0) {
    try {
      destinations = moveDestinations(
        moveDoc,
        picked.map((item) => item.nodeId),
      );
    } catch (error) {
      destinationError = error instanceof Error ? error.message : String(error);
    }
  }
  const parentDest =
    destinations?.parent && destinations.parent !== "up" ? destinations.parent : null;
  const deleteRows = (confirmDelete ?? []).map((item) => {
    const doc = libraries.find((library) => library.id === item.libraryId);
    const node = doc ? findNode(doc, item.nodeId) : null;
    const qualify = new Set((confirmDelete ?? []).map((row) => row.libraryId)).size > 1;
    const name = node?.name ?? "Item";
    return {
      key: pickKey(item),
      name: qualify && doc ? `${doc.name} / ${name}` : name,
      type: node?.type ?? "entry",
    };
  });
  const deleteTitle =
    deleteRows.length === 1 && deleteRows[0]?.type === "folder"
      ? "Delete folder"
      : deleteRows.length === 1
        ? "Delete entry"
        : `Delete ${deleteRows.length} items`;
  const deleteBody =
    deleteRows.length === 1 && deleteRows[0]?.type === "folder"
      ? `Delete folder "${deleteRows[0].name}" and everything inside it? The library file is kept.`
      : deleteRows.length === 1
        ? `Delete "${deleteRows[0]?.name ?? "this entry"}"?`
        : `Delete these ${deleteRows.length} items?${
            deleteRows.some((row) => row.type === "folder")
              ? " Folders are removed with everything inside them."
              : ""
          } The library file is kept.`;
  const libraryToDelete = confirmLibraryId
    ? ordered.find((library) => library.id === confirmLibraryId) ?? null
    : null;
  const libraryDeleteCount = libraryToDelete ? countEntries(libraryToDelete.root) : 0;

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
          <div className="brand-title-row">
            <h1>Antiprism App</h1>
            <AboutButton />
          </div>
          <p className="brand-version">v{APP_VERSION}</p>
        </div>
      </div>
      <label className="field">
        <span>Search</span>
        <input
          ref={searchInputRef}
          value={query}
          placeholder="name or command"
          onChange={(event) => changeQuery(event.target.value)}
          autoComplete="off"
        />
      </label>
      <details className="lib-advanced">
        <summary>Advanced</summary>
        <div className="lib-filters">
          <RangeFields
            label="Date"
            kind="date"
            title="Modified date"
            range={filters.date}
            onChange={(patch) => setFilter("date", patch)}
          />
          <RangeFields
            label="Vertices"
            kind="number"
            range={filters.vertices}
            onChange={(patch) => setFilter("vertices", patch)}
          />
          <RangeFields
            label="Edges"
            kind="number"
            range={filters.edges}
            onChange={(patch) => setFilter("edges", patch)}
          />
          <RangeFields
            label="Faces"
            kind="number"
            range={filters.faces}
            onChange={(patch) => setFilter("faces", patch)}
          />
        </div>
      </details>
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
              New
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => importRef.current?.click()}
            >
              Import
            </button>
            <details className="add-op lib-drop">
              <summary className="add-op-btn">Export</summary>
              <div className="add-op-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    void run(() => onExportDatabase());
                  }}
                >
                  Export database
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    void run(() => onExportAllOff());
                  }}
                >
                  Zip all OFF files
                </button>
              </div>
            </details>
          </>
        ) : (
          <>
            <details className="add-op lib-drop">
              <summary className="add-op-btn">New</summary>
              <div className="add-op-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    setComposer("folder");
                    setDraftName("");
                  }}
                >
                  Folder
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    void run(async () => {
                      onCreatePolyhedron();
                    });
                  }}
                >
                  Polyhedron
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    setCliOpen(true);
                  }}
                >
                  Import from CLI
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={importStatus !== null}
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    catalogRef.current?.click();
                  }}
                >
                  Import JSON
                </button>
              </div>
            </details>
            <details className="add-op lib-drop">
              <summary className="add-op-btn">Export</summary>
              <div className="add-op-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    void run(() => onExportJson(openLibrary.id));
                  }}
                >
                  Export database
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    closeMenu(event.currentTarget);
                    void run(() => onExportZip(openLibrary.id));
                  }}
                >
                  Zip all OFF files
                </button>
              </div>
            </details>
          </>
        )}
        {picked.length > 0 ? (
          <>
            {/* <span className="lib-picked">{picked.length} selected</span> */}
            <button type="button" className="tool-btn" onClick={() => setConfirmDelete(picked)}>
              Delete
            </button>
          </>
        ) : null}
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
      <input
        ref={catalogRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || importStatus) return;
          void run(async () => {
            try {
              await onImportCatalog(file, setImportStatus);
            } finally {
              setImportStatus(null);
            }
          });
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
                <button type="button" onClick={() => navigate(crumb.nav)}>
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
      {importStatus ? <p className="hint">{importStatus}</p> : null}

      {dragGhost
        ? createPortal(
            <div className="lib-drag-ghost" style={{ left: dragGhost.x + 14, top: dragGhost.y + 14 }}>
              {dragGhost.label}
            </div>,
            document.body,
          )
        : null}

      <div
        ref={gridRef}
        className={`lib-grid${draggingIds ? " is-dragging" : ""}`}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          setPicked([]);
          anchorRef.current = null;
        }}
      >
        {searching ? (
          search.error || !search.hits ? null : search.hits.length === 0 ? (
            <p className="lib-empty">No matches.</p>
          ) : (
            search.hits.map((hit, index) => (
              <EntryCard
                key={`${hit.libraryId}:${hit.entry.id}`}
                entry={hit.entry}
                dirKey={nodeKey(hit.libraryId, hit.entry.id)}
                command={hit.command}
                path={[hit.libraryName, ...hit.folderNames].filter(Boolean).join(" / ")}
                selected={currentKey === nodeKey(hit.libraryId, hit.entry.id)}
                checked={pickedKeys.has(pickKey({ libraryId: hit.libraryId, nodeId: hit.entry.id }))}
                onPick={(event) => applyPick(visiblePicks, index, event)}
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
                  changeQuery("");
                  setFilters(EMPTY_SEARCH_FILTERS);
                  navigate({ libraryId: hit.libraryId, folderIds: hit.folderIds });
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
                onCopy={() => copyCommand(hit.command)}
                onDelete={() =>
                  requestDelete({ libraryId: hit.libraryId, nodeId: hit.entry.id })
                }
              />
            ))
          )
        ) : (
          <>
            {openLibrary && openFolder ? (
              <article
                className={`lib-card lib-card-up${currentKey === "up" ? " is-selected" : ""}${dropKey === "up" ? " is-drop" : ""}`}
                data-dir="up"
                data-drop="up"
                tabIndex={0}
                aria-label={`Up to ${parentName}`}
                title={
                  currentKey === "up"
                    ? undefined
                    : nav.folderIds.length > 0
                      ? "Double-click to open. Drop a selection here to move it to this folder."
                      : "Double-click to open"
                }
                onDoubleClick={goUp}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.target === event.currentTarget) goUp();
                }}
              >
                <div className="lib-card-head">
                  <div className="lib-card-title">
                    <KindIcon kind={parentKind} />
                    <span className="lib-card-name">{parentName}</span>
                  </div>
                </div>
                <p className="lib-meta">Up</p>
              </article>
            ) : null}

            {!openLibrary ? (
              <>
                {ordered.map((library) => (
                  <LibraryCard
                    key={library.id}
                    library={library}
                    selected={currentKey === `library:${library.id}`}
                    renaming={
                      renaming?.kind === "library" && renaming.libraryId === library.id
                        ? renaming
                        : null
                    }
                    onOpen={() =>
                      navigate({ libraryId: library.id, folderIds: [] })
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
                    onDelete={() => setConfirmLibraryId(library.id)}
                  />
                ))}
                <h2 className="lib-section">External libraries</h2>
                {EXTERNAL_LIBRARIES.map((library) => (
                  <ExternalLibraryCard
                    key={library.id}
                    library={library}
                    selected={currentKey === `external:${library.id}`}
                    onOpen={() => addExternal(library.url)}
                  />
                ))}
              </>
            ) : null}

            {openLibrary && openFolder
              ? visibleNodes.map((node, index) =>
                  node.type === "folder" ? (
                    <FolderCard
                      key={node.id}
                      folder={node}
                      dirKey={nodeKey(openLibrary.id, node.id)}
                      selected={currentKey === nodeKey(openLibrary.id, node.id)}
                      checked={pickedKeys.has(pickKey({ libraryId: openLibrary.id, nodeId: node.id }))}
                      dragging={draggingIds?.includes(node.id) ?? false}
                      dropTarget={dropKey === node.id}
                      ignoreDragClick={ignoreDragClick}
                      onPointerDown={(event) =>
                        startDrag(event, { libraryId: openLibrary.id, nodeId: node.id }, node.name)
                      }
                      onPick={(event) => applyPick(visiblePicks, index, event)}
                      renaming={
                        renaming?.kind === "node" && renaming.nodeId === node.id
                          ? renaming
                          : null
                      }
                      onOpen={() =>
                        navigate({
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
                      onDelete={() =>
                        requestDelete({ libraryId: openLibrary.id, nodeId: node.id })
                      }
                    />
                  ) : (
                    <EntryCard
                      key={node.id}
                      entry={node}
                      dirKey={nodeKey(openLibrary.id, node.id)}
                      command={entryCommand(node.pipeline)}
                      selected={currentKey === nodeKey(openLibrary.id, node.id)}
                      checked={pickedKeys.has(pickKey({ libraryId: openLibrary.id, nodeId: node.id }))}
                      dragging={draggingIds?.includes(node.id) ?? false}
                      ignoreDragClick={ignoreDragClick}
                      onPointerDown={(event) =>
                        startDrag(event, { libraryId: openLibrary.id, nodeId: node.id }, node.name)
                      }
                      onPick={(event) => applyPick(visiblePicks, index, event)}
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
                      onCopy={() => copyCommand(entryCommand(node.pipeline))}
                      onDelete={() =>
                        requestDelete({ libraryId: openLibrary.id, nodeId: node.id })
                      }
                    />
                  ),
                )
              : null}

            {openLibrary && openFolder && openFolder.children.length === 0 ? (
              <p className="lib-empty">
                This folder is empty. Use New, then Polyhedron, to create one.
              </p>
            ) : null}
          </>
        )}
      </div>
      {cliOpen ? (
        <CliPipelineDialog
          existingNames={openFolder?.children.map((child) => child.name) ?? []}
          onClose={() => setCliOpen(false)}
          onImport={async (rows) => {
            const ref = await onImportFromCli(rows);
            setCliOpen(false);
            setCursorKey(nodeKey(ref.libraryId, ref.entryId));
            const pick = { libraryId: ref.libraryId, nodeId: ref.entryId };
            setPicked([pick]);
            anchorRef.current = pickKey(pick);
            return ref;
          }}
        />
      ) : null}
      {confirmDelete
        ? createPortal(
        <div
          className="modal-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="modal is-danger"
            role="alertdialog"
            aria-labelledby="lib-delete-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="lib-delete-title">{deleteTitle}</h2>
            <p className="modal-note">{deleteBody}</p>
            {deleteRows.length > 1 ? (
              <ul className="lib-delete-list">
                {deleteRows.slice(0, 8).map((row) => (
                  <li key={row.key}>{row.name}</li>
                ))}
              </ul>
            ) : null}
            {deleteRows.length > 8 ? (
              <p className="modal-note">and {deleteRows.length - 8} more</p>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="tool-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className="tool-btn is-danger" onClick={commitDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
        )
        : null}
      {libraryToDelete
        ? createPortal(
        <div className="modal-backdrop" onClick={() => setConfirmLibraryId(null)}>
          <div
            className="modal is-danger"
            role="alertdialog"
            aria-labelledby="lib-delete-library-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="lib-delete-library-title">Delete library</h2>
            <p className="modal-note">
              {libraryDeleteCount === 0
                ? `Delete "${libraryToDelete.name}"? This removes the library file from this device.`
                : `Delete "${libraryToDelete.name}" and its ${libraryDeleteCount} ${libraryDeleteCount === 1 ? "entry" : "entries"}? This removes the library file from this device.`}
            </p>
            <div className="modal-actions">
              <button type="button" className="tool-btn" onClick={() => setConfirmLibraryId(null)}>
                Cancel
              </button>
              <button type="button" className="tool-btn is-danger" onClick={commitLibraryDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
        )
        : null}
      {moveOpen
        ? createPortal(
        <div className="modal-backdrop" onClick={() => setMoveOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-labelledby="lib-move-title"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="lib-move-title">Move {picked.length === 1 ? "item" : `${picked.length} items`}</h2>
            {destinationError ? (
              <p className="error" role="alert">{destinationError}</p>
            ) : null}
            {destinations && destinations.parent === null && destinations.folders.length === 0 ? (
              <p className="modal-note">No other folder to move into.</p>
            ) : null}
            <ul className="move-list">
              {destinations?.parent === "up" ? (
                <li>
                  <button type="button" onClick={commitMoveUp}>
                    Parent folder
                  </button>
                </li>
              ) : null}
              {parentDest ? (
                <li>
                  <button type="button" onClick={() => commitMove(parentDest.folderIds)}>
                    {parentDest.label}
                  </button>
                </li>
              ) : null}
              {destinations?.folders.map((folder) => (
                <li key={folder.folderIds.join("/") || "root"}>
                  <button type="button" onClick={() => commitMove(folder.folderIds)}>
                    {folder.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="tool-btn" onClick={() => setMoveOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
        )
        : null}
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

function CardMenu({
  children,
  onToggle,
}: {
  children: ReactNode;
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details
      className="add-op lib-card-menu"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className="lib-card-menu-btn" aria-label="Actions">
        <EllipsisVertical size={14} strokeWidth={1.5} aria-hidden />
      </summary>
      <div className="add-op-menu" role="menu">
        {children}
      </div>
    </details>
  );
}

function CardMenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation();
        closeMenu(event.currentTarget);
        onClick();
      }}
    >
      {children}
    </button>
  );
}

type CardKind = "library" | "folder" | "polyhedron" | "link";

const KIND_ICONS = {
  library: BookOpen,
  folder: Folder,
  polyhedron: Box,
  link: Link,
} as const;

function KindIcon({ kind }: { kind: CardKind }) {
  const Icon = KIND_ICONS[kind];
  return <Icon className="lib-card-icon" size={16} strokeWidth={1.5} aria-hidden />;
}

function CardTitle({
  kind,
  name,
  renaming,
  onRenameChange,
  onRenameKey,
  onRenameBlur,
}: { kind: CardKind; name: string } & RenameProps) {
  return (
    <div className="lib-card-title">
      <KindIcon kind={kind} />
      <NameField
        name={name}
        renaming={renaming}
        onRenameChange={onRenameChange}
        onRenameKey={onRenameKey}
        onRenameBlur={onRenameBlur}
      />
    </div>
  );
}

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
  selected,
  onOpen,
  onExportJson,
  onExportZip,
  onDelete,
  ...rename
}: {
  library: LibraryDocument;
  selected: boolean;
  onOpen: () => void;
  onExportJson: () => void;
  onExportZip: () => void;
  onDelete: () => void;
} & RenameProps) {
  const count = countEntries(library.root);
  return (
    <article
      className={`lib-card${selected ? " is-selected" : ""}`}
      data-dir={`library:${library.id}`}
      tabIndex={0}
      aria-label={library.name}
      title={selected ? undefined : "Double-click to open"}
      onDoubleClick={(event) => {
        if (fromCardControl(event.target)) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
    >
      <div className="lib-card-head">
        <CardTitle kind="library" name={library.name} {...rename} />
        <CardMenu>
          <CardMenuItem onClick={rename.onStartRename}>Rename</CardMenuItem>
          <CardMenuItem onClick={onExportJson}>Export database</CardMenuItem>
          <CardMenuItem onClick={onExportZip}>Export all OFF files</CardMenuItem>
          <CardMenuItem onClick={onDelete}>Delete</CardMenuItem>
        </CardMenu>
      </div>
      <p className="lib-meta">
        {count} {count === 1 ? "entry" : "entries"}
      </p>
    </article>
  );
}

function ExternalLibraryCard({
  library,
  selected,
  onOpen,
}: {
  library: ExternalLibrary;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <a
      className={`lib-card${selected ? " is-selected" : ""}`}
      data-dir={`external:${library.id}`}
      href={library.url}
      aria-label={library.name}
      title={selected ? undefined : "Add this library"}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="lib-card-head">
        <div className="lib-card-title">
          <KindIcon kind="link" />
          <span className="lib-card-name">{library.name}</span>
        </div>
      </div>
      <p className="lib-meta lib-external-url">{library.url}</p>
    </a>
  );
}

function FolderCard({
  folder,
  dirKey,
  selected,
  checked,
  dragging,
  dropTarget,
  ignoreDragClick,
  onPointerDown,
  onPick,
  onOpen,
  onDelete,
  ...rename
}: {
  folder: LibraryFolder;
  dirKey: string;
  selected: boolean;
  checked: boolean;
  dragging: boolean;
  dropTarget: boolean;
  ignoreDragClick: () => boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onPick: (event: ReactMouseEvent) => void;
  onOpen: () => void;
  onDelete: () => void;
} & RenameProps) {
  const count = countEntries(folder);
  return (
    <article
      className={`lib-card${checked ? " is-checked" : ""}${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop" : ""}`}
      data-dir={dirKey}
      data-drop={folder.id}
      tabIndex={0}
      aria-label={folder.name}
      aria-pressed={checked}
      title={
        selected
          ? undefined
          : "Double-click to open. Drop a selection here to move it into this folder."
      }
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (ignoreDragClick() || fromCardControl(event.target)) return;
        if (event.shiftKey) event.preventDefault();
        onPick(event);
      }}
      onDoubleClick={(event) => {
        if (fromCardControl(event.target)) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
      }}
    >
      <div className="lib-card-head">
        <CardTitle kind="folder" name={folder.name} {...rename} />
        <CardMenu>
          <CardMenuItem onClick={rename.onStartRename}>Rename</CardMenuItem>
          <CardMenuItem onClick={onDelete}>Delete</CardMenuItem>
        </CardMenu>
      </div>
      <p className="lib-meta">
        {count} {count === 1 ? "entry" : "entries"}
      </p>
    </article>
  );
}

function EntryCard({
  entry,
  dirKey,
  command,
  path,
  selected,
  checked,
  dragging = false,
  ignoreDragClick,
  onPointerDown,
  onPick,
  onOpen,
  onEdit,
  onCopy,
  onShow,
  onDelete,
  ...rename
}: {
  entry: LibraryEntry;
  dirKey: string;
  command: string;
  path?: string;
  selected: boolean;
  checked: boolean;
  dragging?: boolean;
  ignoreDragClick?: () => boolean;
  onPointerDown?: (event: ReactPointerEvent) => void;
  onPick: (event: ReactMouseEvent) => void;
  onOpen: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onShow?: () => void;
  onDelete: () => void;
} & RenameProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <article
      className={`lib-card${checked ? " is-checked" : ""}${selected ? " is-selected" : ""}${dragging ? " is-dragging" : ""}`}
      data-dir={dirKey}
      tabIndex={0}
      aria-label={entry.name}
      aria-pressed={checked}
      title={selected || menuOpen ? undefined : command || "Double-click to edit"}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (ignoreDragClick?.() || fromCardControl(event.target)) return;
        if (event.shiftKey) event.preventDefault();
        onPick(event);
        onOpen();
      }}
      onDoubleClick={(event) => {
        if (fromCardControl(event.target)) return;
        onEdit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onEdit();
      }}
    >
      <div className="lib-card-head">
        <CardTitle kind="polyhedron" name={entry.name} {...rename} />
        <CardMenu onToggle={setMenuOpen}>
          <CardMenuItem onClick={onEdit}>Edit</CardMenuItem>
          <CardMenuItem onClick={rename.onStartRename}>Rename</CardMenuItem>
          <CardMenuItem onClick={onCopy}>Copy command line</CardMenuItem>
          {onShow ? <CardMenuItem onClick={onShow}>Show</CardMenuItem> : null}
          <CardMenuItem onClick={onDelete}>Delete</CardMenuItem>
        </CardMenu>
      </div>
      {entryStamp(entry.modifiedAt) ? (
        <p className="lib-meta" title={entryStampTitle(entry)}>
          {entryStamp(entry.modifiedAt)}
        </p>
      ) : null}
      {path ? <p className="lib-path">{path}</p> : null}
      <p className="lib-counts">
        v:{entry.counts.nVertices} e:{entry.counts.nEdges} f:{entry.counts.nFaces}
      </p>
    </article>
  );
}
