import { runTool, type AntiprismModule, type AntiprismTool } from "./runTool";

type InitMsg = { type: "init" };
type RunMsg = {
  type: "run";
  id: number;
  tool: AntiprismTool;
  args: string[];
  stdinOff?: string;
};
type InMsg = InitMsg | RunMsg;

let Module: AntiprismModule | null = null;
let initPromise: Promise<void> | null = null;

async function ensureModule() {
  if (Module) return;
  if (!initPromise) {
    initPromise = (async () => {
      const base = `${self.location.origin}/wasm`;
      const mod = await import(/* @vite-ignore */ `${base}/antiprism.js`);
      const create = mod.default as (opts?: Record<string, unknown>) => Promise<AntiprismModule>;
      Module = await create({
        locateFile: (file: string) => `${base}/${file}`,
      });
      self.postMessage({ type: "ready" });
    })();
  }
  await initPromise;
}

self.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      await ensureModule();
      return;
    }
    if (msg.type === "run") {
      await ensureModule();
      const result = runTool(Module!, msg.tool, msg.args, msg.stdinOff ?? "");
      self.postMessage({ type: "result", id: msg.id, result });
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (msg.type === "run") {
      self.postMessage({
        type: "result",
        id: msg.id,
        result: { ok: false, code: 1, stdout: "", stderr: err },
      });
    } else {
      self.postMessage({ type: "error", error: err });
    }
  }
};
