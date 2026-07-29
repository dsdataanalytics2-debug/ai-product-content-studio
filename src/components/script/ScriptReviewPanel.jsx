import { useEffect, useRef, useState } from 'react'
import { MessageSquareWarning, Play, Square } from 'lucide-react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import ReviewMarkList from './ReviewMarkList'
import { languageMeta } from '../../config/constants'
import {
  browserTtsAvailable,
  listBrowserVoices,
  pickBrowserVoice,
  speakBrowser,
  stopBrowser,
  synthesise,
  textForScope,
} from '../../services/voiceService'
import { useApiStore } from '../../store/useApiStore'
import { toAppError } from '../../utils/errors'
import {
  MARKABLE_SCENE_FIELDS,
  SCENE_FIELD_LABELS,
  groupMarks,
  markContext,
  markKey,
  openCount,
  partition,
  hookPath,
  ctaPath,
  scenePath,
  shotPath,
} from '../../utils/reviewMarks'

/**
 * One markable block.
 *
 * Module scope on purpose. Defined inside the panel it would get a fresh
 * component identity on every keystroke, so React would remount the subtree and
 * the note input would lose focus after a single character.
 */
function ReviewBlock({
  label,
  text,
  language,
  marks,
  marking,
  draft,
  onStartMarking,
  onDraftChange,
  onSubmit,
  onCancel,
  onResolve,
}) {
  return (
    <div
      className="rounded-[var(--radius-md)] p-2"
      style={{
        background: 'var(--color-neutral-900)',
        border: `1px solid ${
          marks.length > 0
            ? 'color-mix(in srgb, var(--color-warning) 45%, transparent)'
            : 'var(--color-divider)'
        }`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="eyebrow eyebrow-accent">{label}</span>
        {marks.length > 0 && <Badge tone="warning">{marks.length}</Badge>}
        <button
          type="button"
          onClick={onStartMarking}
          className="btn btn-ghost px-1.5 py-0.5 text-[10.5px] ml-auto"
          aria-label={`Mark a problem in ${label}`}
        >
          <MessageSquareWarning className="w-3 h-3 shrink-0" aria-hidden="true" />
          Mark
        </button>
      </div>

      <p
        lang={language}
        className="text-[12px] leading-relaxed whitespace-pre-wrap"
        style={{ color: 'var(--text-body)' }}
      >
        {text || <span className="text-faint italic">Empty</span>}
      </p>

      {marking && (
        <div className="flex gap-1.5 mt-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder="What is wrong here?"
            aria-label={`Note on ${label}`}
            className="input text-[12px] py-1"
          />
          <Button size="xs" onClick={onSubmit} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      )}

      <ReviewMarkList marks={marks} onResolve={onResolve} />
    </div>
  )
}

/**
 * A shot as one readable paragraph.
 *
 * The Studio renders shots as a ten-column table with a 720px minimum — it
 * cannot fit a 420px drawer. Reviewing does not need the grid, only the content,
 * so the columns collapse into a sentence and empty fields drop out.
 */
function describeShot(shot) {
  const parts = [
    shot.shot,
    [shot.type, shot.angle, shot.movement].filter(Boolean).join(' · '),
    shot.subject && `Subject: ${shot.subject}`,
    shot.location && `Location: ${shot.location}`,
    shot.props && `Props: ${shot.props}`,
    shot.broll && `B-roll: ${shot.broll}`,
    shot.notes,
  ]
  return parts.filter(Boolean).join('\n')
}

/**
 * Read-and-mark view of a script, for the review pass.
 *
 * Deliberately not editable: reviewing and rewriting are different jobs, and the
 * Studio already owns editing. Here you only say what is wrong and where.
 *
 * Pure. Props in, callbacks out.
 */
export default function ScriptReviewPanel({ record, onAddMark, onResolve }) {
  const [markingKey, setMarkingKey] = useState(null)
  const [draft, setDraft] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState([])
  const [voiceError, setVoiceError] = useState(null)
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const googleKey = useApiStore((s) => s.keys.googleTtsKey)

  // Voices arrive asynchronously — Chrome returns an empty list on first call
  // and fills it in on a `voiceschanged` event, which listBrowserVoices waits
  // for. Without this the utterance gets no voice, no lang, and the browser
  // silently reads Bengali with an English engine, which produces nothing.
  useEffect(() => {
    listBrowserVoices().then(setVoices)
  }, [])

  // Stop speech if the drawer closes mid-sentence — otherwise the voice carries
  // on narrating a script nobody is looking at any more.
  useEffect(
    () => () => {
      stopBrowser()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    },
    [],
  )

  const script = record.script
  const marks = record.marks ?? []
  const context = markContext(record)
  const grouped = groupMarks(marks, context)
  const { detached } = partition(marks, context)

  const shots = record.shots ?? []
  const lang = languageMeta(record.config?.language).htmlLang

  const submit = (path) => {
    const note = draft.trim()
    if (!note) return
    onAddMark(path, note)
    setDraft('')
    setMarkingKey(null)
  }

  // Returns props WITHOUT `key`: React 19 ignores a spread key and warns, which
  // would leave every block keyless and let React reuse the wrong DOM between
  // them. Callers pass key explicitly.
  const blockProps = (path, label, text, language = lang) => {
    const key = markKey(path)
    return {
      label,
      text,
      language,
      marks: grouped.get(key) ?? [],
      marking: markingKey === key,
      draft,
      onStartMarking: () => {
        setMarkingKey(markingKey === key ? null : key)
        setDraft('')
      },
      onDraftChange: setDraft,
      onSubmit: () => submit(path),
      onCancel: () => setMarkingKey(null),
      onResolve,
    }
  }

  /**
   * Reads the voiceover aloud with the browser's own synthesiser.
   *
   * No stored audio: MP3s are downloaded to disk, never kept on the record, and
   * localStorage could not hold them anyway. What a review judges is pacing and
   * wording, and browser TTS conveys both for free and instantly.
   */
  const stopAudio = () => {
    audioRef.current?.pause()
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    audioRef.current = null
  }

  const toggleSpeech = async () => {
    if (speaking) {
      stopBrowser()
      stopAudio()
      setSpeaking(false)
      return
    }

    const text = textForScope(record, 'voiceover')
    if (!text.trim()) {
      setVoiceError('This script has no voiceover text to read.')
      return
    }

    setVoiceError(null)
    setSpeaking(true)

    // Prefer a real TTS provider when one is configured. Browser voices cannot
    // speak Bengali on most machines, so falling back to them here made the
    // reviewer hear an English narrator — worthless for judging delivery.
    if (googleKey) {
      try {
        const blob = await synthesise({
          provider: 'googletts',
          text,
          language: record.config?.language,
        })
        stopAudio()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => {
          setSpeaking(false)
          stopAudio()
        }
        audioRef.current = audio
        audioUrlRef.current = url
        await audio.play()
      } catch (err) {
        setSpeaking(false)
        setVoiceError(toAppError(err).display().body)
      }
      return
    }

    const voice = pickBrowserVoice(voices, record.config?.language)
    if (!voice) {
      setVoiceError('Your browser has no speech voices installed, so nothing can be read aloud.')
      setSpeaking(false)
      return
    }

    speakBrowser({
      text,
      voice,
      onEnd: () => setSpeaking(false),
      // Surfacing this matters: without a voice the API fails silently, which is
      // indistinguishable from a dead button.
      onError: (err) => {
        setSpeaking(false)
        setVoiceError(err?.message ?? 'Speech synthesis failed.')
      },
    })
  }

  const scriptLang = record.config?.language === 'en' ? 'en' : 'bn'
  const chosenVoice = pickBrowserVoice(voices, record.config?.language)
  const voiceMismatch = chosenVoice && !chosenVoice.lang?.toLowerCase().startsWith(scriptLang)

  return (
    <div className="flex flex-col gap-2">
      {/* Voice is always shown, and always explains itself. There is no stored
          audio to review — MP3s are downloaded to disk and never touch the
          record — so silence here would read as a broken feature. */}
      <div
        className="rounded-[var(--radius-md)] p-2 flex flex-col gap-1.5"
        style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
      >
        <div className="flex items-center gap-1.5">
          <span className="eyebrow eyebrow-accent">Voice</span>
          {(googleKey || browserTtsAvailable()) && (
            <Button
              size="xs"
              variant="secondary"
              icon={speaking ? Square : Play}
              onClick={toggleSpeech}
              className="ml-auto"
            >
              {speaking ? 'Stop' : 'Listen'}
            </Button>
          )}
        </div>
        {!browserTtsAvailable() && (
          <p className="text-[11px] text-faint leading-relaxed">
            This browser has no speech synthesis, so the voiceover cannot be played back here.
          </p>
        )}

        {googleKey && (
          <p className="text-[11px] text-faint leading-relaxed">
            Uses your Google TTS voice, so this is the real delivery. Each play is a billed
            synthesis call.
          </p>
        )}

        {!googleKey && browserTtsAvailable() && (
          <p className="text-[11px] text-faint leading-relaxed">
            {chosenVoice
              ? `Using ${chosenVoice.name} (${chosenVoice.lang}). Studio MP3s download to your computer and are not stored here.`
              : 'Loading voices…'}
          </p>
        )}

        {!googleKey && voiceMismatch && (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning-text)' }}>
            No {scriptLang === 'bn' ? 'Bengali' : 'English'} voice is installed, so this falls back
            to {chosenVoice.lang} and will mispronounce the script. Judge pacing, not delivery —
            or install a {scriptLang === 'bn' ? 'Bengali' : 'English'} voice in your OS settings.
          </p>
        )}

        {voiceError && (
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-danger-text)' }}>
            {voiceError}
          </p>
        )}
      </div>

      {/* What this card contains, before any scrolling. The storyboard sits
          below every scene, so on a long script it was invisible unless you
          scrolled to the very bottom — indistinguishable from missing. */}
      <p className="text-[11px] text-faint">
        {(script?.scenes ?? []).length} scenes ·{' '}
        {shots.length > 0 ? `${shots.length} shots (below)` : 'no shot list'} ·{' '}
        {openCount(marks)} open {openCount(marks) === 1 ? 'note' : 'notes'}
      </p>

      {detached.length > 0 && (
        <div
          className="rounded-[var(--radius-md)] p-2"
          style={{
            background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
          }}
        >
          <p className="eyebrow mb-1">Detached notes</p>
          <ReviewMarkList marks={detached} onResolve={onResolve} showLocation />
        </div>
      )}

      <ReviewBlock {...blockProps(hookPath(), 'Hook', script?.hook)} />

      {(script?.scenes ?? []).map((scene, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <p className="eyebrow mt-1">Scene {i + 1}</p>
          {MARKABLE_SCENE_FIELDS.map((field) => (
            <ReviewBlock
              key={field}
              {...blockProps(
                scenePath(i, field),
                SCENE_FIELD_LABELS[field],
                scene[field],
                field === 'title' || field === 'visual_direction' ? 'en' : lang,
              )}
            />
          ))}
        </div>
      ))}

      <ReviewBlock {...blockProps(ctaPath(), 'Call to action', script?.cta)} />

      {/* Always rendered, even when empty. A section that silently disappears is
          indistinguishable from a feature that is not there, which is exactly
          how a missing storyboard reads to a reviewer. */}
      {/* "Shot list", not "Storyboard": the Studio's Storyboard tab is a visual
          view of script.scenes, while this is record.shots from its Shots tab.
          Two different things, and one label for both was confusing. */}
      <p className="eyebrow mt-2">
        Shot list {shots.length > 0 ? `· ${shots.length} shots` : ''}
      </p>

      {shots.length === 0 && (
        <p
          className="text-[11.5px] text-faint leading-relaxed rounded-[var(--radius-md)] p-2"
          style={{ border: '1px dashed var(--color-divider)' }}
        >
          No shot list on this script yet. Generate one in Script Studio → Shots tab; it saves
          itself and appears here.
        </p>
      )}

      {shots.length > 0 && (
        <>
          {shots.map((shot, i) => (
            <ReviewBlock
              key={i}
              {...blockProps(
                shotPath(i),
                `Shot ${i + 1}${shot.scene != null ? ` · Scene ${shot.scene}` : ''}`,
                describeShot(shot),
                'en',
              )}
            />
          ))}
        </>
      )}
    </div>
  )
}
