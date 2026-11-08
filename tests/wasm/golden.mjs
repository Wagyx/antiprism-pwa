#!/usr/bin/env node
/**
 * Compare Wasm tool output to native Antiprism CLIs.
 * Coordinates may differ by 1 ULP across native vs Wasm math; compare numerically.
 * OFF vertex and face order may differ; face winding is kept.
 * Site examples (antiprism.com program pages) live in site-examples.json.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runTool } from "../../wasm/run_tool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const dist = path.join(root, "wasm/dist");
const nativeSrc = path.join(root, "antiprism/src");

const { default: createAntiprismModule } = await import(
  pathToFileURL(path.join(dist, "antiprism.mjs")).href
);

const ABS_EPS = 1e-12;
const REL_EPS = 1e-12;

function nativeRun(tool, args, stdin = "") {
  const bin = path.join(nativeSrc, tool);
  const r = spawnSync(bin, args, {
    input: stdin,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
  return {
    ok: r.status === 0,
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    timedOut: r.error?.code === "ETIMEDOUT",
  };
}

/** conv_hull reports hull dimension as its exit status when it still wrote OFF. */
function stageOk(tool, result) {
  if (result.timedOut) return false;
  if (result.ok) return true;
  return tool === "conv_hull" && /^\s*OFF\b/i.test(result.stdout);
}

function runNativePipeline(stages, stdin = "") {
  let input = stdin;
  let last = { ok: true, code: 0, stdout: "", stderr: "", timedOut: false };
  for (const stage of stages) {
    last = nativeRun(stage.tool, stage.args, input);
    if (!stageOk(stage.tool, last)) return { ...last, failedTool: stage.tool };
    input = last.stdout;
  }
  return last;
}

function runWasmPipeline(Module, stages, stdin = "") {
  let input = stdin;
  let last = { ok: true, code: 0, stdout: "", stderr: "" };
  for (const stage of stages) {
    last = runTool(Module, stage.tool, stage.args, input);
    if (!stageOk(stage.tool, last)) return { ...last, failedTool: stage.tool };
    input = last.stdout;
  }
  return last;
}

function tokenizeOff(text) {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\s+/)
    .flatMap((t) => t.split(","))
    .filter((t) => t.length > 0);
}

function nearlyEqual(a, b) {
  const diff = Math.abs(a - b);
  if (diff <= ABS_EPS) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff <= REL_EPS * scale;
}

function compareTokens(nativeText, wasmText) {
  const nTok = tokenizeOff(nativeText);
  const wTok = tokenizeOff(wasmText);
  if (nTok.length !== wTok.length) {
    return {
      ok: false,
      detail: `token count native=${nTok.length} wasm=${wTok.length}`,
    };
  }
  for (let i = 0; i < nTok.length; i++) {
    const nt = nTok[i];
    const wt = wTok[i];
    const nn = Number(nt);
    const wn = Number(wt);
    const bothNum = Number.isFinite(nn) && Number.isFinite(wn) && /^-?\d/.test(nt) && /^-?\d/.test(wt);
    if (bothNum) {
      if (!nearlyEqual(nn, wn)) {
        return {
          ok: false,
          detail: `token ${i}: native=${nt} wasm=${wt}`,
        };
      }
    } else if (nt !== wt) {
      return { ok: false, detail: `token ${i}: native=${nt} wasm=${wt}` };
    }
  }
  return { ok: true };
}

