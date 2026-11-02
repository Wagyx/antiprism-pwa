import type { CommandStep } from "../pipeline/commandStep";

/** On-disk / in-database format id. Import rejects anything else. */
export const LIBRARY_FORMAT = "antiprism-library";

export const LIBRARY_VERSION = 1;

export type PolyCounts = {
  nVertices: number;
  nEdges: number;
  nFaces: number;
};

/** Seed file captured with the entry, when the pipeline loaded one. */
export type LibraryInputFile = {
  fileName: string;
  format: string;
  text: string;
};

export type LibraryEntry = {
  type: "entry";
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  inputFile: LibraryInputFile | null;
  /** Pipeline OFF output. The library viewer reads this directly. */
  offText: string;
  pipeline: CommandStep[];
  counts: PolyCounts;
};

export type LibraryFolder = {
  type: "folder";
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  children: LibraryNode[];
};

export type LibraryNode = LibraryFolder | LibraryEntry;

/**
 * One library is one JSON document.
 * `id` is stable for the life of the document. Renames change `name` only.
 */
export type LibraryDocument = {
  format: typeof LIBRARY_FORMAT;
  version: typeof LIBRARY_VERSION;
  id: string;
  name: string;
  /**
   * The library created on first launch. Stays first in the list.
   * Never set on imports.
   */
  pinned?: boolean;
  createdAt: string;
  modifiedAt: string;
  /** Virtual root. Its children are the top of the library. `name` is empty. */
  root: LibraryFolder;
};

export type LibraryLocation = {
  libraryId: string | null;
  /** Folder ids from the library root down to the open folder. */
  folderIds: string[];
};

export type EntryRef = {
  libraryId: string;
  entryId: string;
};

export type EntryDraft = {
  name: string;
  offText: string;
  pipeline: CommandStep[];
  inputFile: LibraryInputFile | null;
  counts: PolyCounts;
};

export type EntryLocation = {
  entry: LibraryEntry;
  folderIds: string[];
  folderNames: string[];
};
