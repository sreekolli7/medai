import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { modelById, modelUrl } from '../lib/anatomy'
import type { Part } from '../types'

export type OrganViewProps = {
  model: string
  parts: Part[]
  selectedId?: string | null
  feedback?: Record<string, 'correct' | 'wrong'>
  showLabels?: boolean
  /** Fade everything except the selected part. */
  focus?: boolean
  compact?: boolean
  onSelect?: (id: string) => void
  ariaLabel?: string
}

type Piece = { id: string; geometry: THREE.BufferGeometry; center: THREE.Vector3 }

const noRaycast = () => {}

/** Meshopt stores positions as normalized 16-bit ints, which clamp to ±1 if transformed in place. */
function toFloat(geometry: THREE.BufferGeometry) {
  for (const name of ['position', 'normal']) {
    const attr = geometry.getAttribute(name) as THREE.BufferAttribute | undefined
    if (!attr || attr.array instanceof Float32Array) continue
    const out = new Float32Array(attr.count * 3)
    for (let i = 0; i < attr.count; i++) {
      out[i * 3] = attr.getX(i)
      out[i * 3 + 1] = attr.getY(i)
      out[i * 3 + 2] = attr.getZ(i)
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, 3))
  }
  return geometry
}

function cssColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Brown iris with radial fibers and a dark rim, so the scan reads as a human eye. */
function makeIrisTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  const c = size / 2
  const base = g.createRadialGradient(c, c, 28, c, c, c)
  base.addColorStop(0, '#140c08')
  base.addColorStop(0.16, '#3a2414')
  base.addColorStop(0.34, '#8d5a30')
  base.addColorStop(0.62, '#6b4224')
  base.addColorStop(0.84, '#4a2c16')
  base.addColorStop(1, '#24140c')
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2 + (i % 5) * 0.01
    const inner = 36 + (i % 7) * 6
    g.strokeStyle = `rgba(${90 + (i % 50)}, ${48 + (i % 30)}, 18, ${0.18 + (i % 4) * 0.08})`
    g.lineWidth = i % 9 === 0 ? 2.2 : 0.8
    g.beginPath()
    g.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner)
    g.lineTo(c + Math.cos(a) * (c - 8), c + Math.sin(a) * (c - 8))
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Branching vessels across the white of the eye, the way conjunctival vessels look. */
function makeScleraTexture() {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext('2d')!
  const rand = mulberry32(0x0e1e5c1e)
  const c = size / 2
  const limb = size * 0.09
  const edge = size * 0.4
  g.fillStyle = '#f7f4ef'
  g.fillRect(0, 0, size, size)

  const tint = () => {
    const vein = rand() < 0.25
    const red = vein ? 120 + rand() * 50 : 160 + rand() * 70
    const green = vein ? 40 + rand() * 35 : 24 + rand() * 30
    const blue = vein ? 60 + rand() * 40 : 28 + rand() * 24
    return `rgba(${red | 0},${green | 0},${blue | 0},${(0.45 + rand() * 0.5).toFixed(2)})`
  }

  const vessel = (ang: number, r0: number, r1: number, width: number, wobble: number) => {
    g.strokeStyle = tint()
    g.lineWidth = width
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    let a = ang
    const steps = 28
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      a += (rand() - 0.5) * wobble
      const r = r0 + (r1 - r0) * t
      const x = c + Math.cos(a) * r
      const y = c + Math.sin(a) * r
      if (s === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
    return a
  }

  for (let i = 0; i < 220; i++) {
    const ang = rand() * Math.PI * 2
    vessel(ang, edge * (0.45 + rand() * 0.55), limb + rand() * size * 0.03, 0.5 + rand() * 1.15, 0.2)
  }
  for (let i = 0; i < 54; i++) {
    let ang = rand() * Math.PI * 2
    let r = edge * (0.7 + rand() * 0.3)
    const end = limb + rand() * size * 0.025
    let width = 2.4 + rand() * 2.4
    for (let branch = 0; branch < 3; branch++) {
      const next = Math.max(end, r + (end - r) * (0.28 + rand() * 0.3))
      ang = vessel(ang, r, next, width, 0.26)
      vessel(ang + (rand() - 0.5) * 0.9, r, Math.max(limb, r - size * (0.035 + rand() * 0.05)), width * 0.55, 0.34)
      r = next
      width *= 0.6
    }
  }
  for (let i = 0; i < 100; i++) {
    const a = rand() * Math.PI * 2
    g.strokeStyle = tint()
    g.lineWidth = 0.6 + rand() * 0.9
    g.beginPath()
    g.arc(c, c, limb + rand() * size * 0.03, a, a + 0.12 + rand() * 0.5)
    g.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function Model({
  model,
  parts,
  selectedId,
  feedback = {},
  onSelect,
  explode,
  seeInside,
  focus,
  hoverId,
  setHoverId,
}: OrganViewProps & {
  explode: number
  seeInside: boolean
  hoverId: string | null
  setHoverId: (update: (prev: string | null) => string | null) => void
}) {
  const { nodes } = useGLTF(modelUrl(model)) as unknown as { nodes: Record<string, THREE.Object3D> }
  const info = modelById(model)
  const known = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts])
  const outer = useMemo(() => new Set(info?.outer), [info])
  const clear = useMemo(() => new Set(info?.clear), [info])
  const internal = useMemo(() => new Set(info?.internal), [info])
  const irisMap = useMemo(() => (model === 'eye' ? makeIrisTexture() : null), [model])
  const scleraMap = useMemo(() => (model === 'eye' ? makeScleraTexture() : null), [model])

  const pieces = useMemo<Piece[]>(
    () =>
      Object.values(nodes)
        .filter((n): n is THREE.Mesh => (n as THREE.Mesh).isMesh)
        .map((m) => {
          // Meshopt quantization stores the dequantizing transform on the node, so bake it in.
          m.updateWorldMatrix(true, false)
          const geometry = toFloat(m.geometry.clone()).applyMatrix4(m.matrixWorld)
          if (m.name === 'eye-iris') {
            const pos = geometry.getAttribute('position')
            const uv = new Float32Array(pos.count * 2)
            const span = 0.62
            for (let i = 0; i < pos.count; i++) {
              uv[i * 2] = pos.getX(i) / (2 * span) + 0.5
              uv[i * 2 + 1] = pos.getY(i) / (2 * span) + 0.5
            }
            geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
          }
          if (m.name === 'eye-sclera') {
            geometry.computeBoundingBox()
            const box = geometry.boundingBox!
            const cx = (box.min.x + box.max.x) / 2
            const cy = (box.min.y + box.max.y) / 2
            const cz = (box.min.z + box.max.z) / 2
            const pos = geometry.getAttribute('position')
            const uv = new Float32Array(pos.count * 2)
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i) - cx
              const y = pos.getY(i) - cy
              const z = pos.getZ(i) - cz
              const around = Math.atan2(y, x)
              const polar = Math.atan2(Math.hypot(x, y), z) / Math.PI
              uv[i * 2] = Math.cos(around) * polar * 0.5 + 0.5
              uv[i * 2 + 1] = Math.sin(around) * polar * 0.5 + 0.5
            }
            geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
          }
          geometry.computeBoundingBox()
          const center = new THREE.Vector3()
          geometry.boundingBox!.getCenter(center)
          return { id: m.name, geometry, center }
        }),
    [nodes],
  )

  const colors = {
    poor: cssColor('--oxy-poor', '#3b73d9'),
    rich: cssColor('--oxy-rich', '#d63c3c'),
    ok: cssColor('--ok', '#1a7f37'),
    bad: cssColor('--bad', '#b42318'),
  }

  const click = (e: ThreeEvent<MouseEvent>, id: string) => {
    e.stopPropagation()
    if (e.delta > 6) return // it was a drag-to-rotate, not a tap
    onSelect?.(id)
  }

  return (
    <group>
      {pieces.map(({ id, geometry, center }) => {
        const part = known.get(id)
        const fb = feedback[id]
        const base =
          fb === 'correct'
            ? colors.ok
            : fb === 'wrong'
              ? colors.bad
              : part?.blood === 'oxygen-rich'
                ? colors.rich
                : part?.blood === 'oxygen-poor'
                  ? colors.poor
                  : (info?.colors?.[id] ?? '#cfb59a')
        const highlighted = selectedId === id || !!fb
        const concealed = internal.has(id) && !seeInside && !highlighted
        const ghost = !!part && seeInside && outer.has(id) && !highlighted
        const faded = focus && !!selectedId && !highlighted
        const opacity = concealed ? 0 : !part ? 0.25 : ghost ? 0.07 : faded ? 0.06 : clear.has(id) && !highlighted ? (info?.clearOpacity ?? 0.35) : 1
        const clickable = !!part && !!onSelect && opacity > 0.2
        return (
          <group key={id} position={center.clone().multiplyScalar(explode * 0.9)}>
            <mesh
              geometry={geometry}
              raycast={clickable ? undefined : noRaycast}
              renderOrder={model === 'eye' && id === 'eye-cornea' ? 3 : opacity < 1 ? 1 : 0}
              onClick={clickable ? (e) => click(e, id) : undefined}
              onPointerOver={
                clickable
                  ? (e) => {
                      e.stopPropagation()
                      setHoverId(() => id)
                      document.body.style.cursor = 'pointer'
                    }
                  : undefined
              }
              onPointerOut={
                clickable
                  ? () => {
                      setHoverId((h) => (h === id ? null : h))
                      document.body.style.cursor = ''
                    }
                  : undefined
              }
            >
              {model === 'eye' && id === 'eye-cornea' && !faded && !concealed ? (
                <meshPhysicalMaterial
                  color={highlighted ? base : '#f7fbff'}
                  roughness={0.08}
                  clearcoat={1}
                  clearcoatRoughness={0.06}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={highlighted ? 0.55 : 0.14}
                  depthWrite={false}
                />
              ) : model === 'eye' && id === 'eye-iris' && irisMap && !faded && !concealed && !fb ? (
                <meshStandardMaterial
                  map={irisMap}
                  color="#ffffff"
                  roughness={0.55}
                  metalness={0}
                  side={THREE.DoubleSide}
                  emissive="#c4a574"
                  emissiveIntensity={highlighted ? 0.35 : hoverId === id ? 0.15 : 0}
                />
              ) : model === 'eye' && id === 'eye-sclera' && scleraMap && !faded && !ghost && !concealed && !fb ? (
                <meshStandardMaterial
                  map={scleraMap}
                  color="#ffffff"
                  roughness={0.78}
                  metalness={0}
                  side={THREE.DoubleSide}
                  emissive="#a32020"
                  emissiveIntensity={highlighted ? 0.2 : hoverId === id ? 0.08 : 0}
                />
              ) : (
                <meshStandardMaterial
                  color={faded || ghost || concealed ? '#b9b4c4' : base}
                  roughness={model === 'eye' && id === 'eye-sclera' ? 0.9 : 0.55}
                  metalness={0.02}
                  side={THREE.DoubleSide}
                  transparent={opacity < 1}
                  opacity={opacity}
                  depthWrite={opacity === 1}
                  emissive={highlighted || hoverId === id ? base : '#000000'}
                  emissiveIntensity={highlighted ? 0.45 : hoverId === id ? 0.25 : 0}
                />
              )}
            </mesh>
            {model === 'eye' && id === 'eye-iris' && !seeInside && (
              <mesh
                position={[-0.05, -0.02, 0.78]}
                renderOrder={1}
                raycast={clickable ? undefined : noRaycast}
                onClick={clickable ? (e) => click(e, 'eye-iris') : undefined}
              >
                <circleGeometry args={[0.22, 64]} />
                <meshBasicMaterial
                  color="#000000"
                  toneMapped={false}
                  side={THREE.DoubleSide}
                  transparent={faded}
                  opacity={faded ? 0.06 : 1}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

export default function Organ3D(props: OrganViewProps) {
  const info = modelById(props.model)
  const [explode, setExplode] = useState(0)
  const [seeInside, setSeeInside] = useState(false)
  const [focus, setFocus] = useState(props.focus ?? false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const captionId = hoverId ?? props.selectedId ?? Object.keys(props.feedback ?? {})[0] ?? null
  const caption = props.showLabels !== false && captionId ? props.parts.find((p) => p.id === captionId)?.name : null
  const camera = info?.camera ?? [0, 0, 2.6]
  const distance = Math.hypot(...camera)

  return (
    <div className={`heart3d organ3d${props.model === 'eye' ? ' eye-stage' : ''}${props.compact ? ' compact' : ''}`}>
      <div className="heart3d-canvas" role="img" aria-label={props.ariaLabel ?? `3D ${info?.title ?? 'anatomy'} model. Drag to rotate, tap a part.`}>
        <Canvas key={resetKey} camera={{ position: camera, fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={props.model === 'eye' ? 0.7 : 0.6} />
          <directionalLight position={[2, 3, 4]} intensity={1.5} />
          <directionalLight position={[-3, -1, -2]} intensity={0.6} />
          {props.model === 'eye' && <pointLight position={[0.7, 0.9, 2.4]} intensity={1.2} distance={6} decay={2} />}
          <Model
            {...props}
            explode={explode}
            seeInside={seeInside}
            focus={focus}
            hoverId={hoverId}
            setHoverId={setHoverId}
          />
          <OrbitControls
            enablePan={false}
            minDistance={distance * 0.45}
            maxDistance={distance * 2.2}
            autoRotate={autoRotate}
            autoRotateSpeed={1.2}
            makeDefault
          />
        </Canvas>
        {caption && <span className="label-3d caption-3d">{caption}</span>}
      </div>
      <div className="heart3d-controls">
        {!props.compact && (
          <label className="slider">
            <span>Pull apart</span>
            <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
          </label>
        )}
        {info?.outer && (
          <button type="button" className="secondary small" aria-pressed={seeInside} onClick={() => setSeeInside(!seeInside)}>
            {seeInside ? '🙈 Show outside' : '🔍 See inside'}
          </button>
        )}
        {props.selectedId && (
          <button type="button" className="secondary small" aria-pressed={focus} onClick={() => setFocus(!focus)}>
            {focus ? 'Show everything' : '🎯 Focus'}
          </button>
        )}
        <button type="button" className="secondary small" aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)}>
          {autoRotate ? '⏸ Stop spin' : '⟳ Spin'}
        </button>
        <button type="button" className="secondary small" onClick={() => setResetKey((k) => k + 1)}>
          Reset view
        </button>
      </div>
      <p className="model-credit">
        {props.model === 'eye' && (
          <>
            The red lines on the white of the eye are its surface blood vessels. <strong>See inside</strong> shows the arteries and veins that supply the retina.{' '}
          </>
        )}
        3D model: BodyParts3D © DBCLS, <a href="/credits">CC BY-SA 2.1 JP</a>. Drag to rotate, scroll or pinch to zoom.
      </p>
    </div>
  )
}
