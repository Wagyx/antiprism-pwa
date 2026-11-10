import { useEffect, useMemo, useState } from "react";
import { formatLength, geometryOf, type LengthBin } from "../viewer/geometryStats";
import { runAntiprism } from "../wasm/client";

type Props = {
  offText: string | null;
};

type StatComponent = {
  label: string;
  value: string;
};

type StatRow = {
  key: string;
  label: string;
  value: string;
  components?: StatComponent[];
};

type StatGroup = {
  heading: string | null;
  rows: StatRow[];
};

/** Default report: general section, modest precision. */
const REPORT_ARGS = ["-S", "G", "-d", "8"];

const STAT_LABELS: Record<string, string> = {
  num_verts: "Vertices",
  num_faces: "Faces",
  num_edges: "Edges",
  num_parts: "Parts",
  vertex_centroid: "Vertex centroid",
  volume_centroid: "Volume centroid",
  oriented: "Oriented",
  orientable: "Orientable",
  connectivity: "Connectivity",
  convex: "Convex",
  genus: "Genus",
  area: "Area",
  volume: "Volume",
};

function statLabel(key: string): string {
  const known = STAT_LABELS[key];
  if (known) return known;
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CENTROID_KEYS = new Set(["vertex_centroid", "volume_centroid"]);
const AXIS_LABELS = ["x", "y", "z"];

function vectorComponents(value: string): string[] | null {
  const parts = value
    .replace(/^\(|\)$/g, "")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(Number(part)))) return null;
  return parts;
}

function parseReport(text: string): StatGroup[] {
  const groups: StatGroup[] = [];
  let current: StatGroup = { heading: null, rows: [] };
  const push = () => {
    if (current.heading || current.rows.length > 0) groups.push(current);
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const section = /^\[(.+)\]$/.exec(line);
    if (section) {
      push();
      current = { heading: section[1] ?? null, rows: [] };
      continue;
    }
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      const components = CENTROID_KEYS.has(key) ? vectorComponents(value) : null;
      current.rows.push({
        key,
        label: statLabel(key),
        value,
        components: components?.map((part, index) => ({
          label: AXIS_LABELS[index] ?? "",
          value: part,
        })),
      });
    } else {
      current.rows.push({ key: line, label: line, value: "" });
    }
  }
  push();
  return groups;
}

/** Counts and measures, then everything else, with centroids last. */
const ROW_ORDER = ["num_verts", "num_edges", "num_faces", "num_parts", "genus", "area", "volume"] as const;

function rowsByKey(rows: StatRow[], keys: readonly string[]): StatRow[] {
  return keys.flatMap((key) => rows.filter((row) => row.key === key));
}

function StatRows({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="stats-list">
      {rows.map((row, index) => (
        <div key={`${row.key}:${index}`} className="stats-row-block">
          <div className="stats-row">
            <dt>{row.label}</dt>
            {row.components ? null : <dd>{row.value}</dd>}
          </div>
          {row.components?.map((component) => (
            <div key={component.label} className="stats-row stats-row-sub">
              <dt>{component.label}</dt>
              <dd>{component.value}</dd>
            </div>
          ))}
        </div>
      ))}
    </dl>
  );
}

function FaceTypes({ faces }: { faces: { vertices: number; count: number }[] }) {
  const max = Math.max(...faces.map((face) => face.count), 1);
  return (
    <div className="stats-block">
      <ul className="face-types">
        {faces.map((face) => (
          <li key={face.vertices} className="face-type">
            <span className="face-type-n">{face.vertices}</span>
            <span className="face-type-track" title={`${face.vertices} vertices × ${face.count}`}>
              <span className="face-type-bar" style={{ width: `${(face.count / max) * 100}%` }} />
            </span>
            <span className="face-type-count">{face.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function edgeRatio(length: number, min: number): number | null {
  if (!(min > 0) || !Number.isFinite(length)) return null;
  return length / min;
}

function EdgeHistogram({ bins, min, max }: { bins: LengthBin[]; min: number; max: number }) {
  const peak = Math.max(...bins.map((bin) => bin.count), 1);
  const ratio = edgeRatio(max, min);
  const ratioLabel = ratio === null ? "—" : formatLength(ratio, 6);
  return (
    <div className="stats-block">
      <div className="hist" role="img" aria-label={`Edge ratio histogram, ${ratioLabel}`}>
        {bins.map((bin, index) => {
          const value = edgeRatio(bin.length, min);
          const label = value === null ? "—" : formatLength(value);
          return (
            <div key={index} className="hist-col" title={`${label} × ${bin.count}`}>
              <span className="hist-count">{bin.count}</span>
              <span className="hist-track">
                <span className="hist-bar" style={{ height: `${(bin.count / peak) * 100}%` }} />
              </span>
              <span className="hist-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatsPanel({ offText }: Props) {
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const geometry = useMemo(() => {
    const text = offText?.trim();
    if (!text) return null;
    try {
      return geometryOf(text);
    } catch {
      return null;
    }
  }, [offText]);

  useEffect(() => {
    let cancelled = false;
    const text = offText?.trim() ?? "";
    if (!text) {
      setReport(null);
      setBusy(false);
      return;
    }

    setBusy(true);
    void (async () => {
      try {
        const result = await runAntiprism("off_report", REPORT_ARGS, text);
        if (cancelled) return;
        setReport(result.ok ? result.stdout.trim() : null);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [offText]);

  const rows = report ? parseReport(report).flatMap((group) => group.rows) : [];
  const placed = new Set<string>([...ROW_ORDER, ...CENTROID_KEYS]);
  const hasReport = rows.length > 0;
  const faces = geometry?.faces ?? [];
  const edgeBins = geometry?.edgeBins ?? [];
  const edgeMin = geometry?.edgeMin ?? null;
  const edgeMax = geometry?.edgeMax ?? null;
  const hasGeometry = faces.length > 0 || edgeBins.length > 0;

  return (
    <div className="view-section-body">
      {!hasReport && !hasGeometry ? (
        <p className="view-empty">{busy ? "…" : "—"}</p>
      ) : (
        <div className="stats-stack">
          <StatRows rows={rowsByKey(rows, ["num_verts", "num_edges"])} />
          {edgeBins.length > 0 && edgeMin !== null && edgeMax !== null ? (
            <EdgeHistogram bins={edgeBins} min={edgeMin} max={edgeMax} />
          ) : null}
          <StatRows rows={rowsByKey(rows, ["num_faces"])} />
          {faces.length > 0 ? <FaceTypes faces={faces} /> : null}
          <StatRows rows={rowsByKey(rows, ["num_parts", "genus", "area", "volume"])} />
          <StatRows rows={rows.filter((row) => !placed.has(row.key))} />
          <StatRows rows={rowsByKey(rows, ["vertex_centroid", "volume_centroid"])} />
        </div>
      )}
    </div>
  );
}
