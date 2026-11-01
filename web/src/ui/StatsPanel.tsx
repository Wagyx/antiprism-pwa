import { useEffect, useState } from "react";
import { runAntiprism } from "../wasm/client";

type Props = {
  offText: string | null;
};

/** Default report: general section, modest precision. */
const REPORT_ARGS = ["-S", "G", "-d", "8"];

export function StatsPanel({ offText }: Props) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className={`stats-panel${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="overlay-panel-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="overlay-panel-title">Stats</span>
        <span className="overlay-panel-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <pre className={`stats-panel-body${busy && !report ? " is-busy" : ""}`}>
          {report || (busy ? "…" : "—")}
        </pre>
      ) : null}
    </div>
  );
}
