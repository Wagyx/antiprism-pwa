import { librariesDatabaseZip, libraryDocumentsFromZip, libraryOffZip } from "../../web/src/library/archive.ts";
import { parsePolyhedronCatalog } from "../../web/src/library/polyhedronCatalog.ts";
import { parseSearch, searchLibraries } from "../../web/src/library/search.ts";
import {
  addFolder,
  createLibraryDocument,
  findNode,
  insertEntries,
  insertEntry,
  insertGroups,
  moveDestinations,
  moveNodes,
  moveNodesUp,
  removeNode,
  removeNodes,
  renameLibrary,
  renameNode,
} from "../../web/src/library/tree.ts";
import { buildStoredZip } from "../../web/src/library/zip.ts";
import type { EntryDraft } from "../../web/src/library/types.ts";
import { writeFileSync } from "node:fs";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const off = `OFF
4 4 6
0 0 0
1 0 0
0 1 0
0 0 1
3 0 1 2
3 0 1 3
3 0 2 3
3 1 2 3
`;

const draft: EntryDraft = {
  name: "tetra",
  offText: off,
  pipeline: [],
  inputFile: null,
  counts: { nVertices: 4, nEdges: 6, nFaces: 4 },
};

const home = createLibraryDocument("MyLibrary", [], { pinned: true });
assert(home.pinned === true, "default library is pinned");
assert(home.id.length > 0, "library id");

let doc = addFolder(home, [], "solids");
const folderId = doc.root.children[0]?.id;
assert(folderId, "folder id");
const inserted = insertEntry(doc, [folderId], draft);
doc = inserted.doc;
assert(doc.id === home.id, "entry insert keeps the library id");
assert(inserted.entry.createdAt.length > 0, "created");

let threw = false;
try {
  insertEntry(doc, [folderId], draft);
} catch {
  threw = true;
}
assert(threw, "duplicate entry name is rejected");

doc = renameNode(doc, inserted.entry.id, "tetrahedron");
assert(doc.id === home.id, "rename keeps the library id");

const other = createLibraryDocument("Archive", [doc.name]);
let unique = false;
try {
  renameLibrary(other, "MyLibrary", [doc.name, other.name]);
} catch {
  unique = true;
}
assert(unique, "library names are unique");

const hits = searchLibraries([doc], { libraryId: null, folderIds: [] }, "n_faces:4 tetra");
assert(hits.hits?.length === 1, "search finds the entry");
const scoped = searchLibraries([doc], { libraryId: doc.id, folderIds: [] }, "n_vertices:>=4");
assert(scoped.hits?.length === 1, "count compare");
const missed = searchLibraries([doc], { libraryId: doc.id, folderIds: [folderId] }, "n_edges:<6");
assert(missed.hits?.length === 0, "lower bound excludes");
const bad = parseSearch("n_faces:nope");
assert(bad.error != null, "bad number");

const boxed = addFolder(doc, [], "box");
const box = boxed.root.children.find((child) => child.type === "folder" && child.name === "box");
assert(box?.type === "folder", "box folder");
const moved = moveNodes(boxed, [inserted.entry.id], [box.id]);
const boxAfter = findNode(moved, box.id);
assert(
  boxAfter?.type === "folder" && boxAfter.children.some((child) => child.id === inserted.entry.id),
  "entry moved into box",
);
const solidsAfter = findNode(moved, folderId);
assert(solidsAfter?.type === "folder" && solidsAfter.children.length === 0, "source folder emptied");
const raised = moveNodesUp(moved, [inserted.entry.id]);
assert(raised.root.children.some((child) => child.id === inserted.entry.id), "moved up to the library");
const destinations = moveDestinations(boxed, [inserted.entry.id]);
assert(
  destinations.parent !== "up" && destinations.parent?.folderIds.length === 0,
  "parent destination is the library root",
);
assert(destinations.folders.some((folder) => folder.folderIds[0] === box.id), "other folder is offered");
assert(
  !destinations.folders.some((folder) => folder.folderIds.length === 1 && folder.folderIds[0] === folderId),
  "current folder is not a destination",
);
const duplicate = insertEntry(raised, [box.id], { ...draft, name: "tetrahedron" });
let clash = false;
try {
  moveNodes(duplicate.doc, [duplicate.entry.id], []);
} catch {
  clash = true;
}
assert(clash, "move rejects a sibling name clash");
assert(findNode(duplicate.doc, duplicate.entry.id)?.type === "entry", "clash leaves the entry in place");
let intoSelf = false;
try {
  moveNodes(boxed, [folderId], [folderId]);
} catch {
  intoSelf = true;
}
assert(intoSelf, "folder cannot move into itself");
const withInner = addFolder(doc, [folderId], "inner");
const solidsNow = findNode(withInner, folderId);
const innerId = solidsNow?.type === "folder"
  ? solidsNow.children.find((child) => child.type === "folder")?.id
  : undefined;
assert(innerId, "inner folder");
let intoChild = false;
try {
  moveNodes(withInner, [folderId], [folderId, innerId]);
} catch {
  intoChild = true;
}
assert(intoChild, "folder cannot move into a child");
const pruned = removeNodes(doc, [folderId, inserted.entry.id]);
assert(pruned.id === doc.id, "bulk delete keeps the library");
assert(findNode(pruned, inserted.entry.id) === null, "nested selection is removed with its folder");
assert(pruned.root.children.length === 0, "selected folder is removed once");

