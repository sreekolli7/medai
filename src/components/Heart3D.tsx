import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import type { Part } from '../types'

const MODEL_URL = '/models/heart.glb'
const CONTEXT_ONLY = new Set(['inferior-vena-cava'])

export type HeartViewProps = {
  parts: Part[]
  selectedId?: string | null
  feedback?: Record<string, 'correct' | 'wrong'>
  showLabels?: boolean
  onSelect: (id: string) => void
  ariaLabel?: string
}

type Piece = { id: string; geometry: THREE.BufferGeometry; center: THREE.Vector3 }

function readCssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function HeartModel({
  parts,
  selectedId,
  feedback = {},
  onSelect,
  explode,
  hoverId,
  setHoverId,
}: HeartViewProps & {
  explode: number
  hoverId: string | null
  setHoverId: (update: (prev: string | null) => string | null) => void
}) {
  const { nodes } = useGLTF(MODEL_URL) as unknown as { nodes: Record<string, THREE.Object3D> }
  const known = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts])

  const pieces = useMemo<Piece[]>(() => {
    return Object.values(nodes)
      .filter((n): n is THREE.Mesh => (n as THREE.Mesh).isMesh)
      .map((m) => {
        // Meshopt quantization stores the dequantizing transform on the node, so bake it in.
        m.updateWorldMatrix(true, false)
        const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld)
        geometry.computeBoundingBox()
        const center = new THREE.Vector3()
        geometry.boundingBox!.getCenter(center)
        return { id: m.name, geometry, center }
      })
  }, [nodes])

  const colors = {
    poor: readCssColor('--oxy-poor', '#3b73d9'),
    rich: readCssColor('--oxy-rich', '#d63c3c'),
    ok: readCssColor('--ok', '#1a7f37'),
    bad: readCssColor('--bad', '#b42318'),
  }

  const click = (e: ThreeEvent<MouseEvent>, id: string) => {
    e.stopPropagation()
    if (e.delta > 6) return // it was a drag-to-rotate, not a tap
    onSelect(id)
  }

  return (
    <group>
      {pieces.map(({ id, geometry, center }) => {
        const part = known.get(id)
        const context = CONTEXT_ONLY.has(id) || !part
        const offset = center.clone().multiplyScalar(explode * 0.9)
        const fb = feedback[id]
        const base = fb === 'correct' ? colors.ok : fb === 'wrong' ? colors.bad : part?.blood === 'oxygen-rich' ? colors.rich : colors.poor
        const active = !context && (hoverId === id || selectedId === id)
        return (
          <group key={id} position={offset}>
            <mesh
              geometry={geometry}
              onClick={context ? undefined : (e) => click(e, id)}
              onPointerOver={
                context
                  ? undefined
                  : (e) => {
                      e.stopPropagation()
                      setHoverId(() => id)
                      document.body.style.cursor = 'pointer'
                    }
              }
              onPointerOut={
                context
                  ? undefined
                  : () => {
                      setHoverId((h) => (h === id ? null : h))
                      document.body.style.cursor = ''
                    }
              }
            >
              <meshStandardMaterial
                color={base}
                roughness={0.55}
                metalness={0.05}
                side={THREE.DoubleSide}
                transparent={context}
                opacity={context ? 0.35 : 1}
                emissive={active ? base : '#000000'}
                emissiveIntensity={selectedId === id ? 0.45 : hoverId === id ? 0.25 : 0}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export default function Heart3D(props: HeartViewProps) {
  const [explode, setExplode] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const captionId = hoverId ?? props.selectedId ?? Object.keys(props.feedback ?? {})[0] ?? null
  const caption = props.showLabels !== false && captionId ? props.parts.find((p) => p.id === captionId)?.name : null
  const [autoRotate, setAutoRotate] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  return (
    <div className="heart3d">
      <div className="heart3d-canvas" role="img" aria-label={props.ariaLabel ?? '3D heart model. Drag to rotate, tap a part.'}>
        <Canvas key={resetKey} camera={{ position: [0, 0.15, 2.6], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 3, 4]} intensity={1.6} />
          <directionalLight position={[-3, -1, -2]} intensity={0.5} />
          <HeartModel {...props} explode={explode} hoverId={hoverId} setHoverId={setHoverId} />
          <OrbitControls
            enablePan={false}
            minDistance={1.6}
            maxDistance={6}
            autoRotate={autoRotate}
            autoRotateSpeed={1.2}
            makeDefault
          />
        </Canvas>
        {caption && <span className="label-3d caption-3d">{caption}</span>}
      </div>
      <div className="heart3d-controls">
        <label className="slider">
          <span>Pull apart</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
        </label>
        <button type="button" className="secondary small" aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)}>
          {autoRotate ? '⏸ Stop spin' : '⟳ Spin'}
        </button>
        <button type="button" className="secondary small" onClick={() => setResetKey((k) => k + 1)}>
          Reset view
        </button>
      </div>
      <p className="model-credit">
        3D model: BodyParts3D © DBCLS, <a href="/credits">CC BY-SA 2.1 JP</a>. Drag to rotate, scroll or pinch to zoom.
      </p>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
