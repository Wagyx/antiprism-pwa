import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PIPELINE_CATEGORIES,
  type PipelineKind,
} from "../pipeline/types";
import { CategoryIcon } from "./CategoryIcon";

const PANEL_WIDTH = 480;
const GAP = 8;

type Props = {
  variant: "between" | "end";
  onPick: (kind: PipelineKind) => void;
};

export function AddOpButton({ variant, onPick }: Props) {
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
      let left = r.left;
      if (left > maxLeft) left = Math.max(GAP, maxLeft);
      if (left < GAP) left = GAP;

      const panelH = panelRef.current?.offsetHeight ?? 360;
      let top = r.bottom + GAP;
      if (top + panelH > window.innerHeight - GAP) {
        top = Math.max(GAP, r.top - panelH - GAP);
      }
      if (top < GAP) top = GAP;
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
            className="add-op-catalog-panel"
            id={panelId}
            role="menu"
            aria-label="Add operation"
            ref={panelRef}
            style={{ top: pos.top, left: pos.left }}
          >
            {PIPELINE_CATEGORIES.map((cat) => (
              <section key={cat.id} className="add-op-category">
                <h3 className="add-op-category-label">
                  <CategoryIcon category={cat.id} />
                  <span>{cat.label}</span>
                </h3>
                <div className="add-op-category-grid">
                  {cat.tools.map(({ kind, blurb }) => (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        onPick(kind);
                      }}
                    >
                      <span className="add-op-tool-name">{kind}</span>
                      <span className="add-op-tool-blurb">{blurb}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`stack-insert stack-insert-${variant}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="stack-insert-btn"
        ref={btnRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Add operation"
        title="Add operation"
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>
      {panel}
    </div>
  );
}
