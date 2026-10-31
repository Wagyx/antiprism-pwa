import { useCallback, useEffect, useState } from "react";
import { Controls, type ControlsState } from "./ui/Controls";
import { PolyhedronViewer } from "./viewer/PolyhedronViewer";
import { runAntiprism } from "./wasm/client";
import "./App.css";

const initial: ControlsState = {
  mode: "polygon",
  polygonType: "prism",
  numSides: 5,
  conway: "oT",
  verticesActive: true,
  edgesActive: true,
  facesActive: true,
};

export default function App() {
  const [controls, setControls] = useState<ControlsState>(initial);
  const [offText, setOffText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result =
        controls.mode === "polygon"
          ? await runAntiprism("polygon", [
              controls.polygonType,
              String(controls.numSides),
            ])
          : await runAntiprism("conway", [controls.conway.trim()]);

      if (!result.ok) {
        setError(result.stderr.trim() || `Tool exited with code ${result.code}`);
        setOffText(null);
        return;
      }
      setOffText(result.stdout);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOffText(null);
    } finally {
      setBusy(false);
    }
  }, [controls]);

  useEffect(() => {
    void generate();
    // Initial seed only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      <Controls
        value={controls}
        onChange={setControls}
        onGenerate={() => void generate()}
        busy={busy}
        error={error}
      />
      <main className="stage">
        <PolyhedronViewer
          offText={offText}
          verticesActive={controls.verticesActive}
          edgesActive={controls.edgesActive}
          facesActive={controls.facesActive}
        />
      </main>
    </div>
  );
}