const removed = removeNode(doc, inserted.entry.id);
assert(removed.id === doc.id, "delete keeps the library document");
assert(removed.root.children.length === 1, "folder remains");
assert(removed.root.children[0]?.type === "folder", "folder type");
if (removed.root.children[0]?.type === "folder") {
  assert(removed.root.children[0].children.length === 0, "entry removed");
}

const zip = buildStoredZip([
  { path: "MyLibrary/solids/tetra.off", bytes: new TextEncoder().encode(off) },
]);
assert(zip[0] === 0x50 && zip[1] === 0x4b, "zip magic");
writeFileSync("/tmp/antiprism-library-test.zip", zip);

const batch = insertEntries(createLibraryDocument("Batch", ["MyLibrary"]), [], [
  { ...draft, name: "alpha" },
  { ...draft, name: "beta" },
]);
assert(batch.entries.length === 2, "batch import creates both entries");
assert(
  batch.doc.root.children.filter((child) => child.type === "entry").length === 2,
  "both entries are stored",
);
let repeated = false;
try {
  insertEntries(batch.doc, [], [
    { ...draft, name: "gamma" },
    { ...draft, name: "gamma" },
  ]);
} catch {
  repeated = true;
}
assert(repeated, "batch import rejects a repeated name");

const catalog = parsePolyhedronCatalog(
  JSON.stringify({
    Platonic: [{ name: "Tetrahedron", command: "off_util tet" }],
    Catalan: [{ name: "Rhombic Dodecahedron", command: "off_util rd" }],
  }),
);
assert(
  catalog.length === 2 &&
    catalog[0]?.items[0]?.command === "off_util tet" &&
    catalog[0]?.items[0]?.sourceFile === null,
  "catalog groups",
);
const sourced = parsePolyhedronCatalog(
  JSON.stringify({
    Triamonds: [
      {
        name: "Misc",
        sourceFile: { fileName: "Misc.off", text: "OFF\n0 0 0\n" },
      },
    ],
  }),
);
assert(
  sourced[0]?.items[0]?.command === "" && sourced[0]?.items[0]?.sourceFile?.fileName === "Misc.off",
  "catalog source file is the model input",
);
const nested = parsePolyhedronCatalog(
  JSON.stringify({
    "Convex regular-faced solids": {
      "Johnson solids": [{ name: "Cupola", sourceFile: { fileName: "Cupola.off", text: "OFF\n0 0 0\n" } }],
    },
  }),
);
assert(
  nested[0]?.items.length === 0 &&
    nested[0]?.groups[0]?.name === "Johnson solids" &&
    nested[0]?.groups[0]?.items[0]?.name === "Cupola",
  "catalog folders can contain folders",
);
const mixed = parsePolyhedronCatalog(
  JSON.stringify({
    "by Tom Shapiro": {
      items: [{ name: "17-hedron", sourceFile: { fileName: "17-hedron.off", text: "OFF\n0 0 0\n" } }],
      FMJ: [{ name: "FMJ1", sourceFile: { fileName: "FMJ1.off", text: "OFF\n0 0 0\n" } }],
    },
  }),
);
assert(
  mixed[0]?.items[0]?.name === "17-hedron" && mixed[0]?.groups[0]?.name === "FMJ",
  "a catalog folder can hold polyhedra beside its subfolders",
);
let catalogFile = false;
try {
  parsePolyhedronCatalog(JSON.stringify({ format: "antiprism-library", name: "MyLibrary" }));
} catch {
  catalogFile = true;
}
assert(catalogFile, "catalog import rejects a library file");
const grouped = insertGroups(createLibraryDocument("Catalog", ["MyLibrary"]), [], [
  { name: "Platonic", entries: [{ ...draft, name: "Tetrahedron" }] },
  { name: "Catalan", entries: [{ ...draft, name: "Rhombic Dodecahedron" }] },
]);
const platonic = grouped.doc.root.children.find((child) => child.name === "Platonic");
assert(
  platonic?.type === "folder" &&
    platonic.children.length === 1 &&
    platonic.children[0]?.name === "Tetrahedron",
  "catalog group becomes a folder",
);
assert(grouped.entry?.name === "Rhombic Dodecahedron", "catalog import keeps the last polyhedron");
const nestedImport = insertGroups(createLibraryDocument("Nested", ["MyLibrary"]), [], [
  {
    name: "Convex regular-faced solids",
    entries: [],
    groups: [{ name: "Johnson solids", entries: [{ ...draft, name: "Cupola" }] }],
  },
]);
const convex = nestedImport.doc.root.children.find((child) => child.name === "Convex regular-faced solids");
const johnson = convex?.type === "folder" ? convex.children[0] : null;
assert(
  johnson?.type === "folder" && johnson.children[0]?.name === "Cupola" && nestedImport.entry?.name === "Cupola",
  "a catalog folder keeps its subfolders",
);
const fraction = insertGroups(createLibraryDocument("Fractions", ["MyLibrary"]), [], [
  { name: "Prisms", entries: [{ ...draft, name: "{7/2}-Prism" }] },
]);
assert(fraction.entry?.name === "{7/2}-Prism", "a polyhedron name may contain /");

const packed = libraryOffZip(doc);
writeFileSync("/tmp/antiprism-library-off.zip", packed);

const shared = librariesDatabaseZip([createLibraryDocument("Named Models Library", ["MyLibrary"])]);
const restored = await libraryDocumentsFromZip(shared, ["MyLibrary"]);
assert(
  restored.length === 1 && restored[0]?.name === "Named Models Library",
  "a zipped library json imports",
);

console.log("library self-check ok");
