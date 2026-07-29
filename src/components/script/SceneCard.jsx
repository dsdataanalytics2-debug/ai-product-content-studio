import { useState } from 'react'
import { RotateCw, Loader2, Mic, Video, Type, ArrowDownRight } from 'lucide-react'
import ScriptBlock from './ScriptBlock'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import { formatClock } from '../../utils/text'

/**
 * Pure. onEdit(field, value), onRegenerate(index, instruction).
 *
 * Review marks arrive as render props rather than data: the caller already owns
 * the mark list and its handlers, and threading those through here would make
 * this component know about resolving and AI fixes, which are none of its
 * business.
 */
export default function SceneCard({
  scene,
  index,
  startsAt = 0,
  language = 'bn',
  onEdit,
  onRegenerate,
  isRegenerating = false,
  large = false,
  markCountFor = () => 0,
  renderMarks = () => null,
}) {
  const [regenOpen, setRegenOpen] = useState(false)
  const [instruction, setInstruction] = useState('')

  const endsAt = startsAt + scene.duration_seconds

  const submitRegen = () => {
    setRegenOpen(false)
    onRegenerate?.(index, instruction.trim())
    setInstruction('')
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] p-3 flex flex-col gap-2.5"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-divider)',
        opacity: isRegenerating ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="eyebrow eyebrow-accent">Scene {index + 1}</span>
        <span
          className="tag tag-accent"
          style={{ fontSize: '10px', padding: '1px 7px' }}
          title="Mood"
        >
          🎭 {scene.mood}
        </span>
        <span className="ml-auto text-[11px] text-faint tabular-nums shrink-0">
          {formatClock(startsAt)}–{formatClock(endsAt)} · {scene.duration_seconds}s
        </span>
        {onRegenerate && (
          <button
            type="button"
            onClick={() => setRegenOpen(true)}
            disabled={isRegenerating}
            aria-label={`Regenerate scene ${index + 1}`}
            title="Regenerate just this scene"
            className="btn btn-ghost p-1.5 shrink-0"
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 animate-spin-slow" />
            ) : (
              <RotateCw className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      <ScriptBlock
        label="Scene title"
        value={scene.title}
        language="en"
        onEdit={(v) => onEdit('title', v)}
        copyable={false}
        large={large}
        markCount={markCountFor('title')}
      >
        {renderMarks('title')}
      </ScriptBlock>

      <ScriptBlock
        label="Voiceover"
        emoji="🎙️"
        value={scene.voiceover}
        language={language}
        onEdit={(v) => onEdit('voiceover', v)}
        large={large}
        markCount={markCountFor('voiceover')}
      >
        {renderMarks('voiceover')}
      </ScriptBlock>

      <ScriptBlock
        label="On-screen text"
        emoji="🔤"
        value={scene.on_screen_text}
        language={language}
        onEdit={(v) => onEdit('on_screen_text', v)}
        large={large}
        markCount={markCountFor('on_screen_text')}
      >
        {renderMarks('on_screen_text')}
      </ScriptBlock>

      <ScriptBlock
        label="Visual direction"
        emoji="📹"
        value={scene.visual_direction}
        language="en"
        onEdit={(v) => onEdit('visual_direction', v)}
        large={large}
        markCount={markCountFor('visual_direction')}
      >
        {renderMarks('visual_direction')}
      </ScriptBlock>

      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <ArrowDownRight className="w-3 h-3 shrink-0" aria-hidden="true" />
        Transition: {scene.transition}
      </p>

      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={`Regenerate scene ${index + 1}`}
        description="Only this scene is rewritten — the rest of the script, and its duration, stay as they are. Much cheaper than regenerating everything."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" icon={RotateCw} onClick={submitRegen}>
              Regenerate
            </Button>
          </>
        }
      >
        <Input
          label="What should change? (optional)"
          multiline
          rows={3}
          value={instruction}
          onChange={setInstruction}
          placeholder="e.g. make the benefit more concrete, mention the 8-hour battery"
          hint="Left blank, the model is asked to make it stronger and more specific."
        />
      </Modal>
    </div>
  )
}

/** Compact horizontal card for the Scenes storyboard tab. */
export function SceneStoryboardCard({ scene, index, startsAt, language, isLast }) {
  const endsAt = startsAt + scene.duration_seconds

  return (
    <div className="flex items-stretch">
      <div
        className="w-[228px] shrink-0 rounded-[var(--radius-lg)] p-3 flex flex-col gap-2"
        style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow eyebrow-accent">Scene {index + 1}</span>
          <span className="text-[10.5px] text-faint tabular-nums">
            {formatClock(startsAt)}–{formatClock(endsAt)}
          </span>
        </div>
        <hr className="divider" />
        <span className="tag tag-accent self-start" style={{ fontSize: '10px' }}>
          🎭 {scene.mood}
        </span>
        <p className="text-[12px] font-semibold leading-snug">{scene.title}</p>

        <div className="flex gap-1.5">
          <Mic className="w-3 h-3 shrink-0 mt-0.5 text-faint" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed" lang={language === 'en' ? 'en' : 'bn'}
             style={{ color: 'var(--text-body)' }}>
            {scene.voiceover}
          </p>
        </div>

        <div className="flex gap-1.5">
          <Video className="w-3 h-3 shrink-0 mt-0.5 text-faint" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-dim">{scene.visual_direction}</p>
        </div>

        <div className="flex gap-1.5">
          <Type className="w-3 h-3 shrink-0 mt-0.5 text-faint" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-dim" lang={language === 'en' ? 'en' : 'bn'}>
            {scene.on_screen_text}
          </p>
        </div>

        <p
          className="flex items-center gap-1 text-[10.5px] text-faint mt-auto pt-2"
          style={{ borderTop: '1px solid var(--color-divider)' }}
        >
          <ArrowDownRight className="w-3 h-3" aria-hidden="true" /> {scene.transition}
        </p>
      </div>

      {!isLast && (
        <div className="grid place-items-center px-2 text-faint shrink-0" aria-hidden="true">
          →
        </div>
      )}
    </div>
  )
}
