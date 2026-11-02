import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { editorKey, type CommandStep } from "./pipeline/commandStep";
import { runPipeline } from "./pipeline/runPipeline";
import {
  defaultDisplay,
  saveAsOption,
  type DisplayOptions,
  type SaveAsFormatId,
} from "./pipeline/types";
import { useUndoable } from "./pipeline/useUndoable";
import { countsFromOff } from "./library/counts";
import { cloneSteps, inputForEditor, pipelineForEditor } from "./library/snapshot";
import { findEntry, folderByPath, requireUnique, resolveDestination } from "./library/tree";
import type { CliImportRow } from "./ui/CliPipelineDialog";
import type { EntryDraft, EntryRef, LibraryInputFile, PolyCounts } from "./library/types";
import { useLibrary } from "./library/useLibrary";
import { saveOffFile } from "./io/saveOff";
import { saveTextFile } from "./io/saveTextFile";
import { DisplayPanel } from "./ui/DisplayPanel";
import { LibraryPanel } from "./ui/LibraryPanel";
import { SavePolyhedronDialog, UnsavedChangesDialog } from "./ui/SaveToLibraryDialog";
import { StackPanel } from "./ui/StackPanel";
import { StatsPanel } from "./ui/StatsPanel";
import { PolyhedronViewer } from "./viewer/PolyhedronViewer";
import { runAntiprism } from "./wasm/client";
import "./App.css";

const DEBOUNCE_MS = 200;
const PANEL_MIN = 200;
const PANEL_MAX = 680;
const PANEL_DEFAULT = 420;

