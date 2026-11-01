import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { fillMissingColors, parseOff, type ParsedOff, type Rgba } from "./parseOff";

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
  vertexRadius?: number;
  edgeRadius?: number;
};

function groupByAlpha(colors: (Rgba | undefined)[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  colors.forEach((c, i) => {
    const a = c?.[3] ?? 1;
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(i);
  });
  return map;
}

function quaternionFromDir(direction: THREE.Vector3): THREE.Quaternion {
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(up, direction.clone().normalize());
  return q;
}

function buildMesh(
  data: ParsedOff,
  opts: {
    verticesActive: boolean;
    edgesActive: boolean;
    facesActive: boolean;
    vertexRadius: number;
    edgeRadius: number;
  },
): THREE.Object3D {
  fillMissingColors(data);
  const root = new THREE.Object3D();

  const vertices: THREE.Vector3[] = [];
  const center = new THREE.Vector3();
  for (const v of data.vertices) {
    const tv = new THREE.Vector3(v[0], v[1], v[2]);
    center.add(tv);
    vertices.push(tv);
  }
  if (vertices.length) center.divideScalar(vertices.length);

  const radii: number[] = [];
  for (const v of vertices) {
    v.sub(center);
    radii.push(v.length());
  }
  const polyScale = 10 / Math.max(...radii, 1e-9);

  const edgeLens: number[] = [];
  for (const [a, b] of data.edges) {
    edgeLens.push(vertices[a].distanceTo(vertices[b]));
  }
  const scaleFactor =
    edgeLens.length > 0
      ? edgeLens.reduce((s, x) => s + x, 0) / edgeLens.length
      : 1;

  // Vertices — InstancedMesh grouped by opacity (alpha from OFF)
  {
    const byAlpha = groupByAlpha(data.verticesColor);
    for (const [alpha, indices] of byAlpha) {
      if (alpha === 0) continue;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: alpha,
        depthWrite: alpha >= 0.99,
        visible: opts.verticesActive,
      });
      const geom = new THREE.SphereGeometry(opts.vertexRadius, 16, 12);
      const mesh = new THREE.InstancedMesh(geom, material, indices.length);
      const S = new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);
      indices.forEach((ind, i) => {
        const p = vertices[ind];
        const M = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
        mesh.setMatrixAt(i, M.multiply(S));
        const c = data.verticesColor[ind]!;
        mesh.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      root.add(mesh);
    }
  }

  // Edges — cylinders grouped by opacity
  {
    const byAlpha = groupByAlpha(data.edgesColor);
    for (const [alpha, indices] of byAlpha) {
      if (alpha === 0) continue;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: alpha,
        depthWrite: alpha >= 0.99,
        visible: opts.edgesActive,
      });
      const geom = new THREE.CylinderGeometry(
        opts.edgeRadius,
        opts.edgeRadius,
        1,
        12,
        1,
      );
      const mesh = new THREE.InstancedMesh(geom, material, indices.length);
      indices.forEach((ind, i) => {
        const p0 = vertices[data.edges[ind][0]];
        const p1 = vertices[data.edges[ind][1]];
        const direction = new THREE.Vector3().subVectors(p1, p0);
        const d = direction.length();
        const position = new THREE.Vector3()
          .addVectors(p0, direction.clone().multiplyScalar(0.5));
        direction.normalize();
        const scale = new THREE.Vector3(scaleFactor, d, scaleFactor);
        const quaternion = quaternionFromDir(direction);
        const M = new THREE.Matrix4().compose(position, quaternion, scale);
        mesh.setMatrixAt(i, M);
        const c = data.edgesColor[ind]!;
        mesh.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      root.add(mesh);
    }
  }

  // Faces — triangulated, grouped by opacity
  {
    const byAlpha = groupByAlpha(data.facesColor);
    for (const [alpha, faceNums] of byAlpha) {
      if (alpha === 0) continue;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: alpha,
        depthWrite: alpha >= 0.99,
        visible: opts.facesActive,
      });
      const points: number[] = [];
      const colors: number[] = [];
      for (const faceNum of faceNums) {
        const col = data.facesColor[faceNum]!;
        const face = data.faces[faceNum];
        const pushV = (v: THREE.Vector3) => {
          points.push(v.x, v.y, v.z);
          colors.push(col[0], col[1], col[2]);
        };
        if (face.length === 3) {
          pushV(vertices[face[0]]);
          pushV(vertices[face[1]]);
          pushV(vertices[face[2]]);
        } else {
          const faceCenter = new THREE.Vector3();
          for (const vi of face) faceCenter.add(vertices[vi]);
          faceCenter.multiplyScalar(1 / face.length);
          for (let i = 0; i < face.length; i++) {
            pushV(faceCenter);
            pushV(vertices[face[i]]);
            pushV(vertices[face[(i + 1) % face.length]]);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      root.add(new THREE.Mesh(geometry, material));
    }
  }

  root.scale.setScalar(polyScale);
  return root;
}

export function PolyhedronViewer({
  offText,
  verticesActive = true,
  edgesActive = true,
  facesActive = true,
  vertexRadius = 0.03,
  edgeRadius = 0.02,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    content: THREE.Object3D | null;
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
    camera.position.set(0, 0, 40);
    scene.add(camera);

    const light = new THREE.DirectionalLight(0xffffff, 0.7);
    camera.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.2;
    controls.enablePan = true;

    const state = {
      renderer,
      scene,
      camera,
      controls,
      content: null as THREE.Object3D | null,
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
    if (state.content) {
      state.scene.remove(state.content);
      state.content.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
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
      state.controls.reset();
      state.camera.position.set(0, 0, 40);
    } catch (e) {
      console.error(e);
    }
  }, [offText, verticesActive, edgesActive, facesActive, vertexRadius, edgeRadius]);

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
