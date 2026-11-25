// Builds public/models/{brain,eye,torso,skeleton}.glb from BodyParts3D 4.3 meshes (CC BY-SA 2.1 JP, © DBCLS).
// The output models are adaptations and are licensed CC BY-SA 2.1 JP as well.
//
// Usage:
//   node scripts/build-anatomy-models.ts            # all models
//   node scripts/build-anatomy-models.ts brain eye  # some models
//
// Downloads missing meshes into .cache/bp3d/<FJ id>.obj from
// https://github.com/olivercase/body_parts_3d_api (meshes/*.obj, via Git LFS).

import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { meshopt, simplifyPrimitive, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const REPO = 'olivercase/body_parts_3d_api'
const CACHE = '.cache/bp3d'
const META = '.cache/bp3d-meta'

type PartSpec = {
  /** Mesh names (exact, case-insensitive) or regexes over BodyParts3D names. */
  names: (string | RegExp)[]
  /** Keep only meshes on this side of the body midline (x > 0 is the patient's left). */
  side?: 'left' | 'right'
}
type ModelSpec = {
  triangles: number
  /** Parts to center and size the model on; defaults to all of them. */
  frame?: string[]
  parts: Record<string, PartSpec>
}

const ORD = '(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)'
const LR = '(left|right)'
const r = (s: string) => new RegExp(`^${s}$`, 'i')

const HEART = ['FJ3645', 'FJ3413', 'FJ3411', 'FJ2439', 'FJ2438', 'FJ2966', 'FJ2924', 'FJ3019', 'FJ2428', 'FJ3441']

const MODELS: Record<string, ModelSpec> = {
  brain: {
    triangles: 110_000,
    parts: {
      'brain-frontal-lobe': {
        names: [
          r(`${LR} (superior|middle) frontal gyrus`),
          r(`${LR} (anterior|lateral|medial|posterior) orbital gyrus`),
          r(`${LR} straight gyrus`),
          'Right inferior frontal gyrus',
        ],
      },
      'brain-broca-area': { names: ['Left inferior frontal gyrus'] },
      'brain-motor-cortex': { names: [r(`${LR} precentral gyrus`)] },
      'brain-somatosensory-cortex': { names: [r(`${LR} postcentral gyrus`)] },
      'brain-parietal-lobe': {
        names: [r(`${LR} superior parietal lobule`), r(`${LR} (supramarginal|angular) gyrus`), r(`${LR} precuneus`)],
      },
      'brain-temporal-lobe': { names: [r(`${LR} (superior|middle|inferior) temporal gyrus`), r(`${LR} fusiform gyrus`)] },
      'brain-occipital-lobe': {
        names: [r(`${LR} (lateral|superior) occipital gyrus`), r(`${LR} cuneus`), r(`${LR} lingual gyrus`)],
      },
      'brain-limbic-cortex': { names: [r(`${LR} (cingulate|parahippocampal) gyrus`)] },
      'brain-insula': { names: [r(`${LR} insula`)] },
      'brain-corpus-callosum': { names: ['Corpus callosum'] },
      'brain-thalamus': { names: [r(`${LR} thalamus`)] },
      'brain-hypothalamus': { names: ['Hypothalamus'] },
      'brain-pituitary': { names: ['Pituitary gland'] },
      'brain-pineal': { names: ['Pineal body'] },
      'brain-hippocampus': { names: [r(`${LR} hippocampus proper`)] },
      'brain-amygdala': { names: [r(`${LR} amygdala`)] },
      'brain-basal-ganglia': { names: [r(`${LR} (caudate nucleus|putamen|globus pallidus)`)] },
      'brain-midbrain': {
        names: [r(`${LR} cerebral crus`), r(`${LR} (superior|inferior) colliculus`), r(`${LR} (red nucleus|substantia nigra)`)],
      },
      'brain-pons': { names: ['Pons'] },
      'brain-medulla': { names: ['Medulla oblongata'] },
      'brain-cerebellum': { names: ['Cerebellum'] },
      'brain-ventricles': { names: [r(`${LR} lateral ventricle`), 'Third ventricle', 'Fourth ventricle'] },
    },
  },
  eye: {
    triangles: 90_000,
    frame: ['eye-vitreous', 'eye-cornea'],
    parts: {
      'eye-cornea': { names: ['Right cornea'], side: 'right' },
      'eye-anterior-chamber': { names: ['Anterior chamber of right eyeball'] },
      'eye-iris': { names: ['Right iris'] },
      'eye-lens': { names: ['Right lens'] },
      'eye-zonule': { names: ['Suspensory ligament of right lens'] },
      'eye-vitreous': { names: ['Right vitreous body'] },
      'eye-sclera': { names: ['Right sclera'] },
      'eye-choroid': { names: ['Right choroid'], side: 'right' },
      'eye-retina': { names: ['Optic part of right retina'] },
      'eye-optic-nerve': { names: ['Right optic nerve'] },
      'eye-ophthalmic-artery': { names: ['Right ophthalmic artery', 'Trunk of right ophthalmic artery'], side: 'right' },
      'eye-central-retinal-artery': { names: ['Right central retinal artery'], side: 'right' },
      'eye-ciliary-artery': { names: ['Right long posterior ciliary artery'], side: 'right' },
      'eye-lacrimal-artery': { names: ['Right lacrimal artery'], side: 'right' },
      'eye-central-retinal-vein': { names: ['Right central retinal vein'], side: 'right' },
      'eye-ophthalmic-veins': { names: ['Right superior ophthalmic vein', 'Right inferior ophthalmic vein'], side: 'right' },
    },
  },
  torso: {
    triangles: 110_000,
    parts: {
      'torso-trachea': { names: ['Trachea'] },
      'torso-bronchi': { names: [/bronchial tree$/i] },
      'torso-right-lung': { names: [/^parenchyma of .*bronchopulmonary segment$/i], side: 'right' },
      'torso-left-lung': { names: [/^parenchyma of .*bronchopulmonary segment$/i], side: 'left' },
      'torso-diaphragm': { names: ['Diaphragm'] },
      'torso-heart': { names: HEART.map((id) => `#${id}`) },
      'torso-thyroid': { names: [r(`${LR} lobe of thyroid gland`)] },
      'torso-thymus': { names: [r(`${LR} lobe of thymus`)] },
      'torso-esophagus': { names: ['Esophagus'] },
      'torso-stomach': { names: ['Stomach'] },
      'torso-liver': { names: [/^hepatovenous segment [ivx]+$/i, 'Caudate lobe of liver'] },
      'torso-gallbladder': { names: ['Gallbladder'] },
      'torso-pancreas': { names: ['Parenchyma of pancreas'] },
      'torso-spleen': { names: ['Spleen'] },
      'torso-duodenum': { names: ['Duodenum'] },
      'torso-small-intestine': { names: [/^(proximal|middle|distal) part of (jejunum|ileum)$/i] },
      'torso-large-intestine': { names: [/^(ascending|transverse|descending) colon$/i] },
      'torso-appendix': { names: ['Appendix'] },
      'torso-rectum': { names: ['Rectum'] },
      'torso-adrenal-glands': { names: [r(`${LR} adrenal gland`)] },
      'torso-kidneys': { names: [r(`${LR} kidney`)] },
      'torso-ureters': { names: [r(`${LR} ureter`)] },
      'torso-bladder': { names: ['Urinary bladder'] },
      'torso-prostate': { names: ['Prostate', r(`${LR} seminal vesicle`)] },
      'torso-testes': { names: [r(`${LR} testis`), r(`${LR} epididymis`)] },
    },
  },
  skeleton: {
    triangles: 110_000,
    parts: {
      'skeleton-skull': {
        names: [
          'Frontal bone',
          'Occipital bone',
          'Sphenoid bone',
          'Ethmoid',
          'Vomer',
          r(`${LR} (parietal|temporal|nasal|zygomatic|lacrimal|palatine) bone`),
          r(`${LR} maxilla`),
        ],
      },
      'skeleton-mandible': { names: ['Mandible'] },
      'skeleton-spine': {
        names: ['Atlas', 'Axis', r(`${ORD} (cervical|thoracic|lumbar) vertebra`), 'Sacrum', /^intervertebral disk of /i],
      },
      'skeleton-ribs': { names: [r(`${LR} ${ORD} rib`), r(`${LR} ${ORD} costal cartilage`)] },
      'skeleton-sternum': { names: ['Manubrium', 'Body of sternum', 'Xiphoid process'] },
      'skeleton-clavicle': { names: [r(`${LR} clavicle`)] },
      'skeleton-scapula': { names: [r(`${LR} scapula`)] },
      'skeleton-humerus': { names: [r(`${LR} humerus`)] },
      'skeleton-radius-ulna': { names: [r(`${LR} (radius|ulna)`)] },
      'skeleton-hand': {
        names: [
          r(`${LR} (scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)`),
          r(`${LR} (first|second|third|fourth|fifth) metacarpal bone`),
          /^(proximal|middle|distal) phalanx of (left|right) (thumb|index finger|middle finger|ring finger|little finger)$/i,
        ],
      },
      'skeleton-pelvis': { names: [r(`${LR} hip bone`)] },
      'skeleton-femur': { names: [r(`${LR} femur`)] },
      'skeleton-patella': { names: [r(`${LR} patella`)] },
      'skeleton-tibia-fibula': { names: [r(`${LR} (tibia|fibula)`)] },
      'skeleton-foot': {
        names: [
          r(`${LR} (talus|calcaneus|cuboid bone)`),
          /^navicular bone of (left|right) foot$/i,
          r(`${LR} (medial|intermediate|lateral) cuneiform bone`),
          r(`${LR} (first|second|third|fourth|fifth) metatarsal bone`),
          /^(proximal|middle|distal) phalanx of (left|right) (big|second|third|fourth|little) toe$/i,
        ],
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Mesh catalog

type Row = { fj: string; name: string; path: string }

function catalog(): Row[] {
  const tree = JSON.parse(readFileSync('.cache/bp3d-tree.json', 'utf8')) as { tree: { path: string }[] }
  const paths = new Map<string, string>()
  for (const { path } of tree.tree) {
    const m = path.match(/^meshes\/(FJ\d+M?)_/)
    if (m) paths.set(m[1], path)
  }
  const rows: Row[] = []
  const csv = readFileSync(`${META}/MANIFEST.csv`, 'utf8').trim().split('\n').slice(1)
  for (const line of csv) {
    const m = line.match(/^(FJ\d+M?),[^,]*,[^,]*,(?:"([^"]*)"|([^,]*)),/)
    if (!m) continue
    const path = paths.get(m[1])
    if (path) rows.push({ fj: m[1], name: m[2] ?? m[3], path })
  }
  return rows
}

function select(rows: Row[], spec: PartSpec) {
  const out = new Map<string, Row>()
  for (const pattern of spec.names) {
    const hits =
      typeof pattern === 'string' && pattern.startsWith('#')
        ? rows.filter((row) => row.fj === pattern.slice(1))
        : rows.filter((row) =>
            typeof pattern === 'string' ? row.name.toLowerCase() === pattern.toLowerCase() : pattern.test(row.name),
          )
    if (hits.length === 0) throw new Error(`No mesh matches ${pattern}`)
    for (const h of hits) out.set(h.fj, h)
  }
  return [...out.values()]
}

async function download(row: Row) {
  const file = `${CACHE}/${row.fj}.obj`
  if (existsSync(file)) return
  const url = `https://media.githubusercontent.com/media/${REPO}/main/${row.path.split('/').map(encodeURIComponent).join('/')}`
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url)
    if (res.ok) {
      const text = await res.text()
      if (!text.includes('\nv ')) throw new Error(`${row.fj}: not an OBJ (${text.slice(0, 60)})`)
      writeFileSync(file, text)
      return
    }
    if (attempt >= 4) throw new Error(`${row.fj}: HTTP ${res.status}`)
    await new Promise((ok) => setTimeout(ok, 1000 * attempt))
  }
}

// ---------------------------------------------------------------------------
// Geometry

type Mesh = { positions: number[]; indices: number[] }

function parseObj(fj: string): Mesh {
  const positions: number[] = []
  const indices: number[] = []
  for (const line of readFileSync(`${CACHE}/${fj}.obj`, 'utf8').split('\n')) {
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

function bounds(m: Mesh) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const v of m.indices)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], m.positions[v * 3 + k])
      max[k] = Math.max(max[k], m.positions[v * 3 + k])
    }
  return { min, max }
}

