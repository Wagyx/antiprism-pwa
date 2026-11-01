import type { LibraryDocument, LibraryFolder } from "./types";
import { safeFileName } from "./tree";
import { buildStoredZip, type ZipFile } from "./zip";

/** OFF files for every entry, with the library's folder names as directories. */
export function libraryOffFiles(doc: LibraryDocument): ZipFile[] {
  const files: ZipFile[] = [];
  const used = new Set<string>();
  const encoder = new TextEncoder();

  const walk = (folder: LibraryFolder, segments: string[]) => {
    for (const child of folder.children) {
      if (child.type === "folder") {
        walk(child, [...segments, safeFileName(child.name, "untitled")]);
        continue;
      }
      const base = safeFileName(child.name, "untitled").replace(/\.off$/i, "");
      let path = [...segments, `${base}.off`].join("/");
      let n = 2;
      while (used.has(path.toLowerCase())) {
        path = [...segments, `${base} (${n}).off`].join("/");
        n += 1;
      }
      used.add(path.toLowerCase());
      files.push({ path, bytes: encoder.encode(child.offText) });
    }
  };

  walk(doc.root, [safeFileName(doc.name, "library")]);
  return files;
}

export function libraryOffZip(doc: LibraryDocument): Uint8Array {
  const files = libraryOffFiles(doc);
  if (files.length === 0) throw new Error("This library has no entries");
  return buildStoredZip(files);
}

function uniqueZipPath(path: string, used: Set<string>): string {
  const claim = (candidate: string) => {
    used.add(candidate.toLowerCase());
    return candidate;
  };
  if (!used.has(path.toLowerCase())) return claim(path);
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  const stem = dot >= 0 ? file.slice(0, dot) : file;
  const ext = dot >= 0 ? file.slice(dot) : "";
  let n = 2;
  let next = `${dir}${stem} (${n})${ext}`;
  while (used.has(next.toLowerCase())) {
    n += 1;
    next = `${dir}${stem} (${n})${ext}`;
  }
  return claim(next);
}

/** One JSON file per library, so each can be imported on its own. */
export function librariesDatabaseZip(docs: LibraryDocument[]): Uint8Array {
  if (docs.length === 0) throw new Error("No libraries to export");
  const used = new Set<string>();
  const encoder = new TextEncoder();
  const files = docs.map((doc) => ({
    path: uniqueZipPath(`${safeFileName(doc.name, "library")}.json`, used),
    bytes: encoder.encode(JSON.stringify(doc, null, 2)),
  }));
  return buildStoredZip(files);
}

export function librariesOffZip(docs: LibraryDocument[]): Uint8Array {
  const used = new Set<string>();
  const files: ZipFile[] = [];
  for (const doc of docs) {
    for (const file of libraryOffFiles(doc)) {
      files.push({ path: uniqueZipPath(file.path, used), bytes: file.bytes });
    }
  }
  if (files.length === 0) throw new Error("No entries to export");
  return buildStoredZip(files);
}
