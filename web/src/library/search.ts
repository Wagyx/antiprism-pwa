import { entryCommand } from "./snapshot";
import type { LibraryDocument, LibraryEntry, LibraryFolder } from "./types";

export type SearchHit = {
  libraryId: string;
  libraryName: string;
  folderIds: string[];
  folderNames: string[];
  entry: LibraryEntry;
  command: string;
};

type CountField = "nVertices" | "nEdges" | "nFaces";
type TextField = "name" | "command";
type Cmp = "eq" | "gt" | "gte" | "lt" | "lte";

type Filter =
  | { kind: "text"; field: TextField; value: string }
  | { kind: "count"; field: CountField; cmp: Cmp; value: number };

type ParsedQuery = {
  active: boolean;
  error: string | null;
  filters: Filter[];
  text: string[];
};

const COUNT_FIELDS: Record<string, CountField> = {
  n_vertices: "nVertices",
  vertices: "nVertices",
  vertex: "nVertices",
  v: "nVertices",
  n_edges: "nEdges",
  edges: "nEdges",
  e: "nEdges",
  n_faces: "nFaces",
  faces: "nFaces",
  f: "nFaces",
};

const TEXT_FIELDS: Record<string, TextField> = {
  name: "name",
  cmd: "command",
  command: "command",
  antiprism: "command",
};

function tokenize(query: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  for (const match of query.matchAll(re)) {
    tokens.push(match[1] ?? match[2] ?? "");
  }
  return tokens.filter((token) => token.length > 0);
}

function parseCmp(op: string): Cmp {
  switch (op) {
    case ">":
      return "gt";
    case ">=":
      return "gte";
    case "<":
      return "lt";
    case "<=":
      return "lte";
    default:
      return "eq";
  }
}

function compare(actual: number, cmp: Cmp, expected: number): boolean {
  switch (cmp) {
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    default:
      return actual === expected;
  }
}

export function parseSearch(query: string): ParsedQuery {
  const tokens = tokenize(query.trim());
  if (tokens.length === 0) {
    return { active: false, error: null, filters: [], text: [] };
  }
  const filters: Filter[] = [];
  const text: string[] = [];
  for (const token of tokens) {
    const match = /^([A-Za-z_]+)(>=|<=|>|<|=|:)(.+)$/.exec(token);
    if (!match) {
      text.push(token);
      continue;
    }
    const field = match[1].toLowerCase();
    let op = match[2];
    let raw = match[3].trim();
    if ((op === ":" || op === "=") && /^(>=|<=|>|<)/.test(raw)) {
      const inner = /^(>=|<=|>|<)(.+)$/.exec(raw);
      if (inner) {
        op = inner[1];
        raw = inner[2].trim();
      }
    }
    if (!raw) return { active: true, error: `Missing value for ${field}`, filters, text };

    const countField = COUNT_FIELDS[field];
    if (countField) {
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        return { active: true, error: `${field} needs a number`, filters, text };
      }
      filters.push({ kind: "count", field: countField, cmp: parseCmp(op), value });
      continue;
    }
    const textField = TEXT_FIELDS[field];
    if (textField) {
      if (op !== ":" && op !== "=") {
        return { active: true, error: `${field} only supports :`, filters, text };
      }
      filters.push({ kind: "text", field: textField, value: raw });
      continue;
    }
    return { active: true, error: `Unknown property "${field}"`, filters, text };
  }
  return { active: true, error: null, filters, text };
}

function matches(entry: LibraryEntry, command: string, parsed: ParsedQuery): boolean {
  const name = entry.name.toLowerCase();
  const cmd = command.toLowerCase();
  for (const filter of parsed.filters) {
    if (filter.kind === "text") {
      const hay = filter.field === "name" ? name : cmd;
      if (!hay.includes(filter.value.toLowerCase())) return false;
      continue;
    }
    if (!compare(entry.counts[filter.field], filter.cmp, filter.value)) return false;
  }
  for (const token of parsed.text) {
    const needle = token.toLowerCase();
    if (!name.includes(needle) && !cmd.includes(needle)) return false;
  }
  return true;
}

function walk(
  library: LibraryDocument,
  folder: LibraryFolder,
  folderIds: string[],
  folderNames: string[],
  parsed: ParsedQuery,
  hits: SearchHit[],
) {
  for (const child of folder.children) {
    if (child.type === "folder") {
      walk(library, child, [...folderIds, child.id], [...folderNames, child.name], parsed, hits);
      continue;
    }
    const command = entryCommand(child.pipeline);
    if (!matches(child, command, parsed)) continue;
    hits.push({
      libraryId: library.id,
      libraryName: library.name,
      folderIds,
      folderNames,
      entry: child,
      command,
    });
  }
}

export function searchLibraries(
  libraries: LibraryDocument[],
  scope: { libraryId: string | null; folderIds: string[] },
  query: string,
): { error: string | null; hits: SearchHit[] | null } {
  const parsed = parseSearch(query);
  if (!parsed.active) return { error: null, hits: null };
  if (parsed.error) return { error: parsed.error, hits: [] };

  const hits: SearchHit[] = [];
  if (!scope.libraryId) {
    for (const library of libraries) {
      walk(library, library.root, [], [], parsed, hits);
    }
  } else {
    const library = libraries.find((item) => item.id === scope.libraryId);
    if (library) {
      let folder = library.root;
      const names: string[] = [];
      let ok = true;
      for (const id of scope.folderIds) {
        const next = folder.children.find(
          (child) => child.type === "folder" && child.id === id,
        );
        if (!next || next.type !== "folder") {
          ok = false;
          break;
        }
        names.push(next.name);
        folder = next;
      }
      if (ok) walk(library, folder, [...scope.folderIds], names, parsed, hits);
    }
  }

  hits.sort((a, b) => {
    const lib = a.libraryName.localeCompare(b.libraryName, undefined, { sensitivity: "base" });
    if (lib !== 0) return lib;
    const path = a.folderNames.join("/").localeCompare(b.folderNames.join("/"));
    if (path !== 0) return path;
    return a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: "base" });
  });
  return { error: null, hits };
}
