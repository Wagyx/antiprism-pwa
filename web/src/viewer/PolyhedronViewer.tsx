import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AXES_SIZE, DEFAULT_CAMERA_POS, buildMesh, disposeObject } from "./buildMesh";
import { parseOff } from "./parseOff";

/** Try several WebGL context configs — soft GL (llvmpipe) often rejects antialias. */
function createRenderer(): THREE.WebGLRenderer {
  const attempts: WebGLContextAttributes[] = [
    { alpha: true, antialias: true, depth: true, stencil: false, powerPreference: "high-performance" },
    { alpha: true, antialias: false, depth: true, stencil: false, powerPreference: "default" },
    { alpha: true, antialias: false, depth: true, stencil: false, powerPreference: "low-power" },
    { alpha: true, antialias: false, depth: true, failIfMajorPerformanceCaveat: false },
  ];

  let lastError: unknown;
  for (const attrs of attempts) {
    const canvas = document.createElement("canvas");
    for (const api of ["webgl2", "webgl"] as const) {
      try {
        const gl = canvas.getContext(api, attrs);
        if (!gl) continue;
        const renderer = new THREE.WebGLRenderer({
          canvas,
          context: gl as WebGLRenderingContext,
          alpha: true,
          antialias: Boolean(attrs.antialias),
          powerPreference: attrs.powerPreference,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        return renderer;
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not create a WebGL context");
}

type Props = {
  offText: string | null;
  verticesActive?: boolean;
  edgesActive?: boolean;
  facesActive?: boolean;
  axesActive?: boolean;
  vertexRadius?: number;
  edgeRadius?: number;
  /** Increment to restore the default camera/orbit view. */
  cameraResetKey?: number;
};

function resetCameraView(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
) {
  camera.position.copy(DEFAULT_CAMERA_POS);
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState();
}

export function PolyhedronViewer({
  offText,
  verticesActive = true,
  edgesActive = true,
  facesActive = true,
  axesActive = true,
  vertexRadius = 0.03,
  edgeRadius = 0.02,
  cameraResetKey = 0,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    content: THREE.Object3D | null;
    axes: THREE.AxesHelper;
    raf: number;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = createRenderer();
      setGlError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGlError(msg);
      console.error("WebGL init failed:", e);
      return;
    }

    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    scene.add(camera);

    const light = new THREE.DirectionalLight(0xffffff, 0.7);
    camera.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.2;
    controls.enablePan = true;
    resetCameraView(camera, controls);

    const axes = new THREE.AxesHelper(AXES_SIZE);
    axes.visible = axesActive;
    scene.add(axes);

    const state = {
      renderer,
      scene,
      camera,
      controls,
      content: null as THREE.Object3D | null,
      axes,
      raf: 0,
    };
    sceneRef.current = state;

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const tick = () => {
      state.raf = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      controls.dispose();
      axes.geometry.dispose();
      const mat = axes.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    state.axes.visible = axesActive;
  }, [axesActive]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    if (state.content) {
      state.scene.remove(state.content);
      disposeObject(state.content);
      state.content = null;
    }
    if (!offText) return;
    try {
      const parsed = parseOff(offText);
      const mesh = buildMesh(parsed, {
        verticesActive,
        edgesActive,
        facesActive,
        vertexRadius,
        edgeRadius,
      });
      state.scene.add(mesh);
      state.content = mesh;
    } catch (e) {
      console.error(e);
    }
  }, [offText, verticesActive, edgesActive, facesActive, vertexRadius, edgeRadius]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    resetCameraView(state.camera, state.controls);
  }, [cameraResetKey]);

  return (
    <div className="viewer-mount" ref={mountRef}>
      {glError ? (
        <div className="viewer-gl-error" role="alert">
          <p>
            <strong>WebGL unavailable</strong>
          </p>
          <p>
            The browser could not create a GPU context (often Mesa llvmpipe /
            disabled hardware acceleration). Try another browser, enable
            hardware acceleration, or update GPU drivers.
          </p>
          <p className="viewer-gl-error-detail">{glError}</p>
        </div>
      ) : null}
    </div>
  );
}