/** Antiprism OFF is one vertex or face per line. Order is not significant. */
function parseOff(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length === 0 || !/^OFF\b/i.test(lines[0])) return null;
  let counts;
  let idx;
  if (/^OFF$/i.test(lines[0])) {
    if (!lines[1]) return null;
    counts = lines[1].split(/\s+/).map(Number);
    idx = 2;
  } else {
    counts = lines[0].replace(/^OFF\s+/i, "").split(/\s+/).map(Number);
    idx = 1;
  }
  if (counts.length < 2 || counts.some((n) => !Number.isFinite(n))) return null;
  const nv = counts[0];
  const nf = counts[1];
  if (idx + nv + nf > lines.length) return null;
  const verts = [];
  for (let i = 0; i < nv; i++) {
    const nums = lines[idx + i].split(/\s+/).map(Number);
    if (nums.length < 3 || nums.some((n) => !Number.isFinite(n))) return null;
    verts.push(nums);
  }
  const faces = [];
  for (let i = 0; i < nf; i++) {
    const parts = lines[idx + nv + i].split(/\s+/);
    const n = Number(parts[0]);
    if (!Number.isInteger(n) || n < 0 || 1 + n > parts.length) return null;
    const faceIdx = parts.slice(1, 1 + n).map(Number);
    const extra = parts.slice(1 + n).map(Number);
    if (faceIdx.some((k) => !Number.isInteger(k) || k < 0 || k >= nv)) return null;
    if (extra.some((k) => !Number.isFinite(k))) return null;
    faces.push({ faceIdx, extra });
  }
  return { verts, faces };
}

function vertKey(nums) {
  return nums.map((n) => (Math.round(n * 1e9) / 1e9).toString()).join(",");
}

function minRotation(keys) {
  const n = keys.length;
  if (n === 0) return keys;
  let best = keys;
  for (let i = 1; i < n; i++) {
    const rot = keys.slice(i).concat(keys.slice(0, i));
    for (let j = 0; j < n; j++) {
      if (rot[j] < best[j]) {
        best = rot;
        break;
      }
      if (rot[j] > best[j]) break;
    }
  }
  return best;
}

function compareOffGeometry(nativeText, wasmText) {
  const native = parseOff(nativeText);
  const wasm = parseOff(wasmText);
  if (!native || !wasm) return null;
  if (native.verts.length !== wasm.verts.length) {
    return {
      ok: false,
      detail: `vertex count native=${native.verts.length} wasm=${wasm.verts.length}`,
    };
  }
  const nVerts = native.verts.map(vertKey).sort();
  const wVerts = wasm.verts.map(vertKey).sort();
  for (let i = 0; i < nVerts.length; i++) {
    if (nVerts[i] !== wVerts[i]) {
      return { ok: false, detail: `vertex ${i}: native=${nVerts[i]} wasm=${wVerts[i]}` };
    }
  }
  const faceSig = (model) =>
    model.faces
      .map((face) => {
        const cycle = minRotation(face.faceIdx.map((i) => vertKey(model.verts[i])));
        const color = face.extra.map((n) => (Math.round(n * 1e9) / 1e9).toString()).join(",");
        return `${cycle.join(" ")}${color ? ` ${color}` : ""}`;
      })
      .sort();
  const nFaces = faceSig(native);
  const wFaces = faceSig(wasm);
  if (nFaces.length !== wFaces.length) {
    return { ok: false, detail: `face count native=${nFaces.length} wasm=${wFaces.length}` };
  }
  for (let i = 0; i < nFaces.length; i++) {
    if (nFaces[i] !== wFaces[i]) {
      return { ok: false, detail: `face ${i}: native=${nFaces[i]} wasm=${wFaces[i]}` };
    }
  }
  return { ok: true };
}

function compareOff(nativeText, wasmText) {
  const geometric = compareOffGeometry(nativeText, wasmText);
  if (geometric) return geometric;
  return compareTokens(nativeText, wasmText);
}

const seedPrism = nativeRun("polygon", ["prism", "4"]);
if (!seedPrism.ok) {
  console.error("failed to make seed prism for piped tests");
  process.exit(1);
}
const seedOff = seedPrism.stdout;

const seedAmbo = nativeRun("conway", ["a"], seedOff);
if (!seedAmbo.ok) {
  console.error("failed to make ambo seed for planar tests");
  process.exit(1);
}
const amboOff = seedAmbo.stdout;

