import { useEffect, useMemo, useRef, useState } from "react";
import { saveBlob, saveTextFile } from "../io/saveTextFile";
import { librariesDatabaseZip, librariesOffZip, libraryDocumentsFromZip, libraryOffZip } from "./archive";
import { migrateLibrary } from "./snapshot";
import { loadLibraries, readLibraryFile, removeLibraryRecord, saveLibrary } from "./store";
import {
  addFolder,
  createLibraryDocument,
  downloadBaseName,
  findEntry,
  folderByPath,
  insertEntries,
  insertEntry,
  insertGroups,
  moveNodes,
  moveNodesUp,
  patchEntry,
  removeNodes,
  renameLibrary,
  renameNode,
  sortLibraries,
} from "./tree";
import type {
  EntryDraft,
  EntryRef,
  LibraryDocument,
  LibraryLocation,
} from "./types";

function replaceDoc(libraries: LibraryDocument[], doc: LibraryDocument): LibraryDocument[] {
  return sortLibraries(libraries.map((library) => (library.id === doc.id ? doc : library)));
}

/**
 * Library zips hosted beside the production app send no CORS header.
 * From another origin, ask this app's own server for `/libraries/…`
 * (Vite proxies that path in development).
 */
function libraryRequestUrl(url: string): string {
  const target = new URL(url, window.location.href);
  if (target.origin === window.location.origin) return target.href;
  const marker = "/libraries/";
  const at = target.pathname.indexOf(marker);
  if (at < 0) return target.href;
  return new URL(target.pathname.slice(at + 1), document.baseURI).href;
}

function correctNav(
  libraries: LibraryDocument[],
  nav: LibraryLocation,
  ready: boolean,
): LibraryLocation {
  if (!ready || !nav.libraryId) return nav;
  const doc = libraries.find((library) => library.id === nav.libraryId);
  if (!doc) return { libraryId: null, folderIds: [] };
  if (!folderByPath(doc, nav.folderIds)) return { libraryId: doc.id, folderIds: [] };
  return nav;
}

