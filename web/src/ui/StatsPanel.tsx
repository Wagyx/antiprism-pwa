import { useEffect, useState } from "react";
import { runAntiprism } from "../wasm/client";

type Props = {
  offText: string | null;
};

type StatRow = {
  label: string;
  value: string;
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

function sectionLabel(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      current.rows.push({
        label: statLabel(line.slice(0, eq).trim()),
        value: line.slice(eq + 1).trim(),
      });
    } else {
      current.rows.push({ label: line, value: "" });
    }
  }
  push();
  return groups;
}

export function StatsPanel({ offText }: Props) {
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const groups = report ? parseReport(report) : [];
  const showHeadings = groups.length > 1;

  return (
    <div className={`view-section-body${busy && !report ? " is-busy" : ""}`}>
      {groups.length === 0 ? (
        <p className="view-empty">{busy ? "…" : "—"}</p>
      ) : (
        groups.map((group) => (
          <div key={group.heading ?? "stats"} className="stats-group">
            {showHeadings && group.heading ? (
              <h3 className="stats-heading">{sectionLabel(group.heading)}</h3>
            ) : null}
            <dl className="stats-list">
              {group.rows.map((row, index) => (
                <div key={`${group.heading ?? ""}:${index}`} className="stats-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))
      )}
    </div>
  );
}
