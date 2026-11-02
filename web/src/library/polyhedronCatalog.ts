export type CatalogItem = {
  name: string;
  command: string;
};

export type CatalogGroup = {
  name: string;
  items: CatalogItem[];
};

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
      if (!isRecord(item) || typeof item.name !== "string" || typeof item.command !== "string") {
        throw new Error(`${where} needs a name and a command`);
      }
      const name = item.name.trim();
      const command = item.command.trim();
      if (!name) throw new Error(`${where} has an empty name`);
      if (!command) throw new Error(`"${name}" has an empty command`);
      items.push({ name, command });
    }
    if (items.length === 0) continue;
    groups.push({ name: groupName.trim(), items });
  }
  if (groups.length === 0) throw new Error("The file has no polyhedra");
  return groups;
}
