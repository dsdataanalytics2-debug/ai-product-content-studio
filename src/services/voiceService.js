import { VOICE_PROVIDERS } from '../config/models'
import { AppError, classifyHttpError, toAppError } from '../utils/errors'
import { useApiStore } from '../store/useApiStore'
import { download } from '../utils/exportUtils'
import { slug } from '../utils/text'

/**
 * Voice. Browser TTS is the default because it needs no key and no network, and
 * it is genuinely useful for the thing people actually want here: hearing
 * whether a hook lands when spoken aloud. The paid providers produce a
 * downloadable MP3; browser TTS cannot — the Web Speech API gives you playback,
 * not a buffer — and the UI says so rather than offering a download that fails.
 */

// ── Browser TTS ─────────────────────────────────────────────────────────────

let currentUtterance = null

export const browserTtsAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/**
 * Voices load asynchronously in Chrome — getVoices() returns [] on first call
 * until the voiceschanged event fires.
 */
export function listBrowserVoices() {
  if (!browserTtsAvailable()) return Promise.resolve([])

  return new Promise((resolve) => {
    const read = () => window.speechSynthesis.getVoices()
    const voices = read()
    if (voices.length) return resolve(voices)

    const onChange = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      resolve(read())
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
    // Chrome sometimes never fires the event when there are no voices at all.
    setTimeout(() => resolve(read()), 1200)
  })
}

/** Bengali voices are rare; fall back to any voice rather than staying silent. */
export function pickBrowserVoice(voices, language) {
  const wanted = language === 'en' ? 'en' : 'bn'
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith(wanted)) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith('en')) ??
    voices[0] ??
    null
  )
}

export function speakBrowser({ text, voice, rate = 1, pitch = 0, volume = 80, onEnd, onError }) {
  if (!browserTtsAvailable()) {
    onError?.(new AppError('UNKNOWN', 'This browser has no speech synthesis support.'))
    return null
  }

  stopBrowser()

  const utterance = new SpeechSynthesisUtterance(text)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  }
  utterance.rate = clamp(rate, 0.5, 2)
  // The Web Speech API takes pitch as 0–2; the UI slider is -10..10.
  utterance.pitch = clamp(1 + pitch / 10, 0, 2)
  utterance.volume = clamp(volume / 100, 0, 1)

  utterance.onend = () => {
    currentUtterance = null
    onEnd?.()
  }
  utterance.onerror = (e) => {
    currentUtterance = null
    // 'interrupted' and 'canceled' are what stop() produces — not failures.
    if (e.error === 'interrupted' || e.error === 'canceled') return
    onError?.(new AppError('UNKNOWN', `Speech synthesis failed: ${e.error}`))
  }

  currentUtterance = utterance
  window.speechSynthesis.speak(utterance)
  return utterance
}

export const pauseBrowser = () => browserTtsAvailable() && window.speechSynthesis.pause()
export const resumeBrowser = () => browserTtsAvailable() && window.speechSynthesis.resume()

export function stopBrowser() {
  if (!browserTtsAvailable()) return
  window.speechSynthesis.cancel()
  currentUtterance = null
}

export const isBrowserSpeaking = () =>
  browserTtsAvailable() && window.speechSynthesis.speaking && !window.speechSynthesis.paused

// ── ElevenLabs ──────────────────────────────────────────────────────────────

export async function fetchElevenLabsVoices() {
  const apiKey = useApiStore.getState().keys.elevenLabsKey
  if (!apiKey) throw new AppError('NO_KEYS', 'Add an ElevenLabs key in Settings.')

  const res = await fetch(`${VOICE_PROVIDERS.elevenlabs.endpoint}/voices`, {
    headers: { 'xi-api-key': apiKey },
  })
  if (!res.ok) throw classifyHttpError(res.status, await res.json().catch(() => null))

  const data = await res.json()
  return (data.voices ?? []).map((v) => ({
    value: v.voice_id,
    label: `${v.name}${v.labels?.accent ? ` · ${v.labels.accent}` : ''}`,
  }))
}

