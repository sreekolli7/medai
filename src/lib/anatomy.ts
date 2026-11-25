import { useEffect, useState } from 'react'
import type { Part } from '../types'
import { supabase } from './supabase'

export const PART_COLUMNS =
  'id, model, topic_id, name, side, blood, sort_order, explanation, exam_pearl, audio_url, reviewed, reviewed_at'

export type ModelInfo = {
  id: string
  title: string
  icon: string
  blurb: string
  /** Topics whose questions this model helps with. */
  topics: string[]
  camera: [number, number, number]
  /** Parts that hide what's underneath; "See inside" fades them. */
  outer?: string[]
  /** Fluids and clear tissue, drawn see-through. */
  clear?: string[]
  clearOpacity?: number
  /** Hidden in the exterior view. "See inside" reveals them. */
  internal?: string[]
  colors?: Record<string, string>
}

export const MODELS: ModelInfo[] = [
  {
    id: 'heart',
    title: 'Heart',
    icon: '🫀',
    blurb: 'Chambers, valves and great vessels',
    topics: ['heart'],
    camera: [0, 0.15, 2.6],
  },
  {
    id: 'brain',
    title: 'Brain',
    icon: '🧠',
    blurb: 'Lobes, deep structures and brainstem',
    topics: [
      'nervous-endocrine',
      'learning-memory',
      'consciousness-sleep',
      'cognition-language',
      'emotion-motivation-stress',
    ],
    camera: [2.7, 0.5, 1.6],
    outer: [
      'brain-frontal-lobe',
      'brain-broca-area',
      'brain-motor-cortex',
      'brain-somatosensory-cortex',
      'brain-parietal-lobe',
      'brain-temporal-lobe',
      'brain-occipital-lobe',
      'brain-limbic-cortex',
    ],
    colors: {
      'brain-frontal-lobe': '#e9a88f',
      'brain-broca-area': '#f2c14e',
      'brain-motor-cortex': '#e46f6f',
      'brain-somatosensory-cortex': '#5fa8d3',
      'brain-parietal-lobe': '#9fd0a9',
      'brain-temporal-lobe': '#c5a3e0',
      'brain-occipital-lobe': '#f0b7cf',
      'brain-limbic-cortex': '#e3c9a0',
      'brain-insula': '#d98c5f',
      'brain-corpus-callosum': '#f4ecd8',
      'brain-thalamus': '#4f8fd6',
      'brain-hypothalamus': '#d6589b',
      'brain-pituitary': '#b03a7a',
      'brain-pineal': '#8a62c8',
      'brain-hippocampus': '#3fb68b',
      'brain-amygdala': '#e2533a',
      'brain-basal-ganglia': '#6fc2c9',
      'brain-midbrain': '#d9a441',
      'brain-pons': '#c98a3c',
      'brain-medulla': '#a8742f',
      'brain-cerebellum': '#7ab06a',
      'brain-ventricles': '#7fc4f0',
    },
    clear: ['brain-ventricles'],
  },
  {
    id: 'eye',
    title: 'Eye',
    icon: '👁️',
    blurb: 'A human eye from the front, and the structures inside',
    topics: ['sensation-perception', 'waves-sound-light'],
    camera: [0, 0.06, 3.15],
    outer: ['eye-sclera', 'eye-choroid', 'eye-retina'],
    clear: ['eye-cornea', 'eye-anterior-chamber', 'eye-vitreous'],
    clearOpacity: 0.12,
    internal: [
      'eye-anterior-chamber',
      'eye-lens',
      'eye-zonule',
      'eye-vitreous',
      'eye-choroid',
      'eye-retina',
      'eye-optic-nerve',
      'eye-ophthalmic-artery',
      'eye-central-retinal-artery',
      'eye-ciliary-artery',
      'eye-lacrimal-artery',
      'eye-central-retinal-vein',
      'eye-ophthalmic-veins',
    ],
    colors: {
      'eye-cornea': '#f7fbff',
      'eye-anterior-chamber': '#d7eef6',
      'eye-iris': '#6b4224',
      'eye-lens': '#f3e7b0',
      'eye-zonule': '#d8c9a8',
      'eye-vitreous': '#e7f6fb',
      'eye-sclera': '#fbf9f6',
      'eye-choroid': '#6e2c2c',
      'eye-retina': '#e07a58',
      'eye-optic-nerve': '#f0d56b',
      'eye-ophthalmic-artery': '#d63c3c',
      'eye-central-retinal-artery': '#e23b3b',
      'eye-ciliary-artery': '#c43232',
      'eye-lacrimal-artery': '#d4534a',
      'eye-central-retinal-vein': '#3b73d9',
      'eye-ophthalmic-veins': '#3f6ec4',
    },
  },
  {
    id: 'torso',
    title: 'Chest & abdomen',
    icon: '🫁',
    blurb: 'Lungs, digestive organs, kidneys and glands',
    topics: ['respiratory', 'digestive-renal', 'immune', 'reproduction-development'],
    camera: [0, 0.05, 2.5],
    outer: [
      'torso-right-lung',
      'torso-left-lung',
      'torso-diaphragm',
      'torso-liver',
      'torso-small-intestine',
      'torso-large-intestine',
    ],
    colors: {
      'torso-trachea': '#d9e6ee',
      'torso-bronchi': '#c4d7e6',
      'torso-right-lung': '#f2a7b5',
      'torso-left-lung': '#f2a7b5',
      'torso-diaphragm': '#c0504d',
      'torso-heart': '#d63c3c',
      'torso-thyroid': '#9e5fc9',
      'torso-thymus': '#d6b85a',
      'torso-esophagus': '#e59a7c',
      'torso-stomach': '#ef8f6a',
      'torso-liver': '#8e3b2f',
      'torso-gallbladder': '#4f9a52',
      'torso-pancreas': '#f0c27a',
      'torso-spleen': '#7b3f8c',
      'torso-duodenum': '#e6a07e',
      'torso-small-intestine': '#f3b49a',
      'torso-large-intestine': '#c98d6b',
      'torso-appendix': '#b97a5c',
      'torso-rectum': '#b07656',
      'torso-adrenal-glands': '#f2c14e',
      'torso-kidneys': '#a0453e',
      'torso-ureters': '#e8d27a',
      'torso-bladder': '#e8c45c',
      'torso-prostate': '#6fa9c9',
      'torso-testes': '#5f8fd0',
    },
  },
  {
    id: 'skeleton',
    title: 'Skeleton',
    icon: '🦴',
    blurb: 'Skull, spine, ribs and limb bones',
    topics: ['muscle-bone-skin'],
    camera: [0, 0, 3.4],
    colors: {
      'skeleton-skull': '#efe3c8',
      'skeleton-mandible': '#e7d3a8',
      'skeleton-spine': '#e8c98f',
      'skeleton-ribs': '#f2e6cf',
      'skeleton-sternum': '#d9c08b',
      'skeleton-clavicle': '#c9b27c',
      'skeleton-scapula': '#e6d6b5',
      'skeleton-humerus': '#dfc79b',
      'skeleton-radius-ulna': '#e9d8b1',
      'skeleton-hand': '#d7bf8f',
      'skeleton-pelvis': '#e2cda1',
      'skeleton-femur': '#dcc394',
      'skeleton-patella': '#c9ab70',
      'skeleton-tibia-fibula': '#e6d2a8',
      'skeleton-foot': '#d4ba88',
    },
  },
]

