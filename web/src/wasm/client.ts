import type { AntiprismTool, ToolResult } from "./runTool";

type Pending = {
  resolve: (r: ToolResult) => void;
  reject: (e: Error) => void;
};

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./antiprism.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data;
      if (msg.type === "result") {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          p.resolve(msg.result as ToolResult);
        }
      } else if (msg.type === "error") {
        for (const [, p] of pending) p.reject(new Error(msg.error));
        pending.clear();
      }
    };
    worker.onerror = (e) => {
      for (const [, p] of pending) p.reject(new Error(e.message));
      pending.clear();
    };
    ready = new Promise<void>((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        if (ev.data?.type === "ready") {
          worker!.removeEventListener("message", onMsg);
          resolve();
        } else if (ev.data?.type === "error") {
          worker!.removeEventListener("message", onMsg);
          reject(new Error(ev.data.error));
        }
      };
      worker!.addEventListener("message", onMsg);
      worker!.postMessage({ type: "init" });
    });
  }
  return { worker: worker!, ready: ready! };
}

export async function runAntiprism(
  tool: AntiprismTool,
  args: string[],
  stdinOff = "",
): Promise<ToolResult> {
  const { worker: w, ready: r } = getWorker();
  await r;
  const id = nextId++;
  return new Promise<ToolResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: "run", id, tool, args, stdinOff });
  });
}
