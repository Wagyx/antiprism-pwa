import * as THREE from "three";
import { parseOff } from "./parseOff";
import { DEFAULT_CAMERA_POS, DEFAULT_MESH_OPTIONS, buildMesh, disposeObject } from "./buildMesh";

const SIZE = 128;

type Job = {
  key: string;
  offText: string;
  generation: number;
};

const cache = new Map<string, string>();
const failed = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

let generation = 0;
let stack: Job[] = [];
let pending: Job[] = [];
let flushScheduled = false;
let pumping = false;
let unavailable = false;

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

export function previewKey(libraryId: string, entryId: string, modifiedAt: string): string {
  const position = DEFAULT_CAMERA_POS.toArray().join(",");
  return `${libraryId}:${entryId}:${modifiedAt}:${position}`;
}

export function previewUrl(key: string): string | null {
  return cache.get(key) ?? null;
}

export function subscribePreview(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

/** Drop queued work from the previous folder or search. */
export function beginPreviewScope() {
  generation += 1;
  stack = [];
  pending = [];
}

/** Ask for a preview. Newest requests are drawn first. */
export function requestPreview(key: string, offText: string) {
  if (!offText.trim() || cache.has(key) || failed.has(key) || unavailable) return;
  pending = pending.filter((job) => job.key !== key);
  stack = stack.filter((job) => job.key !== key);
  pending.push({ key, offText, generation });
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushPending);
  }
}

function flushPending() {
  flushScheduled = false;
  const batch = pending;
  pending = [];
  const current = generation;
  for (let index = batch.length - 1; index >= 0; index -= 1) {
    const job = batch[index];
    if (!job || job.generation !== current) continue;
    stack.push(job);
  }
  void pump();
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const job = stack.pop();
      if (!job) break;
      if (job.generation !== generation || cache.has(job.key) || failed.has(job.key)) continue;
      try {
        const url = renderOff(job.offText);
        if (url) cache.set(job.key, url);
        else failed.add(job.key);
      } catch {
        failed.add(job.key);
      }
      notify(job.key);
      await yieldFrame();
    }
  } finally {
    pumping = false;
    if (stack.length > 0) void pump();
  }
}

function ensureRenderer(): boolean {
  if (unavailable) return false;
  if (renderer && scene && camera) return true;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.copy(DEFAULT_CAMERA_POS);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    const light = new THREE.DirectionalLight(0xffffff, 0.7);
    camera.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    return true;
  } catch {
    unavailable = true;
    return false;
  }
}

function renderOff(offText: string): string | null {
  if (!ensureRenderer() || !renderer || !scene || !camera) return null;
  const mesh = buildMesh(parseOff(offText), DEFAULT_MESH_OPTIONS);
  scene.add(mesh);
  try {
    camera.position.copy(DEFAULT_CAMERA_POS);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    scene.remove(mesh);
    disposeObject(mesh);
  }
}
