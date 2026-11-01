import { parseOff } from "../viewer/parseOff";
import type { PolyCounts } from "./types";

export function countsFromOff(offText: string): PolyCounts {
  const parsed = parseOff(offText);
  return {
    nVertices: parsed.vertices.length,
    nEdges: parsed.edges.length,
    nFaces: parsed.faces.length,
  };
}