export const modelById = (id: string | undefined) => MODELS.find((m) => m.id === id)
export const modelForTopic = (topicId: string) => MODELS.find((m) => m.topics.includes(topicId))
export const modelUrl = (id: string) => `/models/${id}.glb`

const cache = new Map<string, Promise<Part[]>>()

function fetchParts(model: string) {
  let pending = cache.get(model)
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('model', model)
        .order('sort_order')
        .abortSignal(AbortSignal.timeout(6000))
      if (error) throw error
      return (data ?? []) as Part[]
    })()
    pending.catch(() => cache.delete(model))
    cache.set(model, pending)
  }
  return pending
}

/** Parts (names and notes) for one 3D model. */
export function useModelParts(model: string | undefined) {
  const [state, setState] = useState<{ model?: string; parts: Part[]; error: string | null }>({ parts: [], error: null })

  useEffect(() => {
    if (!model) return
    let cancelled = false
    fetchParts(model).then(
      (parts) => !cancelled && setState({ model, parts: withListedParts(model, parts), error: null }),
      () => !cancelled && setState({ model, parts: [], error: "Couldn't load this model's notes. Try refreshing." }),
    )
    return () => {
      cancelled = true
    }
  }, [model])

  const ready = state.model === model
  const parts = ready && state.error && model ? offlineParts(model) : ready ? state.parts : []
  return { parts, error: ready ? state.error : null, loading: !!model && !ready }
}

/** Keep every mesh the model draws, even before its notes have been saved on the server. */
function withListedParts(model: string, parts: Part[]): Part[] {
  const have = new Set(parts.map((p) => p.id))
  const extra = offlineParts(model).filter((p) => !have.has(p.id))
  return extra.length ? [...parts, ...extra] : parts
}

/** Names only, from the model's part list, so the 3D model still works when the notes can't load. */
function offlineParts(model: string): Part[] {
  return Object.keys(modelById(model)?.colors ?? {}).map((id, i) => {
    const name = id.slice(model.length + 1).replaceAll('-', ' ')
    return {
      id,
      model,
      topic_id: '',
      name: name.charAt(0).toUpperCase() + name.slice(1),
      side: null,
      blood: null,
      sort_order: i,
      explanation: '',
      exam_pearl: '',
      audio_url: null,
      reviewed: false,
      reviewed_at: null,
    }
  })
}

/** One part by id, for linking a question to its structure. */
export async function fetchPart(id: string) {
  const { data } = await supabase.from('parts').select(PART_COLUMNS).eq('id', id).maybeSingle()
  return (data as Part | null) ?? null
}
