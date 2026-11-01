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
