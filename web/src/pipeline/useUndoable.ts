import { useCallback, useState } from "react";

const MAX_HISTORY = 50;

/**
 * Present-state history with undo/redo. `set` pushes a new present;
 * `replace` updates present without a history entry (e.g. while typing).
 */
export function useUndoable<T>(initial: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setPresent((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(value, prev) || JSON.stringify(value) === JSON.stringify(prev)) {
        return prev;
      }
      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), prev]);
      setFuture([]);
      return value;
    });
  }, []);

  const replace = useCallback((next: T | ((prev: T) => T)) => {
    setPresent((prev) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(value, prev) || JSON.stringify(value) === JSON.stringify(prev)) {
        return prev;
      }
      return value;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setPresent((cur) => {
        setFuture((f) => [cur, ...f]);
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPresent((cur) => {
        setPast((p) => [...p, cur]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  return {
    present,
    set,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
