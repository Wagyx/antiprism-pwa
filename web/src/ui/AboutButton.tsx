import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PANEL_WIDTH = 320;
const GAP = 8;

export function AboutButton() {
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
      if (left > maxLeft) left = Math.max(GAP, r.left - width - GAP);
      const panelH = panelRef.current?.offsetHeight ?? 240;
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
            className="tool-info-panel about-panel"
            id={panelId}
            role="dialog"
            aria-label="About"
            ref={panelRef}
            style={{ top: pos.top, left: pos.left }}
          >
            <header className="tool-info-header">
              <strong>About</strong>
              <button
                type="button"
                className="tool-info-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <p>
              This application is based on a WASM port of{" "}
              <a href="https://antiprism.com/" target="_blank" rel="noopener noreferrer">
                Antiprism
              </a>.
            </p>
            <p>Apply the commands and view the result in real time.</p>
            <p>Handle your database of polyhedra.</p>
            <p>Made with the help of Cursor.</p>
            <p>Three.js handles the 3D view.</p>
            <p className="about-credit">Created by Wagyx Xygaw, October 2026.</p>
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
        title="About"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        i
      </button>
      {panel}
    </>
  );
}
