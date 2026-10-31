import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CONWAY_OPERATORS, CONWAY_SEEDS } from "../pipeline/conwayInfo";

const PANEL_WIDTH = 352;
const GAP = 8;

export function ConwayInfoButton() {
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
      const width = PANEL_WIDTH;
      const maxLeft = window.innerWidth - width - GAP;
      let left = r.right + GAP;
      if (left > maxLeft) {
        // Prefer right of button; if clipped, flip to left of button.
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
    // Re-measure after paint so height is accurate.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

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
            className="conway-info-panel"
            id={panelId}
            role="dialog"
            aria-label="Conway notation"
            ref={panelRef}
            style={{ top: pos.top, left: pos.left }}
          >
            <header className="conway-info-header">
              <strong>Conway notation</strong>
              <button
                type="button"
                className="conway-info-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="conway-info-intro">
              Operators (lowercase / symbols) precede an optional capital seed. When this
              step follows another operation, omit the seed — OFF is piped in.
            </p>

            <h3>Seeds</h3>
            <ul className="conway-info-list">
              {CONWAY_SEEDS.map((s) => (
                <li key={s.symbol}>
                  <code>{s.symbol}</code>
                  <span className="conway-info-name">{s.name}</span>
                  <span className="conway-info-summary">{s.summary}</span>
                </li>
              ))}
            </ul>

            <h3>Operators</h3>
            <ul className="conway-info-list">
              {CONWAY_OPERATORS.map((op) => (
                <li key={op.symbol}>
                  <code>{op.symbol}</code>
                  <span className="conway-info-name">{op.name}</span>
                  <span className="conway-info-summary">{op.summary}</span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="conway-info-btn"
        ref={btnRef}
        aria-expanded={open}
        aria-controls={panelId}
        title="Conway notation reference"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {panel}
    </>
  );
}