async function synthesiseElevenLabs({ text, voiceId, speed }) {
  const apiKey = useApiStore.getState().keys.elevenLabsKey
  if (!apiKey) throw new AppError('NO_KEYS', 'Add an ElevenLabs key in Settings.')
  if (!voiceId) throw new AppError('UNKNOWN', 'Pick a voice first.')

  const res = await fetch(
    `${VOICE_PROVIDERS.elevenlabs.endpoint}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2', // the only family with Bengali coverage
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: clamp(speed, 0.7, 1.2) },
      }),
    },
  )

  if (!res.ok) throw classifyHttpError(res.status, await res.json().catch(() => null))
  return res.blob()
}

// ── Google Cloud TTS ────────────────────────────────────────────────────────

async function synthesiseGoogle({ text, voiceId, language, speed, pitch }) {
  const apiKey = useApiStore.getState().keys.googleTtsKey
  if (!apiKey) throw new AppError('NO_KEYS', 'Add a Google TTS key in Settings.')

  const languageCode = language === 'en' ? 'en-US' : 'bn-IN'

  const res = await fetch(VOICE_PROVIDERS.googletts.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': apiKey },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode, ...(voiceId ? { name: voiceId } : {}) },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: clamp(speed, 0.25, 4),
        pitch: clamp(pitch, -20, 20),
      },
    }),
  })

  if (!res.ok) throw classifyHttpError(res.status, await res.json().catch(() => null))

  const data = await res.json()
  const bytes = Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: 'audio/mpeg' })
}

// ── Public API ──────────────────────────────────────────────────────────────

export const providerCanDownload = (provider) => provider !== 'browser'

/** Returns an MP3 Blob. Throws for browser TTS, which cannot produce one. */
export async function synthesise({ provider, text, voiceId, language, speed = 1, pitch = 0 }) {
  if (!text?.trim()) throw new AppError('UNKNOWN', 'Nothing to speak.')

  try {
    if (provider === 'elevenlabs') return await synthesiseElevenLabs({ text, voiceId, speed })
    if (provider === 'googletts')
      return await synthesiseGoogle({ text, voiceId, language, speed, pitch })

    throw new AppError(
      'UNKNOWN',
      'Browser TTS plays audio but cannot export a file. Add an ElevenLabs or Google TTS key to download MP3s.',
    )
  } catch (err) {
    console.error('[voiceService] synthesise failed', err)
    throw toAppError(err)
  }
}

/**
 * The Google voices actually available to this key, for a given language.
 *
 * Worth a network call rather than a hardcoded list: voice catalogues change,
 * Wavenet/Neural2/Chirp tiers differ by project, and a name that does not exist
 * fails only at synthesis time with an opaque 400. Listing is free.
 */
export async function fetchGoogleVoices(language) {
  const apiKey = useApiStore.getState().keys.googleTtsKey
  if (!apiKey) throw new AppError('NO_KEYS', 'Add a Google TTS key in Settings.')

  const languageCode = language === 'en' ? 'en-US' : 'bn-IN'
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/voices?languageCode=${languageCode}`,
    { headers: { 'X-Goog-Api-Key': apiKey } },
  )

  if (!res.ok) throw classifyHttpError(res.status, await res.json().catch(() => null))

  const data = await res.json()
  return (data.voices ?? [])
    .map((v) => ({
      value: v.name,
      label: `${v.name}${v.ssmlGender ? ` · ${v.ssmlGender.toLowerCase()}` : ''}`,
    }))
    .sort((a, b) => a.value.localeCompare(b.value))
}

/**
 * Verifies a voice key without spending anything.
 *
 * Both providers expose a voice-listing endpoint that authenticates exactly like
 * synthesis but bills nothing, so "is this key valid" never costs a character of
 * quota. Returns the same `{ status, message }` shape the AI provider tests use,
 * so ApiKeyCard renders it unchanged.
 */
export async function testVoiceKey(provider) {
  const keyName = VOICE_PROVIDERS[provider]?.keyName
  const apiKey = keyName ? useApiStore.getState().keys[keyName] : null

  if (!apiKey) return { status: 'fail', message: 'No key saved yet.' }

  try {
    if (provider === 'elevenlabs') {
      const voices = await fetchElevenLabsVoices()
      return {
        status: 'ok',
        message: `Key works. ${voices.length} voice${voices.length === 1 ? '' : 's'} available.`,
      }
    }

    if (provider === 'googletts') {
      // Listing voices proves three things at once: the key is real, the
      // Text-to-Speech API is enabled on the project, and any key restriction
      // permits this origin. A 403 here almost always means one of the last two.
      const res = await fetch('https://texttospeech.googleapis.com/v1/voices', {
        headers: { 'X-Goog-Api-Key': apiKey },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const reason = body?.error?.message ?? `HTTP ${res.status}`

        if (res.status === 403 && /disabled|not been used/i.test(reason))
          return {
            status: 'fail',
            message:
              'Key is valid but the Cloud Text-to-Speech API is not enabled on that project. Enable it in APIs & Services → Library.',
          }

        if (res.status === 400 || res.status === 403)
          return { status: 'fail', message: `Google rejected the key: ${reason}` }

        return { status: 'fail', message: reason }
      }

      const data = await res.json()
      const all = data.voices ?? []
      const bengali = all.filter((v) => (v.languageCodes ?? []).some((c) => c.startsWith('bn')))

      return {
        status: 'ok',
        message: `Key works. ${all.length} voices available${
          bengali.length ? `, ${bengali.length} Bengali` : ' (no Bengali voices on this account)'
        }.`,
      }
    }

    return { status: 'fail', message: 'That provider needs no key.' }
  } catch (err) {
    return { status: 'fail', message: toAppError(err).display().body }
  }
}

export async function downloadMp3({ filenameBase, ...options }) {
  const blob = await synthesise(options)
  download(blob, `${slug(filenameBase)}.mp3`)
}

/** Assembles the text a given scope should speak. */
export function textForScope(record, scope, sceneIndex = null) {
  const { script } = record
  if (scope === 'scene' && sceneIndex != null) return script.scenes[sceneIndex]?.voiceover ?? ''

  const voiceovers = script.scenes.map((s) => s.voiceover)

  // 'scene' without an index means "the whole thing, one scene at a time" — it
  // must still be spoken words only. Falling through to 'full' here made the
  // player read scene titles and English stage directions aloud in the middle of
  // a Bengali voiceover.
  if (scope === 'voiceover' || scope === 'scene')
    return [script.hook, ...voiceovers, script.cta].filter(Boolean).join('\n\n')

  // 'full' — read the visual direction too, for a director's pass.
  return [
    script.hook,
    ...script.scenes.flatMap((s) => [s.title, s.voiceover, s.visual_direction]),
    script.cta,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0))
