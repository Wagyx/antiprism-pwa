import { looksLikeOff } from "../io/loadOff";

/** OFF (or OBJ) text carried with a catalog entry and used as the pipeline input. */
export type CatalogSourceFile = {
  fileName: string;
  text: string;
};

export type CatalogItem = {
  name: string;
  /** Empty when the polyhedron is the source file itself. */
  command: string;
  sourceFile: CatalogSourceFile | null;
};

export type CatalogGroup = {
  name: string;
  items: CatalogItem[];
};

function readSourceFile(
  value: unknown,
  name: string,
  where: string,
): CatalogSourceFile | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const text = value.trim() ? value : "";
    if (!text.trim()) throw new Error(`"${name}" has an empty source file`);
    if (!looksLikeOff(text)) throw new Error(`"${name}" source file is not OFF`);
    return { fileName: `${name}.off`, text };
  }
  if (!isRecord(value) || typeof value.text !== "string" || !value.text.trim()) {
    throw new Error(`${where} source file needs text`);
  }
  const fileName =
    typeof value.fileName === "string" && value.fileName.trim()
      ? value.fileName.trim()
      : `${name}.off`;
  const obj = fileName.toLowerCase().endsWith(".obj");
  if (!obj && !looksLikeOff(value.text)) {
    throw new Error(`"${name}" source file is not OFF`);
  }
  return { fileName, text: value.text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Groups of named Antiprism commands, as in common-polyhedra.json. */
export function parsePolyhedronCatalog(text: string): CatalogGroup[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON");
  }
  if (!isRecord(data)) throw new Error("Expected a JSON object of groups");
  if (data.format === "antiprism-library") {
    throw new Error("This is a library file. Use Import on the libraries page.");
  }

  const groups: CatalogGroup[] = [];
  for (const [groupName, value] of Object.entries(data)) {
    if (!Array.isArray(value)) throw new Error(`"${groupName}" is not a list of polyhedra`);
    const items: CatalogItem[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      const where = `"${groupName}" item ${index + 1}`;
      if (!isRecord(item) || typeof item.name !== "string") {
        throw new Error(`${where} needs a name`);
      }
      const name = item.name.trim();
      if (!name) throw new Error(`${where} has an empty name`);
      const command = typeof item.command === "string" ? item.command.trim() : "";
      const sourceFile = readSourceFile(item.sourceFile, name, where);
      if (!command && !sourceFile) {
        throw new Error(`"${name}" needs a command or a source file`);
      }
      items.push({ name, command, sourceFile });
    }
    if (items.length === 0) continue;
    groups.push({ name: groupName.trim(), items });
  }
  if (groups.length === 0) throw new Error("The file has no polyhedra");
  return groups;
}
