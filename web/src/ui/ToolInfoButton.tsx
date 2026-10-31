import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOOL_DOCS, type ToolDoc } from "../pipeline/toolDocs";
import type { PipelineKind } from "../pipeline/types";

const PANEL_WIDTH = 360;
const GAP = 8;

type Props = {
  kind: PipelineKind;
  /** Optional override; defaults to TOOL_DOCS[kind]. */
  doc?: ToolDoc;
};

export function ToolInfoButton({ kind, doc }: Props) {
  const info = doc ?? TOOL_DOCS[kind];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }

    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * GAP);
      const maxLeft = window.innerWidth - width - GAP;
      let left = r.right + GAP;
      if (left > maxLeft) {
        left = Math.max(GAP, r.left - width - GAP);
      }
      const panelH = panelRef.current?.offsetHeight ?? 320;
      let top = r.top;
      if (top + panelH > window.innerHeight - GAP) {
        top = Math.max(GAP, window.innerHeight - panelH - GAP);
      }
      setPos({ top, left });
    };

    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel =
    open && pos
      ? createPortal(
          <div
            className="tool-info-panel"
            id={panelId}
            role="dialog"
            aria-label={info.title}
            ref={panelRef}
            style={{ top: pos.top, left: pos.left }}
          >
            <header className="tool-info-header">
              <strong>{info.title}</strong>
              <button
                type="button"
                className="tool-info-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="tool-info-intro">{info.blurb}</p>
            {info.sections.map((section) => (
              <section key={section.heading}>
                <h3>{section.heading}</h3>
                {section.body ? <p className="tool-info-body">{section.body}</p> : null}
                {section.entries ? (
                  <ul className="tool-info-list">
                    {section.entries.map((entry) => (
                      <li key={`${section.heading}-${entry.symbol}-${entry.name ?? ""}`}>
                        <code>{entry.symbol}</code>
                        {entry.name ? (
                          <span className="tool-info-name">{entry.name}</span>
                        ) : (
                          <span className="tool-info-name" />
                        )}
                        <span className="tool-info-summary">{entry.summary}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="tool-info-btn"
        ref={btnRef}
        aria-expanded={open}
        aria-controls={panelId}
        title={`${info.title} help`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {panel}
    </>
  );
}