/** Some structures are listed twice with near-identical meshes; drawing both causes flicker. */
function sameShape(a: Mesh, b: Mesh) {
  const ba = bounds(a)
  const bb = bounds(b)
  return [0, 1, 2].every((k) => Math.abs(ba.min[k] - bb.min[k]) < 1.5 && Math.abs(ba.max[k] - bb.max[k]) < 1.5)
}

function merge(meshes: Mesh[]): Mesh {
  const out: Mesh = { positions: [], indices: [] }
  for (const m of meshes) {
    const offset = out.positions.length / 3
    for (const p of m.positions) out.positions.push(p)
    for (const i of m.indices) out.indices.push(i + offset)
  }
  return out
}

function normals(positions: Float32Array, indices: Uint32Array) {
  const n = new Float32Array(positions.length)
  const p = positions
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3]
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

const MIN_TRIANGLES = 2500

async function build(modelId: string, spec: ModelSpec, rows: Row[]) {
  const picked = Object.fromEntries(Object.entries(spec.parts).map(([id, p]) => [id, select(rows, p)]))
  const all = [...new Map(Object.values(picked).flat().map((row) => [row.fj, row])).values()]
  let done = 0
  for (let i = 0; i < all.length; i += 6) {
    await Promise.all(all.slice(i, i + 6).map(download))
    done = Math.min(all.length, i + 6)
    process.stdout.write(`\r${modelId}: downloaded ${done}/${all.length} meshes`)
  }
  console.log()

  const parts: Record<string, Mesh> = {}
  for (const [id, partRows] of Object.entries(picked)) {
    const kept: Mesh[] = []
    for (const row of partRows) {
      const m = parseObj(row.fj)
      if (spec.parts[id].side) {
        const { min, max } = bounds(m)
        const x = (min[0] + max[0]) / 2
        if ((spec.parts[id].side === 'left') !== x > 0) continue
        // A few source meshes carry stray vertices on the far side of the body, which wreck the bounds.
        const wrongSide = (v: number) => (spec.parts[id].side === 'left') !== m.positions[v * 3] > 0
        const indices: number[] = []
        for (let t = 0; t < m.indices.length; t += 3) {
          const tri = m.indices.slice(t, t + 3)
          if (!tri.some(wrongSide)) indices.push(...tri)
        }
        // Drop the now-unused vertices too; they would still stretch the quantization range.
        const remap = new Map<number, number>()
        const positions: number[] = []
        m.indices = indices.map((v) => {
          let n = remap.get(v)
          if (n === undefined) {
            n = remap.size
            remap.set(v, n)
            positions.push(m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2])
          }
          return n
        })
        m.positions = positions
      }
      if (!kept.some((k) => sameShape(k, m))) kept.push(m)
    }
    if (kept.length === 0) throw new Error(`${id}: no meshes left`)
    parts[id] = merge(kept)
  }

  // BodyParts3D axes: +X = patient's left, −Y = anterior, +Z = superior.
  // Viewer axes: +x = viewer's right (patient's left, as in an anterior view), +y = up, +z = toward the viewer.
  const { min, max } = bounds(merge(spec.frame ? spec.frame.map((id) => parts[id]) : Object.values(parts)))
  const center = min.map((v, k) => (v + max[k]) / 2)
  const scale = 2 / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])

  const doc = new Document()
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
  const buffer = doc.createBuffer()
  const scene = doc.createScene(modelId)
  let before = 0
  for (const [id, m] of Object.entries(parts)) {
    const pos = new Float32Array(m.positions.length)
    for (let i = 0; i < m.positions.length; i += 3) {
      pos[i] = (m.positions[i] - center[0]) * scale
      pos[i + 1] = (m.positions[i + 2] - center[2]) * scale
      pos[i + 2] = -(m.positions[i + 1] - center[1]) * scale
    }
    const idx = Uint32Array.from(m.indices)
    before += idx.length / 3
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(pos, idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)))
  }

  await MeshoptEncoder.ready
  await MeshoptSimplifier.ready
  // A single global ratio flattens small organs into blobs, so every part keeps at least
  // MIN_TRIANGLES and the rest of the budget is shared in proportion to source detail.
  const ratio = Math.min(1, spec.triangles / before)
  const source = new Map<string, number>()
  await doc.transform(weld())
  for (const mesh of doc.getRoot().listMeshes()) {
    const prim = mesh.listPrimitives()[0]
    const n = (prim.getIndices()?.getCount() ?? 0) / 3
    source.set(mesh.getName(), n)
    const partRatio = Math.min(1, Math.max(ratio, MIN_TRIANGLES / n))
    if (partRatio < 1) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: partRatio, error: 0.01, lockBorder: false })
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  let after = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    const n = (mesh.listPrimitives()[0].getIndices()?.getCount() ?? 0) / 3
    after += n
    console.log(`  ${mesh.getName().padEnd(28)} ${source.get(mesh.getName())!.toLocaleString().padStart(7)} → ${n.toLocaleString()} triangles`)
  }
  const glb = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
    .writeBinary(doc)
  writeFileSync(`public/models/${modelId}.glb`, glb)
  console.log(
    `Wrote public/models/${modelId}.glb: ${before.toLocaleString()} → ${after.toLocaleString()} triangles, ${(glb.byteLength / 1024).toFixed(0)} KB`,
  )
}

mkdirSync(CACHE, { recursive: true })
mkdirSync('public/models', { recursive: true })
const rows = catalog()
const wanted = process.argv.slice(2)
for (const [id, spec] of Object.entries(MODELS)) {
  if (wanted.length && !wanted.includes(id)) continue
  await build(id, spec, rows)
}
