import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { runPipeline } from "./pipeline/runPipeline";
import {
  defaultDisplay,
  defaultStack,
  saveAsOption,
  type DisplayOptions,
  type PipelineOp,
  type SaveAsFormatId,
} from "./pipeline/types";
import { useUndoable } from "./pipeline/useUndoable";
import { countsFromOff } from "./library/counts";
import { clonePipeline, inputFromPipeline, pipelineForEditor } from "./library/snapshot";
import { findEntry, locationLabel, resolveDestination } from "./library/tree";
import type { EntryRef } from "./library/types";
import { useLibrary } from "./library/useLibrary";
import { saveOffFile } from "./io/saveOff";
import { saveTextFile } from "./io/saveTextFile";
import { DisplayPanel } from "./ui/DisplayPanel";
import { LibraryPanel } from "./ui/LibraryPanel";
import type { Mode } from "./ui/ModeSwitch";
import { SaveToLibraryDialog } from "./ui/SaveToLibraryDialog";
import { StackPanel } from "./ui/StackPanel";
import { StatsPanel } from "./ui/StatsPanel";
import { PolyhedronViewer } from "./viewer/PolyhedronViewer";
import { runAntiprism } from "./wasm/client";
import "./App.css";

const DEBOUNCE_MS = 200;
const PANEL_MIN = 200;
const PANEL_MAX = 680;
const PANEL_DEFAULT = 280;

function opsKey(ops: PipelineOp[]): string {
  return JSON.stringify(ops);
}

function Stage({
  offText,
  display,
  onDisplay,
  onResetCamera,
  cameraResetKey,
  caption,
}: {
  offText: string | null;
  display: DisplayOptions;
  onDisplay: (display: DisplayOptions) => void;
  onResetCamera: () => void;
  cameraResetKey: number;
  caption?: string | null;
}) {
  return (
    <main className="stage">
      {caption ? <div className="stage-caption">{caption}</div> : null}
      <DisplayPanel
        display={display}
        onChange={onDisplay}
        onResetCamera={onResetCamera}
      />
      <StatsPanel offText={offText} />
      <PolyhedronViewer
        offText={offText}
        verticesActive={display.verticesActive}
        edgesActive={display.edgesActive}
        facesActive={display.facesActive}
        axesActive={display.axesActive}
        cameraResetKey={cameraResetKey}
      />
    </main>
  );
}

