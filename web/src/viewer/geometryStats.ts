import { parseOff } from "./parseOff";

export type FaceType = {
  vertices: number;
  count: number;
};

export type LengthBin = {
  /** Representative length, used as the bar label. */
  length: number;
  count: number;
};

export type GeometryStats = {
  faces: FaceType[];
  edgeBins: LengthBin[];
  /** Shortest and longest edge, when the model has edges. */
  edgeMin: number | null;
  edgeMax: number | null;
};

const MAX_BINS = 10;
const LENGTH_EPSILON = 1e-3;

function sameLength(a: number, b: number): boolean {
  return Math.abs(a - b) <= LENGTH_EPSILON;
}

function edgeLengths(vertices: number[][], edges: number[][]): number[] {
  const lengths: number[] = [];
  for (const [i, j] of edges) {
    const a = vertices[i];
    const b = vertices[j];
    if (!a || !b) continue;
    lengths.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  return lengths;
}

function clustered(sorted: number[]): LengthBin[] | null {
  const clusters: { sum: number; count: number }[] = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && sameLength(value, last.sum / last.count)) {
      last.sum += value;
      last.count += 1;
    } else {
      clusters.push({ sum: value, count: 1 });
    }
  }
  if (clusters.length > MAX_BINS) return null;
  return clusters.map((cluster) => ({
    length: cluster.sum / cluster.count,
    count: cluster.count,
  }));
}

function equalWidth(sorted: number[]): LengthBin[] {
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? min;
  const span = max - min;
  const bins = Math.min(MAX_BINS, sorted.length);
  if (bins <= 1 || span === 0) return [{ length: min, count: sorted.length }];
  const width = span / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const value of sorted) {
    let index = Math.floor((value - min) / width);
    if (index >= bins) index = bins - 1;
    counts[index] += 1;
  }
  return counts.map((count, index) => ({
    length: min + (index + 0.5) * width,
    count,
  }));
}

export function histogram(values: number[]): LengthBin[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  return clustered(sorted) ?? equalWidth(sorted);
}

export function geometryOf(offText: string): GeometryStats | null {
  const parsed = parseOff(offText);
  const faceCounts = new Map<number, number>();
  for (const face of parsed.faces) {
    const vertices = face.length;
    if (vertices < 3) continue;
    faceCounts.set(vertices, (faceCounts.get(vertices) ?? 0) + 1);
  }
  const faces = [...faceCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([vertices, count]) => ({ vertices, count }));
  const lengths = edgeLengths(parsed.vertices, parsed.edges);
  const edgeBins = histogram(lengths);
  let edgeMin: number | null = null;
  let edgeMax: number | null = null;
  for (const length of lengths) {
    if (edgeMin === null || length < edgeMin) edgeMin = length;
    if (edgeMax === null || length > edgeMax) edgeMax = length;
  }
  if (faces.length === 0 && edgeBins.length === 0) return null;
  return { faces, edgeBins, edgeMin, edgeMax };
}

export function formatLength(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e4)) return value.toExponential(2);
  return String(Number(value.toPrecision(digits)));
}
