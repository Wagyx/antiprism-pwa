import { useEffect, useEffectEvent, useRef, useState } from "react";
import { runPipeline } from "./pipeline/runPipeline";
import {
  defaultDisplay,
  defaultStack,
  type DisplayOptions,
  type PipelineOp,
} from "./pipeline/types";
import { useUndoable } from "./pipeline/useUndoable";
import { StackPanel } from "./ui/StackPanel";
import { PolyhedronViewer } from "./viewer/PolyhedronViewer";
import "./App.css";

const DEBOUNCE_MS = 200;

function opsKey(ops: PipelineOp[]): string {
  return JSON.stringify(ops);
}

export default function App() {
  const {
    present,
    set: commitStack,
    replace: patchStack,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoable<PipelineOp[]>(defaultStack);

  const [display, setDisplay] = useState<DisplayOptions>(defaultDisplay);
  const [offText, setOffText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);

  const latestRun = useRef(0);
  const lastRunKey = useRef<string>("");
  const offTextRef = useRef<string | null>(null);
  const busyTimer = useRef<number | null>(null);

  const clearBusyTimer = () => {
    if (busyTimer.current != null) {
      window.clearTimeout(busyTimer.current);
      busyTimer.current = null;
    }
  };

  const evaluate = useEffectEvent(async (ops: PipelineOp[], runId: number) => {
    clearBusyTimer();
    // Show "Running…" only for slow runs; keep the node mounted via CSS when possible.
    busyTimer.current = window.setTimeout(() => {
      if (runId === latestRun.current) setBusy(true);
    }, 250);

    try {
      const result = await runPipeline(ops);
      if (runId !== latestRun.current) return;

      if (!result.ok) {
        setError(result.error);
        setFailedStep(result.failedStep);
        if (result.offText && result.offText !== offTextRef.current) {
          offTextRef.current = result.offText;
          setOffText(result.offText);
        } else if (!result.offText) {
          offTextRef.current = null;
          setOffText(null);
        }
        return;
      }

      setError(null);
      setFailedStep(null);
      if (result.offText !== offTextRef.current) {
        offTextRef.current = result.offText;
        setOffText(result.offText);
      }
    } catch (e) {
      if (runId !== latestRun.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setFailedStep(null);
      offTextRef.current = null;
      setOffText(null);
    } finally {
      if (runId === latestRun.current) {
        clearBusyTimer();
        setBusy(false);
      }
    }
  });

  useEffect(() => {
    const key = opsKey(present);
    const t = window.setTimeout(() => {
      // Same stack content as last started run — do not re-run or flash busy.
      if (key === lastRunKey.current) return;
      lastRunKey.current = key;
      const runId = ++latestRun.current;
      void evaluate(present, runId);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [present]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="app">
      <StackPanel
        ops={present}
        onCommit={commitStack}
        onPatch={patchStack}
        display={display}
        onDisplayChange={setDisplay}
        busy={busy}
        error={error}
        failedStep={failedStep}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />
      <main className="stage">
        <PolyhedronViewer
          offText={offText}
          verticesActive={display.verticesActive}
          edgesActive={display.edgesActive}
          facesActive={display.facesActive}
        />
      </main>
    </div>
  );
}
