import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Square, Download, Loader2, Info } from 'lucide-react'
import OptionCard from '../ui/OptionCard'
import Select from '../ui/Select'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { VOICE_PROVIDERS } from '../../config/models'
import { VOICE_SCOPES } from '../../config/constants'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useApiStore } from '../../store/useApiStore'
import { toast } from '../../store/useToastStore'
import { toAppError } from '../../utils/errors'
import {
  browserTtsAvailable,
  listBrowserVoices,
  pickBrowserVoice,
  speakBrowser,
  pauseBrowser,
  resumeBrowser,
  stopBrowser,
  fetchElevenLabsVoices,
  fetchGoogleVoices,
  downloadMp3,
  synthesise,
  textForScope,
  providerCanDownload,
} from '../../services/voiceService'

function Slider({ label, value, min, max, step, display, minLabel, maxLabel, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-dim">{label}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--color-accent-300)' }}>
          {display}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] text-faint shrink-0">{minLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 cursor-pointer"
          style={{ accentColor: 'var(--color-accent)' }}
        />
        <span className="text-[10.5px] text-faint shrink-0">{maxLabel}</span>
      </div>
    </div>
  )
}

export default function VoicePanel({ record }) {
  const settings = useSettingsStore()
  const setSettings = useSettingsStore((s) => s.set)
  const keys = useApiStore((s) => s.keys)

  const [browserVoices, setBrowserVoices] = useState([])
  const [remoteVoices, setRemoteVoices] = useState([])
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)

  // Paid providers return an MP3 blob rather than driving the speech engine, so
  // playback needs a real Audio element and its object URL tracked for release.
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)

  const provider = settings.voiceProvider
  const meta = VOICE_PROVIDERS[provider]
  const language = record.config.language

  useEffect(() => {
    listBrowserVoices().then(setBrowserVoices)
    return () => stopBrowser()
  }, [])

  useEffect(() => {
    const fetcher =
      provider === 'elevenlabs' && keys.elevenLabsKey
        ? fetchElevenLabsVoices
        : provider === 'googletts' && keys.googleTtsKey
          ? () => fetchGoogleVoices(record.config.language)
          : null

    if (!fetcher) {
      setRemoteVoices([])
      return
    }

    let live = true
    fetcher()
      .then((v) => live && setRemoteVoices(v))
      .catch((err) => live && toast.fromAppError(toAppError(err)))
    return () => {
      live = false
    }
  }, [provider, keys.elevenLabsKey, keys.googleTtsKey, record.config.language])

  const voiceOptions = useMemo(() => {
    if (provider === 'browser')
      return browserVoices.map((v) => ({ value: v.name, label: `${v.name} · ${v.lang}` }))
    if (provider === 'elevenlabs') return remoteVoices
    // Google TTS: naming a voice is optional — languageCode alone gets a
    // default — so the real catalogue is offered on top of that fallback rather
    // than instead of it.
    return [{ value: '', label: 'Default for language' }, ...remoteVoices]
  }, [provider, browserVoices, remoteVoices])

  const keyMissing = meta.needsKey && !keys[meta.keyName]
  const text = textForScope(record, record.config.voiceScope)

  /** Object URLs are not garbage collected; a leaked one holds its blob forever. */
  const releaseAudio = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    audioRef.current = null
  }

  /**
   * Previews with the provider that is actually selected.
   *
   * It used to always use browser TTS "because it costs nothing" — but browser
   * TTS has no Bengali voice on most machines, so picking a Bengali Google voice
   * and pressing play produced an English narrator reading Bengali text. A
   * preview that cannot preview the thing you chose is worse than a fractional
   * cent of synthesis.
   */
  // Leaving the tab must silence both engines and free the blob.
  useEffect(
    () => () => {
      stopBrowser()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    },
    [],
  )

  const play = async () => {
    if (paused) {
      if (provider === 'browser') resumeBrowser()
      else audioRef.current?.play()
      setPaused(false)
      return
    }
    await speakText(text)
  }

  /** Plays one scene's spoken lines and nothing else. */
  const playScene = async (index) => {
    stop()
    await speakText(textForScope(record, 'scene', index))
  }

  /** Speaks arbitrary text through whichever provider is selected. */
  const speakText = async (spoken) => {
    if (!spoken?.trim()) {
      toast.info('Nothing to read', 'There is no voiceover text here.')
      return
    }

    if (provider === 'browser') {
      const voice =
        browserVoices.find((v) => v.name === settings.voiceId) ??
        pickBrowserVoice(browserVoices, language)

      if (!voice && !browserTtsAvailable()) {
        toast.error('No speech synthesis', 'This browser cannot play synthesised speech.')
        return
      }

      setPlaying(true)
      setPaused(false)
      speakBrowser({
        text: spoken,
        voice,
        rate: settings.speed,
        pitch: settings.pitch,
        volume: settings.volume,
        onEnd: () => setPlaying(false),
        onError: (err) => {
          setPlaying(false)
          toast.fromAppError(err)
        },
      })
      return
    }

    setPlaying(true)
    setPaused(false)
    try {
      const blob = await synthesise({
        provider,
        text: spoken,
        voiceId: settings.voiceId,
        language,
        speed: settings.speed,
        pitch: settings.pitch,
      })

      releaseAudio()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.volume = Math.min(1, Math.max(0, settings.volume / 100))
      audio.onended = () => {
        setPlaying(false)
        releaseAudio()
      }
      audio.onerror = () => {
        setPlaying(false)
        toast.error('Playback failed', 'The audio could not be played.')
        releaseAudio()
      }
      audioRef.current = audio
      audioUrlRef.current = url
      await audio.play()
    } catch (err) {
      setPlaying(false)
      toast.fromAppError(toAppError(err))
    }
  }

  const pause = () => {
    if (provider === 'browser') pauseBrowser()
    else audioRef.current?.pause()
    setPaused(true)
  }

  const stop = () => {
    stopBrowser()
    audioRef.current?.pause()
    releaseAudio()
    setPlaying(false)
    setPaused(false)
  }

  const downloadAudio = async (scope, sceneIndex = null) => {
    setBusy(true)
    try {
      await downloadMp3({
        filenameBase:
          sceneIndex != null ? `${record.title}-scene-${sceneIndex + 1}` : record.title,
        provider,
        text: textForScope(record, scope, sceneIndex),
        voiceId: settings.voiceId,
        language,
        speed: settings.speed,
        pitch: settings.pitch,
      })
      toast.success('MP3 downloaded')
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow mb-2">Provider</p>
        <div
          className="flex gap-1 p-1 rounded-[var(--radius-lg)]"
          style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
          role="radiogroup"
          aria-label="Voice provider"
        >
          {Object.values(VOICE_PROVIDERS).map((p) => {
            const active = provider === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSettings({ voiceProvider: p.id, voiceId: '' })}
                className="flex-1 px-2 py-1.5 rounded-[var(--radius-md)] text-[11.5px] font-medium transition-colors"
                style={{
                  background: active ? 'var(--color-accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-dim)',
                }}
              >
                {p.label}
                {p.sublabel && <span className="opacity-70"> · {p.sublabel}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {keyMissing ? (
        <EmptyState
          icon={Info}
          compact
          dashed
          title={`${meta.label} needs a key`}
          description="Add it in Settings → API Keys. Browser TTS works right now with no key at all."
        />
      ) : (
        <Select
          label="Voice"
          value={settings.voiceId}
          onChange={(voiceId) => setSettings({ voiceId })}
          options={
            voiceOptions.length
              ? voiceOptions
              : [{ value: '', label: 'No voices available in this browser' }]
          }
        />
      )}

      <div className="flex flex-col gap-3">
        <p className="eyebrow">Controls</p>
        <Slider
          label="Speed"
          value={settings.speed}
          min={0.5}
          max={2}
          step={0.1}
          display={`${settings.speed.toFixed(1)}×`}
          minLabel="0.5×"
          maxLabel="2.0×"
          onChange={(speed) => setSettings({ speed })}
        />
        {meta.supportsPitch && (
          <Slider
            label="Pitch"
            value={settings.pitch}
            min={-10}
            max={10}
            step={1}
            display={settings.pitch > 0 ? `+${settings.pitch}` : String(settings.pitch)}
            minLabel="Low"
            maxLabel="High"
            onChange={(pitch) => setSettings({ pitch })}
          />
        )}
        <Slider
          label="Volume"
          value={settings.volume}
          min={0}
          max={100}
          step={1}
          display={`${settings.volume}%`}
          minLabel="0%"
          maxLabel="100%"
          onChange={(volume) => setSettings({ volume })}
        />
      </div>

      <div>
        <p className="eyebrow mb-2">Scope</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Voice scope">
          {VOICE_SCOPES.map((s) => (
            <OptionCard
              key={s.value}
              compact
              icon={s.icon}
              label={s.label}
              selected={record.config.voiceScope === s.value}
              disabled
              disabledReason="Set the delivery scope in Script configuration"
            />
          ))}
        </div>
      </div>

      <div
        className="rounded-[var(--radius-lg)] p-3"
        style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={play}
            disabled={playing && !paused}
            aria-label="Play"
            className="grid place-items-center w-8 h-8 rounded-full shrink-0 disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            <Play className="w-3.5 h-3.5 ml-px" />
          </button>
          <button
            type="button"
            onClick={pause}
            disabled={!playing || paused}
            aria-label="Pause"
            className="btn btn-secondary grid place-items-center w-8 h-8 p-0 rounded-full shrink-0"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!playing}
            aria-label="Stop"
            className="btn btn-secondary grid place-items-center w-8 h-8 p-0 rounded-full shrink-0"
          >
            <Square className="w-3 h-3" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-1 h-6" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={playing && !paused ? 'animate-wave' : ''}
                style={{
                  width: 3,
                  height: 20,
                  borderRadius: 2,
                  background: playing && !paused ? 'var(--color-accent)' : 'var(--color-neutral-700)',
                  transformOrigin: 'center',
                  animationDelay: `${i * 0.1}s`,
                  transform: playing && !paused ? undefined : 'scaleY(0.3)',
                }}
              />
            ))}
          </div>

          <span className="text-[11px] text-dim shrink-0">
            {paused ? 'Paused' : playing ? 'Playing' : 'Ready'}
          </span>
        </div>
      </div>

      {record.config.voiceScope !== 'scene' ? (
        <>
          <Button
            block
            variant="secondary"
            icon={busy ? Loader2 : Download}
            disabled={busy || !providerCanDownload(provider) || keyMissing}
            onClick={() => downloadAudio(record.config.voiceScope)}
            title={
              providerCanDownload(provider)
                ? undefined
                : 'Browser TTS can play audio but cannot export a file'
            }
          >
            {busy ? 'Synthesising…' : 'Download full MP3'}
          </Button>
          {!providerCanDownload(provider) && (
            <p className="text-[11px] text-faint leading-relaxed -mt-2">
              Browser TTS plays audio but cannot produce a file — the Web Speech API gives playback,
              not a buffer. Add an ElevenLabs or Google TTS key to download MP3s.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Scenes</p>
          <p className="text-[11px] text-faint leading-relaxed -mt-1 mb-0.5">
            Plays only that scene’s voiceover — no titles, no visual directions.
          </p>
          {record.script.scenes.map((scene, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-md)]"
              style={{
                background: 'var(--color-neutral-900)',
                border: '1px solid var(--color-divider)',
              }}
            >
              <span className="text-[12px] flex-1 min-w-0 truncate text-body">
                Scene {i + 1} — {scene.title}
              </span>
              <Button
                size="xs"
                variant="secondary"
                icon={Play}
                disabled={busy || keyMissing || !scene.voiceover?.trim()}
                onClick={() => playScene(i)}
                aria-label={`Play scene ${i + 1} voiceover`}
              >
                Play
              </Button>
              <Button
                size="xs"
                variant="secondary"
                icon={Download}
                disabled={busy || !providerCanDownload(provider) || keyMissing}
                onClick={() => downloadAudio('scene', i)}
              >
                MP3
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
