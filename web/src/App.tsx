import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { runPipeline } from "./pipeline/runPipeline";
import {
  defaultDisplay,
  defaultStack,
  type DisplayOptions,
  type PipelineOp,
} from "./pipeline/types";
import { useUndoable } from "./pipeline/useUndoable";
import { saveOffFile } from "./io/saveOff";
import { DisplayPanel } from "./ui/DisplayPanel";
import { StackPanel } from "./ui/StackPanel";
import { PolyhedronViewer } from "./viewer/PolyhedronViewer";
import "./App.css";

const DEBOUNCE_MS = 200;
const PANEL_MIN = 200;
const PANEL_MAX = 520;
const PANEL_DEFAULT = 280;

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
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [offText, setOffText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);

  const latestRun = useRef(0);
  const lastRunKey = useRef<string>("");
  const offTextRef = useRef<string | null>(null);
  const busyTimer = useRef<number | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const clearBusyTimer = () => {
    if (busyTimer.current != null) {
      window.clearTimeout(busyTimer.current);
      busyTimer.current = null;
    }
  };

  const evaluate = useEffectEvent(async (ops: PipelineOp[], runId: number) => {
    clearBusyTimer();
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

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: panelWidth };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [panelWidth],
  );

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const next = Math.min(
      PANEL_MAX,
      Math.max(PANEL_MIN, dragRef.current.startW + dx),
    );
    setPanelWidth(next);
  }, []);

  const onResizePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const saveLock = useRef(false);
  const onSaveOff = useCallback(() => {
    if (saveLock.current) return;
    const text = offText ?? offTextRef.current;
    if (!text?.trim()) return;
    saveLock.current = true;
    void saveOffFile(text).finally(() => {
      saveLock.current = false;
    });
  }, [offText]);

  return (
    <div className="app" style={{ ["--panel-width" as string]: `${panelWidth}px` }}>
      <StackPanel
        ops={present}
        onCommit={commitStack}
        onPatch={patchStack}
        busy={busy}
        error={error}
        failedStep={failedStep}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        canSave={Boolean(offText?.trim())}
        onSaveOff={onSaveOff}
      />
      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={panelWidth}
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
      <main className="stage">
        <DisplayPanel
          display={display}
          onChange={setDisplay}
          onResetCamera={() => setCameraResetKey((k) => k + 1)}
        />
        <PolyhedronViewer
          offText={offText}
          verticesActive={display.verticesActive}
          edgesActive={display.edgesActive}
          facesActive={display.facesActive}
          cameraResetKey={cameraResetKey}
        />
      </main>
    </div>
  );
}
