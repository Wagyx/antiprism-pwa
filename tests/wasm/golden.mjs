#!/usr/bin/env node
/**
 * Compare Wasm tool OFF output to native Antiprism CLIs.
 * Coordinates may differ by 1 ULP across native vs Wasm math; compare numerically.
 */
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
  });
  return {
    ok: r.status === 0,
    code: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function tokenizeOff(text) {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function nearlyEqual(a, b) {
  const diff = Math.abs(a - b);
  if (diff <= ABS_EPS) return true;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return diff <= REL_EPS * scale;
}

function compareOff(nativeText, wasmText) {
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
    const bothNum = Number.isFinite(nn) && Number.isFinite(wn) && /^-?\d/.test(nt);
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

const Module = await createAntiprismModule({
  locateFile: (f) => path.join(dist, f),
});

let failed = 0;
for (const c of cases) {
  const label = `${c.tool} ${c.args.join(" ")}`;
  const native = nativeRun(c.tool, c.args, c.stdin ?? "");
  const wasm = runTool(Module, c.tool, c.args, c.stdin ?? "");

  // conv_hull returns hull dimension as exit status on success
  const nativeOk =
    native.ok ||
    (c.tool === "conv_hull" && /^\s*OFF\b/i.test(native.stdout));
  if (!nativeOk) {
    console.error(`FAIL ${label}: native exited ${native.code}\n${native.stderr}`);
    failed++;
    continue;
  }
  if (!wasm.ok) {
    console.error(`FAIL ${label}: wasm exited ${wasm.code}\n${wasm.stderr}`);
    failed++;
    continue;
  }

  const cmp = compareOff(native.stdout, wasm.stdout);
  if (cmp.ok) {
    console.log(`PASS ${label}`);
  } else {
    console.error(`FAIL ${label}: ${cmp.detail}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} golden cases passed`);
