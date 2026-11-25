let currentAudio: HTMLAudioElement | null = null

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio = null
  }
}

// Neural/enhanced voices first; the OS default is often the most robotic one.
const PREFERRED_VOICES = [/natural/i, /premium/i, /enhanced/i, /^google us english$/i, /^(samantha|ava|allison|serena|daniel)\b/i]
let bestVoice: SpeechSynthesisVoice | null | undefined

function pickVoice() {
  if (bestVoice !== undefined) return bestVoice
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
  if (!voices.length) return null
  bestVoice =
    PREFERRED_VOICES.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices[0]
  return bestVoice
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    bestVoice = undefined
  })
}

function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.rate = 0.95
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

/** Plays the pre-generated audio file if there is one, otherwise the browser's voice. */
export function speak(text: string, audioUrl?: string | null): Promise<void> {
  stopSpeaking()
  if (!audioUrl) return browserSpeak(text)
  return new Promise((resolve) => {
    const audio = new Audio(audioUrl)
    currentAudio = audio
    const fallback = () => {
      if (currentAudio !== audio) return resolve()
      currentAudio = null
      browserSpeak(text).then(resolve)
    }
    audio.onended = () => resolve()
    audio.onerror = fallback
    audio.play().catch(fallback)
  })
}

export function partScript(part: { name: string; explanation: string; exam_pearl: string }) {
  return `${part.name}. ${part.explanation} Exam pearl: ${part.exam_pearl}`
}
