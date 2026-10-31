import { useEffect } from "react";

/** Close any open `.add-op` details on outside click or Escape. */
export function useDismissDetails() {
  useEffect(() => {
    const closeOpen = (except?: Element | null) => {
      document.querySelectorAll("details.add-op[open]").forEach((el) => {
        if (el !== except) el.removeAttribute("open");
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      const host = target instanceof Element ? target.closest("details.add-op") : null;
      // Close every open menu that isn't the one being interacted with
      closeOpen(host);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOpen();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
