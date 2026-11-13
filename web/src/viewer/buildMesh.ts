import * as THREE from "three";
import { fillMissingColors, type ParsedOff, type Rgba } from "./parseOff";

/** Axis length in scene units (polyhedra are normalized near radius 10). */
export const AXES_SIZE = 12;

export const DEFAULT_CAMERA_POS = new THREE.Vector3(35, 35, 35);

export const DEFAULT_MESH_OPTIONS = {
  verticesActive: true,
  edgesActive: true,
  facesActive: true,
  vertexRadius: 0.03,
  edgeRadius: 0.02,
};

export type MeshOptions = typeof DEFAULT_MESH_OPTIONS;

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

export function buildMesh(data: ParsedOff, opts: MeshOptions): THREE.Object3D {
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
      const geom = new THREE.CylinderGeometry(opts.edgeRadius, opts.edgeRadius, 1, 12, 1);
      const mesh = new THREE.InstancedMesh(geom, material, indices.length);
      indices.forEach((ind, i) => {
        const p0 = vertices[data.edges[ind][0]];
        const p1 = vertices[data.edges[ind][1]];
        const direction = new THREE.Vector3().subVectors(p1, p0);
        const d = direction.length();
        const position = new THREE.Vector3().addVectors(p0, direction.clone().multiplyScalar(0.5));
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

export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((material) => material.dispose());
    }
  });
}
