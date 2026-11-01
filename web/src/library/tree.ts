import { countsFromOff } from "./counts";
import {
  LIBRARY_FORMAT,
  LIBRARY_VERSION,
  type EntryDraft,
  type EntryLocation,
  type LibraryDocument,
  type LibraryEntry,
  type LibraryFolder,
  type LibraryLocation,
  type LibraryNode,
  type PolyCounts,
} from "./types";

const MAX_NODES = 10_000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function allocateName(existing: string[], wanted: string): string {
  const base = wanted.trim() || "Untitled";
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} (${i})`.toLowerCase())) i += 1;
  return `${base} (${i})`;
}

export function requireUnique(existing: string[], wanted: string): string {
  const name = wanted.trim();
  if (!name) throw new Error("Name is empty");
  if (name.length > 120) throw new Error("Name is too long");
  if (/[\\/]/.test(name)) throw new Error("Name cannot contain / or \\");
  const clash = existing.some((other) => other.toLowerCase() === name.toLowerCase());
  if (clash) throw new Error(`"${name}" is already used`);
  return name;
}

function emptyRoot(at: string): LibraryFolder {
  return {
    type: "folder",
    id: crypto.randomUUID(),
    name: "",
    createdAt: at,
    modifiedAt: at,
    children: [],
  };
}

export function createLibraryDocument(
  name: string,
  existingNames: string[],
  options?: { pinned?: boolean; allocate?: boolean },
): LibraryDocument {
  const at = nowIso();
  const finalName = options?.allocate
    ? allocateName(existingNames, name)
    : requireUnique(existingNames, name);
  return {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    id: crypto.randomUUID(),
    name: finalName,
    pinned: options?.pinned ?? false,
    createdAt: at,
    modifiedAt: at,
    root: emptyRoot(at),
  };
}

export function sortLibraries(libraries: LibraryDocument[]): LibraryDocument[] {
  return [...libraries].sort((a, b) => {
    const ap = a.pinned ? 0 : 1;
    const bp = b.pinned ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const an = a.name === "MyLibrary" ? 0 : 1;
    const bn = b.name === "MyLibrary" ? 0 : 1;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function folderByPath(
  doc: LibraryDocument,
  folderIds: string[],
): LibraryFolder | null {
  let current = doc.root;
  for (const id of folderIds) {
    const next = current.children.find(
      (child) => child.type === "folder" && child.id === id,
    );
    if (!next || next.type !== "folder") return null;
    current = next;
  }
  return current;
}

export function findEntry(doc: LibraryDocument, entryId: string): EntryLocation | null {
  const walk = (
    folder: LibraryFolder,
    folderIds: string[],
    folderNames: string[],
  ): EntryLocation | null => {
    for (const child of folder.children) {
      if (child.type === "entry" && child.id === entryId) {
        return { entry: child, folderIds, folderNames };
      }
      if (child.type === "folder") {
        const found = walk(
          child,
          [...folderIds, child.id],
          [...folderNames, child.name],
        );
        if (found) return found;
      }
    }
    return null;
  };
  return walk(doc.root, [], []);
}

export function countEntries(folder: LibraryFolder): number {
  let total = 0;
  for (const child of folder.children) {
    total += child.type === "entry" ? 1 : countEntries(child);
  }
  return total;
}

export function locationLabel(
  libraries: LibraryDocument[],
  libraryId: string,
  folderIds: string[],
): string {
  const doc = libraries.find((library) => library.id === libraryId);
  if (!doc) return "Library";
  const names = [doc.name];
  let folder = doc.root;
  for (const id of folderIds) {
    const next = folder.children.find(
      (child) => child.type === "folder" && child.id === id,
    );
    if (!next || next.type !== "folder") break;
    names.push(next.name);
    folder = next;
  }
  return names.join(" / ");
}

export function resolveDestination(
  libraries: LibraryDocument[],
  nav: LibraryLocation,
): { libraryId: string; folderIds: string[] } {
  if (nav.libraryId) {
    const doc = libraries.find((library) => library.id === nav.libraryId);
    if (doc && folderByPath(doc, nav.folderIds)) {
      return { libraryId: doc.id, folderIds: [...nav.folderIds] };
    }
  }
  const home =
    libraries.find((library) => library.pinned) ??
    libraries.find((library) => library.name === "MyLibrary") ??
    libraries[0];
  if (!home) throw new Error("No library to save into");
  return { libraryId: home.id, folderIds: [] };
}

function touch(doc: LibraryDocument, root: LibraryFolder): LibraryDocument {
  return { ...doc, modifiedAt: nowIso(), root };
}

function siblingNames(folder: LibraryFolder, ignoreId?: string): string[] {
  return folder.children.filter((child) => child.id !== ignoreId).map((child) => child.name);
}

function updateFolder(
  folder: LibraryFolder,
  folderIds: string[],
  update: (folder: LibraryFolder) => LibraryFolder,
): LibraryFolder {
  if (folderIds.length === 0) return update(folder);
  const [head, ...rest] = folderIds;
  let found = false;
  const children = folder.children.map((child) => {
    if (child.type !== "folder" || child.id !== head) return child;
    found = true;
    return updateFolder(child, rest, update);
  });
  if (!found) throw new Error("Folder not found");
  return { ...folder, modifiedAt: nowIso(), children };
}

export function renameLibrary(doc: LibraryDocument, name: string, existingNames: string[]): LibraryDocument {
  const nextName = requireUnique(
    existingNames.filter((other) => other.toLowerCase() !== doc.name.toLowerCase()),
    name,
  );
  return { ...doc, name: nextName, modifiedAt: nowIso() };
}

export function addFolder(
  doc: LibraryDocument,
  folderIds: string[],
  name: string,
): LibraryDocument {
  const root = updateFolder(doc.root, folderIds, (folder) => {
    const at = nowIso();
    const child: LibraryFolder = {
      type: "folder",
      id: crypto.randomUUID(),
      name: requireUnique(siblingNames(folder), name),
      createdAt: at,
      modifiedAt: at,
      children: [],
    };
    return { ...folder, modifiedAt: at, children: [...folder.children, child] };
  });
  return touch(doc, root);
}

export function insertEntry(
  doc: LibraryDocument,
  folderIds: string[],
  draft: EntryDraft,
): { doc: LibraryDocument; entry: LibraryEntry } {
  let created: LibraryEntry | null = null;
  const root = updateFolder(doc.root, folderIds, (folder) => {
    const at = nowIso();
    const entry: LibraryEntry = {
      type: "entry",
      id: crypto.randomUUID(),
      name: requireUnique(siblingNames(folder), draft.name),
      createdAt: at,
      modifiedAt: at,
      inputFile: draft.inputFile,
      offText: draft.offText,
      pipeline: draft.pipeline,
      counts: draft.counts,
    };
    created = entry;
    return { ...folder, modifiedAt: at, children: [...folder.children, entry] };
  });
  if (!created) throw new Error("Could not create the entry");
  return { doc: touch(doc, root), entry: created };
}

export function patchEntry(
  doc: LibraryDocument,
  entryId: string,
  draft: EntryDraft,
): LibraryDocument {
  let found = false;
  const visit = (folder: LibraryFolder): LibraryFolder => {
    let changed = false;
    const children = folder.children.map((child) => {
      if (child.type === "entry" && child.id === entryId) {
        found = true;
        changed = true;
        const at = nowIso();
        const next: LibraryEntry = {
          ...child,
          name: requireUnique(siblingNames(folder, entryId), draft.name),
          modifiedAt: at,
          inputFile: draft.inputFile,
          offText: draft.offText,
          pipeline: draft.pipeline,
          counts: draft.counts,
        };
        return next;
      }
      if (child.type === "folder") {
        const next = visit(child);
        if (next !== child) {
          changed = true;
          return next;
        }
      }
      return child;
    });
    if (!changed) return folder;
    return { ...folder, modifiedAt: nowIso(), children };
  };
  const root = visit(doc.root);
  if (!found) throw new Error("Entry not found");
  return touch(doc, root);
}

export function renameNode(
  doc: LibraryDocument,
  nodeId: string,
  name: string,
): LibraryDocument {
  if (nodeId === doc.root.id) throw new Error("The library root cannot be renamed");
  let found = false;
  const visit = (folder: LibraryFolder): LibraryFolder => {
    if (folder.children.some((child) => child.id === nodeId)) {
      found = true;
      const at = nowIso();
      return {
        ...folder,
        modifiedAt: at,
        children: folder.children.map((child) => {
          if (child.id !== nodeId) return child;
          return {
            ...child,
            name: requireUnique(siblingNames(folder, nodeId), name),
            modifiedAt: at,
          };
        }),
      };
    }
    let changed = false;
    const children = folder.children.map((child) => {
      if (child.type !== "folder") return child;
      const next = visit(child);
      if (next !== child) changed = true;
      return next;
    });
    if (!changed) return folder;
    return { ...folder, modifiedAt: nowIso(), children };
  };
  const root = visit(doc.root);
  if (!found) throw new Error("Item not found");
  return touch(doc, root);
}

export function findNode(doc: LibraryDocument, nodeId: string): LibraryNode | null {
  const walk = (folder: LibraryFolder): LibraryNode | null => {
    for (const child of folder.children) {
      if (child.id === nodeId) return child;
      if (child.type === "folder") {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(doc.root);
}

/** Folder ids of the folder that contains the node. Empty means the library root. */
export function containerOf(doc: LibraryDocument, nodeId: string): string[] | null {
  const walk = (folder: LibraryFolder, ids: string[]): string[] | null => {
    for (const child of folder.children) {
      if (child.id === nodeId) return ids;
      if (child.type === "folder") {
        const found = walk(child, [...ids, child.id]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(doc.root, []);
}

function folderSubtreeIds(node: LibraryNode, into: Set<string>) {
  if (node.type !== "folder") return;
  into.add(node.id);
  for (const child of node.children) folderSubtreeIds(child, into);
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Selected nodes that are not inside another selected folder. */
function topmostIds(doc: LibraryDocument, nodeIds: string[]): string[] {
  const selected = new Set(nodeIds);
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (id === doc.root.id) throw new Error("The library file stays on this device");
    const container = containerOf(doc, id);
    if (!container) throw new Error("Item not found");
    if (container.some((folderId) => selected.has(folderId))) continue;
    kept.push(id);
  }
  if (kept.length === 0) throw new Error("Item not found");
  return kept;
}

function detachNodes(
  root: LibraryFolder,
  nodeIds: Set<string>,
): { root: LibraryFolder; taken: LibraryNode[] } {
  const taken: LibraryNode[] = [];
  const visit = (folder: LibraryFolder): LibraryFolder => {
    let changed = false;
    const children: LibraryNode[] = [];
    for (const child of folder.children) {
      if (nodeIds.has(child.id)) {
        taken.push(child);
        changed = true;
        continue;
      }
      if (child.type === "folder") {
        const next = visit(child);
        if (next !== child) changed = true;
        children.push(next);
      } else {
        children.push(child);
      }
    }
    if (!changed) return folder;
    return { ...folder, modifiedAt: nowIso(), children };
  };
  return { root: visit(root), taken };
}

/** Remove folders or entries. A selected folder takes its selected descendants with it. */
export function removeNodes(doc: LibraryDocument, nodeIds: string[]): LibraryDocument {
  const ids = topmostIds(doc, nodeIds);
  const { root, taken } = detachNodes(doc.root, new Set(ids));
  if (taken.length !== ids.length) throw new Error("Item not found");
  return touch(doc, root);
}

/** Remove a folder or entry from inside the library. The library document stays. */
export function removeNode(doc: LibraryDocument, nodeId: string): LibraryDocument {
  return removeNodes(doc, [nodeId]);
}

function assertMovable(doc: LibraryDocument, ids: string[], folderIds: string[]) {
  if (!folderByPath(doc, folderIds)) throw new Error("Destination folder was not found");
  const blocked = new Set<string>();
  for (const id of ids) {
    const node = findNode(doc, id);
    if (!node) throw new Error("Item not found");
    if (node.type === "folder") folderSubtreeIds(node, blocked);
  }
  const destLeaf = folderIds[folderIds.length - 1];
  if ((destLeaf && blocked.has(destLeaf)) || folderIds.some((id) => ids.includes(id))) {
    throw new Error("A folder cannot be moved into itself");
  }
}

export function moveNodes(
  doc: LibraryDocument,
  nodeIds: string[],
  folderIds: string[],
): LibraryDocument {
  const ids = topmostIds(doc, nodeIds);
  assertMovable(doc, ids, folderIds);
  const { root, taken } = detachNodes(doc.root, new Set(ids));
  if (taken.length !== ids.length) throw new Error("Item not found");
  const dest = folderByPath({ ...doc, root }, folderIds);
  if (!dest) throw new Error("A folder cannot be moved into itself");
  const names = siblingNames(dest);
  for (const node of taken) {
    requireUnique(names, node.name);
    names.push(node.name);
  }
  const at = nowIso();
  const moved = taken.map((node) => ({ ...structuredClone(node), modifiedAt: at }));
  const nextRoot = updateFolder(root, folderIds, (folder) => ({
    ...folder,
    modifiedAt: at,
    children: [...folder.children, ...moved],
  }));
  return touch(doc, nextRoot);
}

/** Move each item up into its own parent. Items already at the library root stay put. */
export function moveNodesUp(doc: LibraryDocument, nodeIds: string[]): LibraryDocument {
  const ids = topmostIds(doc, nodeIds);
  const groups = new Map<string, { folderIds: string[]; ids: string[] }>();
  for (const id of ids) {
    const container = containerOf(doc, id);
    if (!container) throw new Error("Item not found");
    if (container.length === 0) continue;
    const folderIds = container.slice(0, -1);
    const key = folderIds.join("/");
    const group = groups.get(key) ?? { folderIds, ids: [] };
    group.ids.push(id);
    groups.set(key, group);
  }
  if (groups.size === 0) throw new Error("These items are already in the top folder");
  let next = doc;
  for (const group of groups.values()) next = moveNodes(next, group.ids, group.folderIds);
  return next;
}

export type MoveDestination = {
  folderIds: string[];
  label: string;
};

export function moveDestinations(
  doc: LibraryDocument,
  nodeIds: string[],
): { parent: MoveDestination | "up" | null; folders: MoveDestination[] } {
  const ids = topmostIds(doc, nodeIds);
  const blocked = new Set<string>();
  const containers: string[][] = [];
  for (const id of ids) {
    const node = findNode(doc, id);
    const container = containerOf(doc, id);
    if (!node || !container) continue;
    containers.push(container);
    if (node.type === "folder") folderSubtreeIds(node, blocked);
  }
  const first = containers[0] ?? [];
  const same = containers.every((path) => sameIds(path, first));
  let parent: MoveDestination | "up" | null = null;
  if (same && first.length > 0) {
    const folderIds = first.slice(0, -1);
    const parentId = folderIds[folderIds.length - 1];
    const label = parentId ? findNode(doc, parentId)?.name || "Parent" : doc.name;
    parent = { folderIds, label: `Parent · ${label}` };
  } else if (!same && containers.some((path) => path.length > 0)) {
    parent = "up";
  }
  const skip = same ? first : null;
  const folders: MoveDestination[] = [];
  const rootIsParent = parent !== null && parent !== "up" && parent.folderIds.length === 0;
  const rootIsCurrent = skip !== null && skip.length === 0;
  if (!rootIsParent && !rootIsCurrent) folders.push({ folderIds: [], label: doc.name });
  const walk = (folder: LibraryFolder, folderIds: string[], names: string[]) => {
    for (const child of folder.children) {
      if (child.type !== "folder" || blocked.has(child.id)) continue;
      const nextIds = [...folderIds, child.id];
      const nextNames = [...names, child.name];
      if (!skip || !sameIds(nextIds, skip)) {
        folders.push({ folderIds: nextIds, label: nextNames.join(" / ") });
      }
      walk(child, nextIds, nextNames);
    }
  };
  walk(doc.root, [], []);
  return { parent, folders };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCounts(value: unknown, offText: string, name: string): PolyCounts {
  if (isRecord(value)) {
    const nVertices = value.nVertices;
    const nEdges = value.nEdges;
    const nFaces = value.nFaces;
    if (
      typeof nVertices === "number" &&
      typeof nEdges === "number" &&
      typeof nFaces === "number"
    ) {
      return { nVertices, nEdges, nFaces };
    }
  }
  try {
    return countsFromOff(offText);
  } catch {
    throw new Error(`"${name}" has no readable OFF output`);
  }
}

function normalizeNode(
  value: unknown,
  seen: Set<string>,
  budget: { left: number },
): LibraryNode {
  if (budget.left <= 0) throw new Error("Library is too large");
  budget.left -= 1;
  if (!isRecord(value) || (value.type !== "folder" && value.type !== "entry")) {
    throw new Error("Library tree is invalid");
  }
  const id = typeof value.id === "string" && value.id ? value.id : crypto.randomUUID();
  const uniqueId = seen.has(id) ? crypto.randomUUID() : id;
  seen.add(uniqueId);
  const at = nowIso();
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : at;
  const modifiedAt = typeof value.modifiedAt === "string" ? value.modifiedAt : createdAt;
  const name = typeof value.name === "string" ? value.name : "Untitled";

  if (value.type === "folder") {
    if (!Array.isArray(value.children)) throw new Error(`Folder "${name}" is invalid`);
    return {
      type: "folder",
      id: uniqueId,
      name,
      createdAt,
      modifiedAt,
      children: value.children.map((child) => normalizeNode(child, seen, budget)),
    };
  }

  if (typeof value.offText !== "string" || !value.offText.trim()) {
    throw new Error(`"${name}" has no OFF output`);
  }
  const pipeline = Array.isArray(value.pipeline) ? value.pipeline : [];
  let inputFile: LibraryEntry["inputFile"] = null;
  if (isRecord(value.inputFile) && typeof value.inputFile.text === "string") {
    inputFile = {
      fileName: typeof value.inputFile.fileName === "string" ? value.inputFile.fileName : "",
      format: typeof value.inputFile.format === "string" ? value.inputFile.format : "off",
      text: value.inputFile.text,
    };
  }
  return {
    type: "entry",
    id: uniqueId,
    name,
    createdAt,
    modifiedAt,
    inputFile,
    offText: value.offText,
    pipeline: pipeline as LibraryEntry["pipeline"],
    counts: asCounts(value.counts, value.offText, name),
  };
}

/**
 * Parse an exported library. Always assigns a new document id so import
 * sits beside existing libraries and cannot replace one.
 */
export function importLibraryDocument(
  text: string,
  existingNames: string[],
): LibraryDocument {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("File is not JSON");
  }
  if (!isRecord(data)) throw new Error("Library file is not an object");
  if (data.format !== LIBRARY_FORMAT) throw new Error("Not an Antiprism library file");
  if (data.version !== LIBRARY_VERSION) {
    throw new Error("Unsupported library version");
  }
  const root = normalizeNode(data.root, new Set(), { left: MAX_NODES });
  if (root.type !== "folder") throw new Error("Library is missing a folder tree");
  const at = nowIso();
  const wanted = typeof data.name === "string" ? data.name : "Imported";
  return {
    format: LIBRARY_FORMAT,
    version: LIBRARY_VERSION,
    id: crypto.randomUUID(),
    name: allocateName(existingNames, wanted),
    pinned: false,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : at,
    modifiedAt: at,
    root: { ...root, name: "" },
  };
}

export function downloadBaseName(name: string): string {
  return safeFileName(name, "library");
}

const FILE_NAME_FORBIDDEN = new Set(["\\", "/", ":", "*", "?", '"', "<", ">", "|"]);

export function safeFileName(name: string, fallback: string): string {
  let out = "";
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 32 || FILE_NAME_FORBIDDEN.has(ch) ? "_" : ch;
  }
  const cleaned = out.trim() || fallback;
  return cleaned.slice(0, 80);
}
