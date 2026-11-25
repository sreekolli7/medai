// Builds public/models/heart.glb from BodyParts3D 4.3 meshes (CC BY-SA 2.1 JP, © DBCLS).
// The output model is an adaptation and is licensed CC BY-SA 2.1 JP as well.
//
// Usage:
//   node scripts/build-heart-model.ts           # expects .cache/bp3d/<FJ id>.obj
//
// Source meshes: https://github.com/olivercase/body_parts_3d_api (meshes/*.obj, via Git LFS)

import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import { meshopt, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SRC = '.cache/bp3d'
const OUT = 'public/models/heart.glb'

// Part id (matches public.parts.id) -> BodyParts3D FJ mesh ids.
const PARTS: Record<string, string[]> = {
  'superior-vena-cava': ['FJ3645'],
  aorta: ['FJ3413', 'FJ3411'],
  'right-atrium': ['FJ2439'],
  'left-atrium': ['FJ2438'],
  'pulmonary-artery': ['FJ2966', 'FJ2924', 'FJ3019'],
  'pulmonary-veins': ['FJ2925', 'FJ2933', 'FJ2944', 'FJ2950', 'FJ2955', 'FJ3020', 'FJ3040'],
  // Context only (not a study part yet).
  'inferior-vena-cava': ['FJ3441'],
}
// BodyParts3D models both ventricles as one wall; split it by the nearest ventricular cavity.
const VENTRICLE_WALL = 'FJ2428'
const LV_CAVITY = 'FJ2422'
const RV_CAVITY = 'FJ2423'

type Mesh = { positions: number[]; indices: number[] }

function parseObj(id: string): Mesh {
  const positions: number[] = []
  const indices: number[] = []
  for (const line of readFileSync(`${SRC}/${id}.obj`, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/)
      positions.push(Number(x), Number(y), Number(z))
    } else if (line.startsWith('f ')) {
      const vs = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => Number(t.split('/')[0]) - 1)
      for (let i = 1; i + 1 < vs.length; i++) indices.push(vs[0], vs[i], vs[i + 1])
    }
  }
  return { positions, indices }
}

function merge(meshes: Mesh[]): Mesh {
  const out: Mesh = { positions: [], indices: [] }
  for (const m of meshes) {
    const offset = out.positions.length / 3
    out.positions.push(...m.positions)
    for (const i of m.indices) out.indices.push(i + offset)
  }
  return out
}

function centroid(m: Mesh) {
  const c = [0, 0, 0]
  const n = m.positions.length / 3
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) c[k] += m.positions[i * 3 + k] / n
  return c
}

function splitVentricles(wall: Mesh, lv: Mesh, rv: Mesh) {
  const nearest = (cav: Mesh, x: number, y: number, z: number) => {
    let best = Infinity
    for (let i = 0; i < cav.positions.length; i += 3) {
      const dx = cav.positions[i] - x
      const dy = cav.positions[i + 1] - y
      const dz = cav.positions[i + 2] - z
      const d = dx * dx + dy * dy + dz * dz
      if (d < best) best = d
    }
    return best
  }
  const left: number[] = []
  const right: number[] = []
  const p = wall.positions
  for (let t = 0; t < wall.indices.length; t += 3) {
    const [a, b, c] = [wall.indices[t], wall.indices[t + 1], wall.indices[t + 2]]
    const x = (p[a * 3] + p[b * 3] + p[c * 3]) / 3
    const y = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3
    const z = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3
    ;(nearest(lv, x, y, z) <= nearest(rv, x, y, z) ? left : right).push(a, b, c)
  }
  return {
    'left-ventricle': { positions: wall.positions, indices: left },
    'right-ventricle': { positions: wall.positions, indices: right },
  }
}

function compact(m: Mesh): Mesh {
  const remap = new Map<number, number>()
  const positions: number[] = []
  const indices = m.indices.map((i) => {
    let j = remap.get(i)
    if (j === undefined) {
      j = positions.length / 3
      remap.set(i, j)
      positions.push(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2])
    }
    return j
  })
  return { positions, indices }
}

function normals(m: Mesh) {
  const n = new Float32Array(m.positions.length)
  const p = m.positions
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3]
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
    const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]]
    const cx = e1[1] * e2[2] - e1[2] * e2[1]
    const cy = e1[2] * e2[0] - e1[0] * e2[2]
    const cz = e1[0] * e2[1] - e1[1] * e2[0]
    for (const v of [a, b, c]) {
      n[v] += cx
      n[v + 1] += cy
      n[v + 2] += cz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= len
    n[i + 1] /= len
    n[i + 2] /= len
  }
  return n
}

// ---------------------------------------------------------------------------

const parts: Record<string, Mesh> = {}
for (const [id, fjs] of Object.entries(PARTS)) parts[id] = merge(fjs.map(parseObj))
const lvCavity = parseObj(LV_CAVITY)
const rvCavity = parseObj(RV_CAVITY)
Object.assign(parts, splitVentricles(parseObj(VENTRICLE_WALL), lvCavity, rvCavity))
for (const id of Object.keys(parts)) parts[id] = compact(parts[id])

// Orient: up = BodyParts3D Z (superior). Front = toward the right ventricle (most anterior chamber).
// Viewer's right = patient's left (left ventricle side), as in a standard anterior view.
const lv = centroid(parts['left-ventricle'])
const ra = centroid(parts['right-atrium'])
const rvc = centroid(rvCavity)
const lac = centroid(parts['left-atrium'])
const sx = lv[0] > ra[0] ? 1 : -1
const sy = rvc[1] > lac[1] ? 1 : -1
const flip = -sx * sy < 0 // mirrored transform -> reverse winding

const all = Object.values(parts).flatMap((m) => m.positions)
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < all.length; i += 3)
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], all[i + k])
    max[k] = Math.max(max[k], all[i + k])
  }
const center = min.map((v, k) => (v + max[k]) / 2)
const scale = 2 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])

const doc = new Document()
doc.createExtension(EXTMeshoptCompression).setRequired(true)
const buffer = doc.createBuffer()
const scene = doc.createScene('heart')

for (const [id, m] of Object.entries(parts)) {
  const pos = new Float32Array(m.positions.length)
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = (m.positions[i] - center[0]) * scale
    const y = (m.positions[i + 1] - center[1]) * scale
    const z = (m.positions[i + 2] - center[2]) * scale
    pos[i] = sx * x
    pos[i + 1] = z
    pos[i + 2] = sy * y
  }
  const idx = Uint32Array.from(m.indices)
  if (flip) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]]
  const mesh = { positions: Array.from(pos), indices: Array.from(idx) }

  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(mesh)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
  scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)))
  console.log(`${id.padEnd(20)} ${(idx.length / 3).toLocaleString()} triangles`)
}

await MeshoptEncoder.ready
await doc.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
mkdirSync('public/models', { recursive: true })
const glb = await new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(doc)
writeFileSync(OUT, glb)
console.log(`Wrote ${OUT} (${(glb.byteLength / 1024).toFixed(0)} KB)`)