type EditorSession = {
  ref: EntryRef | null;
  name: string | null;
  baseline: string;
  location: { libraryId: string; folderIds: string[] };
};


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
  } = useUndoable<CommandStep[]>([]);

  const library = useLibrary();
  const [session, setSession] = useState<EditorSession | null>(null);
  const [saveMode, setSaveMode] = useState<null | "save" | "save-as">(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leavePending, setLeavePending] = useState(false);

  const [inputFile, setInputFile] = useState<LibraryInputFile | null>(null);
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
  const exitAfterSave = useRef(false);
  const sessionRef = useRef(session);
  const presentRef = useRef(present);
  const inputFileRef = useRef(inputFile);
  const saveCurrentRef = useRef<() => void>(() => {});

  const clearBusyTimer = () => {
    if (busyTimer.current != null) {
      window.clearTimeout(busyTimer.current);
      busyTimer.current = null;
    }
  };

  const evaluate = useEffectEvent(async (ops: CommandStep[], file: LibraryInputFile | null, runId: number) => {
    clearBusyTimer();
    busyTimer.current = window.setTimeout(() => {
      if (runId === latestRun.current) setBusy(true);
    }, 250);

    try {
      const result = await runPipeline(ops, file);
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

  const editorOpen = session !== null;
  const dirty = session !== null && editorKey(present, inputFile) !== session.baseline;

  useEffect(() => {
    sessionRef.current = session;
    presentRef.current = present;
    inputFileRef.current = inputFile;
  }, [session, present, inputFile]);

  useEffect(() => {
    if (!editorOpen) return;
    const key = editorKey(present, inputFile);
    const t = window.setTimeout(() => {
      if (key === lastRunKey.current) return;
      lastRunKey.current = key;
      const runId = ++latestRun.current;
      void evaluate(present, inputFile, runId);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [present, inputFile, editorOpen]);

  const countsFor = (off: string): PolyCounts => {
    if (!off.trim()) return { nVertices: 0, nEdges: 0, nFaces: 0 };
    try {
      return countsFromOff(off);
    } catch {
      return { nVertices: 0, nEdges: 0, nFaces: 0 };
    }
  };

  const buildDraft = (name: string) => {
    const off = offTextRef.current ?? "";
    return {
      name,
      offText: off,
      pipeline: cloneSteps(presentRef.current),
      inputFile: inputFileRef.current,
      counts: countsFor(off),
    };
  };

  const closeEditor = () => {
    exitAfterSave.current = false;
    setLeaveOpen(false);
    setLeaveError(null);
    setLeavePending(false);
    setSaveMode(null);
    setSession(null);
    setCameraResetKey((key) => key + 1);
  };

  const openSession = (
    next: EditorSession,
    ops: CommandStep[],
    file: LibraryInputFile | null,
    off: string | null,
  ) => {
    lastRunKey.current = "";
    presentRef.current = ops;
    inputFileRef.current = file;
    setInputFile(file);
    loadStack(ops);
    offTextRef.current = off;
    setOffText(off);
    setError(null);
    setFailedStep(null);
    setStepText({});
    setSession(next);
    setCameraResetKey((key) => key + 1);
  };

  const onCreatePolyhedron = () => {
    const dest = resolveDestination(library.libraries, library.nav);
    openSession(
      {
        ref: null,
        name: null,
        baseline: "",
        location: dest,
      },
      [],
      null,
      null,
    );
  };

  const onImportFromCli = async (rows: CliImportRow[]) => {
    const dest = resolveDestination(library.libraries, library.nav);
    const drafts: EntryDraft[] = [];
    for (const row of rows) {
      const result = await runPipeline(row.steps, row.inputFile);
      if (!result.ok || !result.offText?.trim()) {
        throw new Error(`${row.name}: ${result.error ?? "the pipeline produced no polyhedron"}`);
      }
      drafts.push({
        name: row.name,
        offText: result.offText,
        pipeline: row.steps,
        inputFile: row.inputFile,
        counts: countsFor(result.offText),
      });
    }
    return library.createEntries(drafts, dest);
  };

  const onEditEntry = (ref: EntryRef) => {
    const doc = library.libraries.find((item) => item.id === ref.libraryId);
    if (!doc) throw new Error("Library not found");
    const hit = findEntry(doc, ref.entryId);
    if (!hit) throw new Error("Entry not found");
    const ops = pipelineForEditor(hit.entry);
    const file = inputForEditor(hit.entry);
    library.setSelected(ref);
    openSession(
      {
        ref,
        name: hit.entry.name,
        baseline: editorKey(ops, file),
        location: { libraryId: doc.id, folderIds: hit.folderIds },
      },
      ops,
      file,
      hit.entry.offText,
    );
  };

  const onRenamePolyhedron = async (name: string) => {
    const current = sessionRef.current;
    if (!current) return;
    if (current.ref) {
      await library.renameItem(current.ref.libraryId, current.ref.entryId, name);
    } else {
      const doc = library.libraries.find((item) => item.id === current.location.libraryId);
      const folder = doc ? folderByPath(doc, current.location.folderIds) : null;
      if (!folder) throw new Error("Folder not found");
      requireUnique(
        folder.children.map((child) => child.name),
        name,
      );
    }
    setSession((value) => (value ? { ...value, name } : value));
  };

  const saveExisting = async () => {
    const current = sessionRef.current;
    if (!current?.ref || !current.name) return false;
    const draft = buildDraft(current.name);
    await library.updateEntry(current.ref, draft);
    const baseline = editorKey(draft.pipeline, draft.inputFile);
    setSession((value) => (value ? { ...value, baseline } : value));
    return true;
  };

  const requestExit = () => {
    const current = sessionRef.current;
    if (!current) return;
    if (editorKey(presentRef.current, inputFileRef.current) !== current.baseline) {
      setLeaveError(null);
      setLeaveOpen(true);
      return;
    }
    closeEditor();
  };

  const saveCurrent = () => {
    const current = sessionRef.current;
    if (!current) return;
    if (!current.ref || !current.name) {
      exitAfterSave.current = false;
      setSaveMode("save");
      return;
    }
    void saveExisting().catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason));
      setFailedStep(null);
    });
  };

  useEffect(() => {
    saveCurrentRef.current = saveCurrent;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !sessionRef.current) return;
      const key = e.key.toLowerCase();
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        if (leaveOpen) return;
        if (saveMode) {
          document.querySelector<HTMLFormElement>(".modal form")?.requestSubmit();
          return;
        }
        saveCurrentRef.current();
        return;
      }
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
  }, [undo, redo, saveMode, leaveOpen]);

  const selectedHit = useMemo(() => {
    if (!library.selected) return null;
    const doc = library.libraries.find((item) => item.id === library.selected?.libraryId);
    if (!doc) return null;
    const hit = findEntry(doc, library.selected.entryId);
    return hit ? { doc, ...hit } : null;
  }, [library.libraries, library.selected]);

  const onSelectEntry = (ref: EntryRef | null) => {
    library.setSelected(ref);
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

  const stage = (
    <Stage
      offText={editorOpen ? offText : selectedHit?.entry.offText ?? null}
      display={display}
      onDisplay={setDisplay}
      onResetCamera={() => setCameraResetKey((key) => key + 1)}
      cameraResetKey={cameraResetKey}
      caption={editorOpen ? null : selectedHit?.entry.name ?? "Select an entry"}
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
      {editorOpen && session ? (
        <StackPanel
          steps={present}
          inputFile={inputFile}
          onInputFile={(file) => {
            inputFileRef.current = file;
            setInputFile(file);
          }}
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
          onExport={onSaveAs}
          editingName={session.name}
          dirty={dirty}
          onRename={onRenamePolyhedron}
          onSave={saveCurrent}
          onSaveAsNew={() => {
            exitAfterSave.current = false;
            setSaveMode("save-as");
          }}
          onExit={requestExit}
        />
      ) : (
        <LibraryPanel
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
            setSession((current) =>
              current?.ref?.libraryId === libraryId ? null : current,
            );
          }}
          onDeleteNodes={async (libraryId, nodeIds) => {
            const next = await library.deleteItems(libraryId, nodeIds);
            setSession((current) => {
              if (!current?.ref || current.ref.libraryId !== next.id) return current;
              return findEntry(next, current.ref.entryId) ? current : null;
            });
          }}
          onCreatePolyhedron={onCreatePolyhedron}
          onImportFromCli={onImportFromCli}
        />
      )}
      {resizer}
      {stage}
      {saveMode && session ? (
        <SavePolyhedronDialog
          libraries={library.libraries}
          initialLocation={session.location}
          defaultName={session.name ?? "polyhedron"}
          title={saveMode === "save-as" ? "Save as" : "Save"}
          onSave={async (name, location) => {
            const draft = buildDraft(name);
            const ref = await library.createEntry(draft, location);
            const baseline = editorKey(draft.pipeline, draft.inputFile);
            const leaving = exitAfterSave.current;
            exitAfterSave.current = false;
            setSaveMode(null);
            if (leaving) {
              setSession(null);
              setCameraResetKey((key) => key + 1);
              return;
            }
            setSession({ ref, name, baseline, location });
          }}
          onClose={() => {
            exitAfterSave.current = false;
            setSaveMode(null);
          }}
        />
      ) : null}
      {leaveOpen ? (
        <UnsavedChangesDialog
          name={session?.name ?? null}
          pending={leavePending}
          error={leaveError}
          onCancel={() => {
            setLeaveError(null);
            setLeaveOpen(false);
          }}
          onDiscard={closeEditor}
          onSave={() => {
            const current = sessionRef.current;
            if (!current) return;
            if (!current.ref || !current.name) {
              exitAfterSave.current = true;
              setLeaveOpen(false);
              setLeaveError(null);
              setSaveMode("save");
              return;
            }
            setLeavePending(true);
            setLeaveError(null);
            void saveExisting()
              .then(() => closeEditor())
              .catch((reason) => {
                setLeaveError(reason instanceof Error ? reason.message : String(reason));
                setLeavePending(false);
              });
          }}
        />
      ) : null}
    </div>
  );
}