export function useLibrary() {
  const [libraries, setLibraries] = useState<LibraryDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navState, setNavState] = useState<LibraryLocation>({ libraryId: null, folderIds: [] });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EntryRef | null>(null);

  const librariesRef = useRef(libraries);
  const navRef = useRef(navState);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const nav = useMemo(
    () => correctNav(libraries, navState, ready),
    [libraries, navState, ready],
  );

  useEffect(() => {
    navRef.current = nav;
  }, [nav]);

  const updateNav = (
    next: LibraryLocation | ((current: LibraryLocation) => LibraryLocation),
  ) => {
    const value = typeof next === "function" ? next(navRef.current) : next;
    navRef.current = value;
    setNavState(value);
  };

  const commit = (next: LibraryDocument[]) => {
    const sorted = sortLibraries(next);
    librariesRef.current = sorted;
    setLibraries(sorted);
  };

  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(fn, fn);
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  useEffect(() => {
    let cancelled = false;
    loadLibraries()
      .then((docs) => {
        if (cancelled) return;
        const migrated = docs.map(migrateLibrary);
        librariesRef.current = migrated;
        setLibraries(migrated);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createLibrary = (name: string) =>
    enqueue(async () => {
      const doc = createLibraryDocument(
        name,
        librariesRef.current.map((library) => library.name),
      );
      await saveLibrary(doc);
      commit([...librariesRef.current, doc]);
    });

  const renameLibraryById = (libraryId: string, name: string) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = renameLibrary(
        doc,
        name,
        librariesRef.current.map((library) => library.name),
      );
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
    });

  const importLibrary = (file: File) =>
    enqueue(async () => {
      const doc = await readLibraryFile(
        file,
        librariesRef.current.map((library) => library.name),
      );
      await saveLibrary(doc);
      commit([...librariesRef.current, doc]);
    });

  const importExternal = (url: string) =>
    enqueue(async () => {
      let response: Response;
      try {
        response = await fetch(libraryRequestUrl(url));
      } catch {
        throw new Error("Could not download the library");
      }
      if (!response.ok) throw new Error(`Could not download the library (${response.status})`);
      const docs = await libraryDocumentsFromZip(
        new Uint8Array(await response.arrayBuffer()),
        librariesRef.current.map((library) => library.name),
      );
      for (const doc of docs) await saveLibrary(doc);
      commit([...librariesRef.current, ...docs]);
      const first = docs[0];
      if (first) updateNav({ libraryId: first.id, folderIds: [] });
    });

  const exportJson = async (libraryId: string) => {
    const doc = librariesRef.current.find((library) => library.id === libraryId);
    if (!doc) throw new Error("Library not found");
    await saveTextFile(
      JSON.stringify(doc, null, 2),
      `${downloadBaseName(doc.name)}.json`,
      "application/json",
    );
  };

  const exportZip = async (libraryId: string) => {
    const doc = librariesRef.current.find((library) => library.id === libraryId);
    if (!doc) throw new Error("Library not found");
    const bytes = libraryOffZip(doc);
    await saveBlob(
      new Blob([Uint8Array.from(bytes)], { type: "application/zip" }),
      `${downloadBaseName(doc.name)}-off.zip`,
    );
  };

  const exportDatabase = async () => {
    const bytes = librariesDatabaseZip(librariesRef.current);
    await saveBlob(
      new Blob([Uint8Array.from(bytes)], { type: "application/zip" }),
      "antiprism-libraries.zip",
    );
  };

  const exportAllOff = async () => {
    const bytes = librariesOffZip(librariesRef.current);
    await saveBlob(
      new Blob([Uint8Array.from(bytes)], { type: "application/zip" }),
      "antiprism-off.zip",
    );
  };

  const createFolder = (name: string) =>
    enqueue(async () => {
      const libraryId = navRef.current.libraryId;
      if (!libraryId) throw new Error("Open a library first");
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = addFolder(doc, navRef.current.folderIds, name);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
    });

  const renameItem = (libraryId: string, nodeId: string, name: string) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = renameNode(doc, nodeId, name);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
    });

  const moveItems = (libraryId: string, nodeIds: string[], folderIds: string[]) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = moveNodes(doc, nodeIds, folderIds);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
    });

  const moveItemsUp = (libraryId: string, nodeIds: string[]) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = moveNodesUp(doc, nodeIds);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
    });

  const deleteLibrary = (libraryId: string) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      await removeLibraryRecord(libraryId);
      commit(librariesRef.current.filter((library) => library.id !== libraryId));
      setSelected((current) => (current?.libraryId === libraryId ? null : current));
      updateNav((current) =>
        current.libraryId === libraryId ? { libraryId: null, folderIds: [] } : current,
      );
    });

  const deleteItems = (libraryId: string, nodeIds: string[]) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === libraryId);
      if (!doc) throw new Error("Library not found");
      const next = removeNodes(doc, nodeIds);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
      setSelected((current) => {
        if (!current || current.libraryId !== libraryId) return current;
        return findEntry(next, current.entryId) ? current : null;
      });
      updateNav((current) => {
        if (current.libraryId !== libraryId) return current;
        return folderByPath(next, current.folderIds)
          ? current
          : { libraryId, folderIds: [] };
      });
      return next;
    });

  const createEntry = (
    draft: EntryDraft,
    location: { libraryId: string; folderIds: string[] },
  ) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === location.libraryId);
      if (!doc) throw new Error("Library not found");
      if (!folderByPath(doc, location.folderIds)) throw new Error("Folder not found");
      const { doc: next, entry } = insertEntry(doc, location.folderIds, draft);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
      const ref = { libraryId: next.id, entryId: entry.id };
      setSelected(ref);
      return ref;
    });

  const createEntries = (
    drafts: EntryDraft[],
    location: { libraryId: string; folderIds: string[] },
  ) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === location.libraryId);
      if (!doc) throw new Error("Library not found");
      if (!folderByPath(doc, location.folderIds)) throw new Error("Folder not found");
      const { doc: next, entries } = insertEntries(doc, location.folderIds, drafts);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
      const last = entries[entries.length - 1];
      if (!last) throw new Error("Nothing to import");
      const ref = { libraryId: next.id, entryId: last.id };
      setSelected(ref);
      return ref;
    });

  const createGroups = (
    groups: { name: string; entries: EntryDraft[] }[],
    location: { libraryId: string; folderIds: string[] },
  ) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === location.libraryId);
      if (!doc) throw new Error("Library not found");
      if (!folderByPath(doc, location.folderIds)) throw new Error("Folder not found");
      const { doc: next, entry } = insertGroups(doc, location.folderIds, groups);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
      if (!entry) return null;
      const ref = { libraryId: next.id, entryId: entry.id };
      setSelected(ref);
      return ref;
    });

  const updateEntry = (ref: EntryRef, draft: EntryDraft) =>
    enqueue(async () => {
      const doc = librariesRef.current.find((library) => library.id === ref.libraryId);
      if (!doc) throw new Error("Library not found");
      const next = patchEntry(doc, ref.entryId, draft);
      await saveLibrary(next);
      commit(replaceDoc(librariesRef.current, next));
      setSelected(ref);
    });

  return {
    libraries,
    ready,
    loadError,
    nav,
    setNav: updateNav,
    query,
    setQuery,
    selected,
    setSelected,
    createLibrary,
    renameLibraryById,
    importLibrary,
    importExternal,
    exportJson,
    exportZip,
    exportDatabase,
    exportAllOff,
    createFolder,
    renameItem,
    moveItems,
    moveItemsUp,
    deleteLibrary,
    deleteItems,
    createEntry,
    createEntries,
    createGroups,
    updateEntry,
  };
}