export default function App() {
  const {
    present,
    set: commitStack,
    replace: patchStack,
    load: loadStack,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoable<PipelineOp[]>(defaultStack);

  const library = useLibrary();
  const [mode, setMode] = useState<Mode>("editor");
  const [editing, setEditing] = useState<EntryRef | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const [display, setDisplay] = useState<DisplayOptions>(defaultDisplay);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [offText, setOffText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<number | null>(null);
  const [stepText, setStepText] = useState<Record<string, string>>({});
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);

  const latestRun = useRef(0);
  const lastRunKey = useRef<string>("");
  const offTextRef = useRef<string | null>(null);
  const busyTimer = useRef<number | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const widenedRef = useRef(false);

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
        setStepText(result.stepText);
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
      setStepText(result.stepText);
      if (result.offText !== offTextRef.current) {
        offTextRef.current = result.offText;
        setOffText(result.offText);
      }
    } catch (e) {
      if (runId !== latestRun.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setFailedStep(null);
      setStepText({});
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

  const selectedHit = useMemo(() => {
    if (!library.selected) return null;
    const doc = library.libraries.find((item) => item.id === library.selected?.libraryId);
    if (!doc) return null;
    const hit = findEntry(doc, library.selected.entryId);
    return hit ? { doc, ...hit } : null;
  }, [library.libraries, library.selected]);

  const editingHit = useMemo(() => {
    if (!editing) return null;
    const doc = library.libraries.find((item) => item.id === editing.libraryId);
    if (!doc) return null;
    const hit = findEntry(doc, editing.entryId);
    return hit ? { doc, ...hit } : null;
  }, [library.libraries, editing]);

  const onModeChange = (next: Mode) => {
    if (next === "library" && mode !== "library") {
      setCameraResetKey((key) => key + 1);
      if (!widenedRef.current) {
        widenedRef.current = true;
        setPanelWidth((width) => Math.max(width, 420));
      }
    }
    setMode(next);
  };

  const onSelectEntry = (ref: EntryRef | null) => {
    library.setSelected(ref);
    if (ref) setCameraResetKey((key) => key + 1);
  };

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
  const onSaveAs = useCallback((format: SaveAsFormatId) => {
    if (saveLock.current) return;
    const text = offText ?? offTextRef.current;
    if (!text?.trim()) return;
    const opt = saveAsOption(format);
    saveLock.current = true;
    void (async () => {
      try {
        if (!opt.tool) {
          await saveOffFile(text, opt.fileName);
          return;
        }
        const result = await runAntiprism(opt.tool, [...opt.args], text);
        if (!result.ok || !result.stdout.trim()) {
          setError(
            result.stderr.trim() ||
              `${opt.tool} exited with code ${result.code}`,
          );
          setFailedStep(null);
          return;
        }
        await saveTextFile(result.stdout, opt.fileName, opt.mime);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setFailedStep(null);
      } finally {
        saveLock.current = false;
      }
    })();
  }, [offText]);

  const buildDraft = (name: string) => {
    const text = offTextRef.current ?? offText;
    if (!text?.trim()) throw new Error("Nothing to save yet");
    return {
      name,
      offText: text,
      pipeline: clonePipeline(present),
      inputFile: inputFromPipeline(present),
      counts: countsFromOff(text),
    };
  };

  const onEditEntry = (ref: EntryRef) => {
    const doc = library.libraries.find((item) => item.id === ref.libraryId);
    if (!doc) throw new Error("Library not found");
    const hit = findEntry(doc, ref.entryId);
    if (!hit) throw new Error("Entry not found");
    const ops = pipelineForEditor(hit.entry);
    lastRunKey.current = "";
    loadStack(ops);
    offTextRef.current = hit.entry.offText;
    setOffText(hit.entry.offText);
    setError(null);
    setFailedStep(null);
    setEditing(ref);
    library.setSelected(ref);
    setMode("editor");
  };

  const destination = (() => {
    try {
      return resolveDestination(library.libraries, library.nav);
    } catch {
      return null;
    }
  })();

  const createLabel = destination
    ? locationLabel(library.libraries, destination.libraryId, destination.folderIds)
    : "MyLibrary";
  const updateLabel = editingHit
    ? locationLabel(library.libraries, editingHit.doc.id, editingHit.folderIds)
    : null;

  const stage = (
    <Stage
      offText={mode === "library" ? selectedHit?.entry.offText ?? null : offText}
      display={display}
      onDisplay={setDisplay}
      onResetCamera={() => setCameraResetKey((key) => key + 1)}
      cameraResetKey={cameraResetKey}
      caption={
        mode === "library"
          ? selectedHit?.entry.name ?? "Select an entry"
          : null
      }
    />
  );

  const resizer = (
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
  );

  return (
    <div className="app" style={{ ["--panel-width" as string]: `${panelWidth}px` }}>
      {mode === "library" ? (
        <LibraryPanel
          mode={mode}
          onModeChange={onModeChange}
          libraries={library.libraries}
          ready={library.ready}
          loadError={library.loadError}
          nav={library.nav}
          onNavigate={library.setNav}
          query={library.query}
          onQuery={library.setQuery}
          selected={library.selected}
          onSelect={onSelectEntry}
          onEdit={onEditEntry}
          onCreateLibrary={library.createLibrary}
          onRenameLibrary={library.renameLibraryById}
          onImport={library.importLibrary}
          onExportJson={library.exportJson}
          onExportZip={library.exportZip}
          onExportDatabase={library.exportDatabase}
          onExportAllOff={library.exportAllOff}
          onCreateFolder={library.createFolder}
          onRenameNode={library.renameItem}
          onMoveNodes={library.moveItems}
          onMoveUp={library.moveItemsUp}
          onDeleteLibrary={async (libraryId) => {
            await library.deleteLibrary(libraryId);
            setEditing((current) => (current?.libraryId === libraryId ? null : current));
          }}
          onDeleteNodes={async (libraryId, nodeIds) => {
            const next = await library.deleteItems(libraryId, nodeIds);
            setEditing((current) => {
              if (!current || current.libraryId !== next.id) return current;
              return findEntry(next, current.entryId) ? current : null;
            });
          }}
          canSaveCurrent={!busy && Boolean(offText?.trim())}
          onSaveCurrent={() => setSaveOpen(true)}
        />
      ) : (
        <StackPanel
          ops={present}
          onCommit={commitStack}
          onPatch={patchStack}
          busy={busy}
          error={error}
          failedStep={failedStep}
          stepText={stepText}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          canSave={Boolean(offText?.trim())}
          onSaveAs={onSaveAs}
          mode={mode}
          onModeChange={onModeChange}
          editingName={editingHit?.entry.name ?? null}
          onSaveToLibrary={() => setSaveOpen(true)}
        />
      )}
      {resizer}
      {stage}
      {saveOpen ? (
        <SaveToLibraryDialog
          defaultName={editingHit?.entry.name ?? "polyhedron"}
          canUpdate={editingHit != null}
          updateLabel={updateLabel}
          createLabel={createLabel}
          onUpdate={async (name) => {
            if (!editing) throw new Error("No library entry is open");
            await library.updateEntry(editing, buildDraft(name));
          }}
          onCreate={async (name) => {
            const ref = await library.createEntry(buildDraft(name));
            if (!editing) setEditing(ref);
          }}
          onClose={() => setSaveOpen(false)}
        />
      ) : null}
    </div>
  );
}
