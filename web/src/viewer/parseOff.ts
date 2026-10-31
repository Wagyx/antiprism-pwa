/** Antiprism-aware OFF parser (vertices, edges, faces + RGBA colors). */

export type Rgba = [number, number, number, number];

export type ParsedOff = {
  vertices: number[][];
  faces: number[][];
  edges: number[][];
  verticesColor: (Rgba | undefined)[];
  facesColor: (Rgba | undefined)[];
  edgesColor: (Rgba | undefined)[];
};

const SEP = /\s+/;

function parseColor(parts: string[]): number[] {
  let isFloat = false;
  for (const el of parts) {
    if (el.includes(".")) isFloat = true;
  }
  return parts.map((el) => (isFloat ? parseFloat(el) : parseInt(el, 10) / 255.0));
}

export function parseOff(text: string): ParsedOff {
  let src = text;
  if (src.includes("\r\n")) src = src.replace(/\r\n/g, "\n");
  if (src.includes("\\\n")) src = src.replace(/\\\n/g, "");

  const lines = src.split("\n");
  const result: ParsedOff = {
    vertices: [],
    faces: [],
    edges: [],
    verticesColor: [],
    facesColor: [],
    edgesColor: [],
  };

  const header = lines[0]?.trim() ?? "";
  if (!header.startsWith("OFF")) {
    throw new Error("Not an OFF file");
  }

  let i = 1;
  let counts: number[] | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    counts = line.split(SEP).map((el) => parseInt(el, 10));
    i++;
    break;
  }
  if (!counts) throw new Error("Missing OFF counts");

  const numberVertices = counts[0];
  const numberFaces = counts[1];

  for (; i < lines.length && result.vertices.length < numberVertices; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const data = line.split(SEP);
    result.vertices.push(data.slice(0, 3).map((el) => parseFloat(el)));
    if (data.length > 3) {
      const col = parseColor(data.slice(3));
      result.verticesColor.push(
        (col.length >= 4 ? col.slice(0, 4) : [...col.slice(0, 3), 1]) as Rgba,
      );
    } else {
      result.verticesColor.push(undefined);
    }
  }

  let facesRead = 0;
  for (; i < lines.length && facesRead < numberFaces; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const lineData = line.split(SEP);
    const faceNum = parseInt(lineData[0], 10);
    facesRead++;

    if (faceNum > 2) {
      result.faces.push(lineData.slice(1, faceNum + 1).map((el) => parseInt(el, 10)));
      result.facesColor.push(
        lineData.length > faceNum + 1
          ? (parseColor(lineData.slice(faceNum + 1)).concat([1]).slice(0, 4) as Rgba)
          : undefined,
      );
    } else if (faceNum === 2) {
      const i0 = parseInt(lineData[1], 10);
      const i1 = parseInt(lineData[2], 10);
      const a = Math.min(i0, i1);
      const b = Math.max(i0, i1);
      result.edges.push([a, b]);
      result.edgesColor.push(
        lineData.length > faceNum + 1
          ? (parseColor(lineData.slice(faceNum + 1)).concat([1]).slice(0, 4) as Rgba)
          : undefined,
      );
    } else if (faceNum === 1) {
      if (lineData.length > faceNum + 1) {
        const idx = parseInt(lineData[1], 10);
        result.verticesColor[idx] = parseColor(lineData.slice(faceNum + 1))
          .concat([1])
          .slice(0, 4) as Rgba;
      }
    }
  }

  const edgeSet = new Set(result.edges.map(([a, b]) => `${a},${b}`));
  for (const face of result.faces) {
    for (let j = 0; j < face.length; j++) {
      const i0 = face[j];
      const i1 = face[(j + 1) % face.length];
      const a = Math.min(i0, i1);
      const b = Math.max(i0, i1);
      const key = `${a},${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        result.edges.push([a, b]);
        result.edgesColor.push(undefined);
      }
    }
  }

  return result;
}

const DEFAULTS = {
  vertex: [1.0, 0.5, 0.0, 1.0] as Rgba,
  edge: [0.8, 0.6, 0.8, 1.0] as Rgba,
  face: [0.8, 0.9, 0.9, 1.0] as Rgba,
};

function ensureRgba(c: Rgba | undefined, fallback: Rgba): Rgba {
  if (!c) return [...fallback] as Rgba;
  if (c.length < 4) return [c[0], c[1], c[2], 1];
  return c;
}

export function fillMissingColors(obj: ParsedOff): void {
  for (let i = 0; i < obj.verticesColor.length; i++) {
    obj.verticesColor[i] = ensureRgba(obj.verticesColor[i], DEFAULTS.vertex);
  }
  for (let i = 0; i < obj.edgesColor.length; i++) {
    obj.edgesColor[i] = ensureRgba(obj.edgesColor[i], DEFAULTS.edge);
  }
  for (let i = 0; i < obj.facesColor.length; i++) {
    obj.facesColor[i] = ensureRgba(obj.facesColor[i], DEFAULTS.face);
  }
}