const cases = [
  { tool: "polygon", args: ["prism", "4"] },
  { tool: "polygon", args: ["antiprism", "5"] },
  { tool: "polygon", args: ["pyramid", "6"] },
  { tool: "conway", args: ["T"] },
  { tool: "conway", args: ["oT"] },
  { tool: "conway", args: ["aC"] },
  { tool: "geodesic", args: ["-f", "2"], stdin: seedOff },
  { tool: "geodesic", args: ["-f", "3", "-c", "2", "-M", "p"], stdin: seedOff },
  { tool: "off_color", args: ["-f", "N", "-e", "U"], stdin: seedOff },
  { tool: "off_util", args: ["-s"], stdin: seedOff },
  { tool: "off_util", args: ["-S", "-O", "positive"], stdin: seedOff },
  { tool: "off_trans", args: ["-S", "1.5"], stdin: seedOff },
  { tool: "off_trans", args: ["-R", "0,0,45"], stdin: seedOff },
  { tool: "pol_recip", args: ["-c", "C"], stdin: seedOff },
  { tool: "canonical", args: ["-p", "p", "-n", "40", "-i", "40"], stdin: seedOff },
  // prism-4 hull can exit non-zero (qhull status) despite OFF; use prism-5
  { tool: "conv_hull", args: [], stdin: nativeRun("polygon", ["prism", "5"]).stdout },
  { tool: "conv_hull", args: ["-a"], stdin: nativeRun("polygon", ["prism", "5"]).stdout },
  { tool: "planar", args: ["-d", "1"], stdin: amboOff },
  { tool: "zono", args: ["-m", "v"], stdin: nativeRun("conway", ["C"]).stdout },
  { tool: "poly_kscope", args: ["-s", "Oh"], stdin: seedOff },
  {
    tool: "stellate",
    args: ["-f", "0,1"],
    stdin: nativeRun("conway", ["D"]).stdout,
  },
  { tool: "leonardo", args: ["-w", "30%"], stdin: nativeRun("conway", ["C"]).stdout },
  {
    tool: "wythoff",
    args: ["-p", "[V]0e,0e,0e"],
    stdin: nativeRun("conway", ["C"]).stdout,
  },
  { tool: "to_nfold", args: ["5"], stdin: seedOff },
  { tool: "off_normals", args: ["-u", "-e"], stdin: seedOff },
  {
    tool: "repel",
    args: ["-n", "20", "-z", "-1"],
    stdin: nativeRun("conway", ["C"]).stdout,
  },
];

let Module = await createAntiprismModule({
  locateFile: (f) => path.join(dist, f),
});

async function restartModule() {
  Module = await createAntiprismModule({
    locateFile: (f) => path.join(dist, f),
  });
}

const siteExamples = JSON.parse(
  readFileSync(path.join(__dirname, "site-examples.json"), "utf8"),
);

let failed = 0;
let passed = 0;

async function checkCase(label, stages, stdin = "") {
  const native = runNativePipeline(stages, stdin);
  if (native.timedOut) {
    console.error(`FAIL ${label}: native timed out (${native.failedTool})`);
    failed++;
    return;
  }
  if (native.failedTool) {
    console.error(
      `FAIL ${label}: native ${native.failedTool} exited ${native.code}\n${native.stderr}`,
    );
    failed++;
    return;
  }
  let wasm;
  try {
    wasm = runWasmPipeline(Module, stages, stdin);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${label}: wasm threw ${message.split("\n")[0]}`);
    failed++;
    if (message.includes("Aborted")) await restartModule();
    return;
  }
  if (wasm.failedTool) {
    console.error(
      `FAIL ${label}: wasm ${wasm.failedTool} exited ${wasm.code}\n${wasm.stderr}`,
    );
    failed++;
    return;
  }
  const cmp = compareOff(native.stdout, wasm.stdout);
  if (cmp.ok) {
    console.log(`PASS ${label}`);
    passed++;
  } else {
    console.error(`FAIL ${label}: ${cmp.detail}`);
    failed++;
  }
}

for (const c of cases) {
  await checkCase(`${c.tool} ${c.args.join(" ")}`, [{ tool: c.tool, args: c.args }], c.stdin ?? "");
}

for (const example of siteExamples) {
  await checkCase(`[${example.program}] ${example.label}`, example.stages);
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${passed} golden cases passed`);
