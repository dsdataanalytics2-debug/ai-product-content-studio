import { useState } from 'react'
import {
  ChevronDown,
  Sparkles,
  Image as ImageIcon,
  Subtitles,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Download,
  Pencil,
} from 'lucide-react'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import Skeleton from '../ui/Skeleton'
import { generate } from '../../services/aiService'
import { useScriptStore } from '../../store/useScriptStore'
import {
  buildFeedbackPrompt,
  buildThumbnailPrompt,
  buildSubtitlePrompt,
  buildSystemPrompt,
  buildPromptConfig,
} from '../../utils/promptBuilder'
import { FEEDBACK_SCHEMA, SUBTITLE_SCHEMA } from '../../config/constants'
import { useBrandStore } from '../../store/useBrandStore'
import { toast } from '../../store/useToastStore'
import { toAppError } from '../../utils/errors'
import { copyToClipboard, exportAsSRT, exportAsVTT, subtitleRows } from '../../utils/exportUtils'
import { srtTime } from '../../utils/promptBuilder'

function Accordion({ title, badge, open, onToggle, children }) {
  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{ border: '1px solid var(--color-divider)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        style={{ background: open ? 'var(--color-neutral-900)' : 'transparent' }}
      >
        <span className="text-[13px] font-semibold flex-1">{title}</span>
        {badge}
        <ChevronDown
          className="w-3.5 h-3.5 shrink-0 transition-transform text-faint"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          aria-hidden="true"
        />
      </button>
      {open && <div className="p-3.5 pt-0">{children}</div>}
    </div>
  )
}

const VERDICT_TONE = { strong: 'success', adequate: 'warning', weak: 'danger' }

function VerdictRow({ label, entry }) {
  if (!entry) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-dim flex-1">{label}</span>
        <Badge tone={VERDICT_TONE[entry.verdict] ?? 'neutral'}>{entry.verdict || '—'}</Badge>
      </div>
      <p className="text-[11.5px] leading-relaxed text-faint">{entry.why}</p>
      {entry.rewrite_suggestion && (
        <p
          className="text-[11.5px] leading-relaxed p-2 rounded-[var(--radius-sm)]"
          style={{ background: 'var(--accent-wash)', color: 'var(--color-accent-300)' }}
        >
          Try: {entry.rewrite_suggestion}
        </p>
      )}
    </div>
  )
}

export default function ToolsPanel({ record }) {
  const attach = useScriptStore((s) => s.attach)
  const brand = useBrandStore((s) => s.get(record.config.brandId))

  const [openSection, setOpenSection] = useState('feedback')
  const [busy, setBusy] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [editingThumb, setEditingThumb] = useState(null)
  const [thumbDraft, setThumbDraft] = useState('')

  /**
   * Writes an edited thumbnail prompt back to the record.
   *
   * Generated prompts are a starting point — the tool you paste them into has
   * its own quirks, and the wording usually needs a nudge. Going through
   * `attach` means the edit persists like any other artefact and rides the
   * auto-save to the Library and the Workspace board.
   */
  const commitThumb = (index) => {
    const next = (record.thumbnails ?? []).map((t, i) =>
      i === index ? { ...t, prompt: thumbDraft.trim() } : t,
    )
    setEditingThumb(null)
    if (next[index]?.prompt !== record.thumbnails?.[index]?.prompt) attach('thumbnails', next)
  }

  const toggle = (key) => setOpenSection((cur) => (cur === key ? null : key))

  const run = async (key, { prompt, schema, onResult }) => {
    setBusy(key)
    try {
      const promptConfig = buildPromptConfig(record.config)
      const { json } = await generate({
        system: buildSystemPrompt(promptConfig),
        prompt,
        schema,
      })
      onResult(json)
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      setBusy(null)
    }
  }

  const runFeedback = () =>
    run('feedback', {
      prompt: buildFeedbackPrompt(record.script, brand),
      schema: FEEDBACK_SCHEMA,
      onResult: (json) => {
        attach('feedback', json)
        if (json.unsupported_claims?.length) {
          toast.error(
            `${json.unsupported_claims.length} unsupported claim${json.unsupported_claims.length > 1 ? 's' : ''}`,
            'Check these before this becomes an ad you have to answer for.',
          )
        }
      },
    })

  const runThumbnails = () =>
    run('thumbnails', {
      prompt: buildThumbnailPrompt(record.script, record.products ?? []),
      schema: null,
      onResult: (json) => attach('thumbnails', json.thumbnails ?? []),
    })

  const runSubtitles = () =>
    run('subtitles', {
      prompt: buildSubtitlePrompt(record.script.scenes.map((s) => s.voiceover)),
      schema: SUBTITLE_SCHEMA,
      onResult: (json) => attach('subtitles', { blocks: json.blocks ?? [] }),
    })

  const copyThumb = async (text, i) => {
    if (await copyToClipboard(text)) {
      setCopiedIndex(i)
      setTimeout(() => setCopiedIndex(null), 1600)
    }
  }

  const feedback = record.feedback
  const rows = record.subtitles ? subtitleRows(record) : []

  return (
    <div className="flex flex-col gap-2">
      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      <Accordion
        title="📊 Creative review"
        open={openSection === 'feedback'}
        onToggle={() => toggle('feedback')}
        badge={
          feedback ? (
            <Badge tone={feedback.unsupported_claims?.length ? 'danger' : 'success'}>
              {feedback.unsupported_claims?.length
                ? `${feedback.unsupported_claims.length} claim issue${feedback.unsupported_claims.length > 1 ? 's' : ''}`
                : 'Reviewed'}
            </Badge>
          ) : null
        }
      >
        <div className="flex flex-col gap-3">
          <Button
            block
            variant="secondary"
            size="sm"
            icon={busy === 'feedback' ? Loader2 : Sparkles}
            loading={busy === 'feedback'}
            onClick={runFeedback}
          >
            {feedback ? 'Review again' : 'Review this script'}
          </Button>

          {busy === 'feedback' && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" delay={0.15} />
            </div>
          )}

          {feedback && busy !== 'feedback' && (
            <div className="flex flex-col gap-3.5">
              {/* Deliberately not a score out of 100. A number invites you to
                  optimise it; a verdict plus a reason tells you what to change. */}
              {feedback.unsupported_claims?.length > 0 && (
                <div
                  className="p-2.5 rounded-[var(--radius-md)]"
                  style={{
                    background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)',
                  }}
                >
                  <p
                    className="flex items-center gap-1.5 text-[12px] font-semibold mb-1.5"
                    style={{ color: 'var(--color-danger-text)' }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Claims not backed by product data
                  </p>
                  <ul className="flex flex-col gap-1">
                    {feedback.unsupported_claims.map((c, i) => (
                      <li key={i} className="text-[11.5px] leading-relaxed text-body">
                        • {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <VerdictRow label="Hook" entry={feedback.hook} />
              <VerdictRow label="Clarity" entry={feedback.clarity} />
              <VerdictRow label="Pacing" entry={feedback.pacing} />
              <VerdictRow label="Call to action" entry={feedback.cta} />
              <VerdictRow label="Brand fit" entry={feedback.brand_fit} />

              <div className="grid grid-cols-1 gap-2">
                <div
                  className="p-2.5 rounded-[var(--radius-md)] text-[11.5px] leading-relaxed"
                  style={{
                    background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
                    color: 'var(--color-success-text)',
                  }}
                >
                  <strong>Strongest:</strong> {feedback.biggest_strength}
                </div>
                <div
                  className="p-2.5 rounded-[var(--radius-md)] text-[11.5px] leading-relaxed"
                  style={{
                    background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
                    color: 'var(--color-warning-text)',
                  }}
                >
                  <strong>Weakest:</strong> {feedback.biggest_weakness}
                </div>
              </div>

              {feedback.three_quick_fixes?.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="eyebrow">Quick fixes</p>
                  {feedback.three_quick_fixes.filter(Boolean).map((fix, i) => (
                    <p key={i} className="text-[12px] leading-relaxed text-body">
                      {i + 1}. {fix}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {!feedback && busy !== 'feedback' && (
            <p className="text-[11.5px] text-faint leading-relaxed">
              Returns verdicts and reasons, not a score — plus any claim in the script that the
              product data does not support.
            </p>
          )}
        </div>
      </Accordion>

      {/* ── Thumbnails ───────────────────────────────────────────────────── */}
      <Accordion
        title="🖼️ Thumbnail prompts"
        open={openSection === 'thumbnails'}
        onToggle={() => toggle('thumbnails')}
        badge={record.thumbnails?.length ? <Badge tone="accent">{record.thumbnails.length}</Badge> : null}
      >
        <div className="flex flex-col gap-3">
          <Button
            block
            variant="secondary"
            size="sm"
            icon={busy === 'thumbnails' ? Loader2 : ImageIcon}
            loading={busy === 'thumbnails'}
            onClick={runThumbnails}
          >
            {record.thumbnails ? 'Generate new variations' : 'Generate thumbnail prompts'}
          </Button>

          {busy === 'thumbnails' && <Skeleton className="h-28" />}

          {record.thumbnails?.map((tp, i) => (
            <div
              key={i}
              className="p-2.5 rounded-[var(--radius-md)]"
              style={{
                background: 'var(--color-neutral-900)',
                border: '1px solid var(--color-divider)',
              }}
            >
              <p className="text-[12px] font-semibold mb-2">{tp.tool}</p>

              {editingThumb === i ? (
                <textarea
                  autoFocus
                  value={thumbDraft}
                  onChange={(e) => setThumbDraft(e.target.value)}
                  onBlur={() => commitThumb(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingThumb(null)
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitThumb(i)
                  }}
                  rows={Math.min(10, Math.max(3, Math.ceil(thumbDraft.length / 48)))}
                  aria-label={`Edit ${tp.tool} prompt`}
                  className="input font-mono text-[11px] leading-relaxed mb-2 resize-y"
                />
              ) : (
                <p
                  className="font-mono text-[11px] leading-relaxed p-2 rounded-[var(--radius-sm)] mb-2 whitespace-pre-wrap"
                  style={{
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-divider)',
                    color: 'var(--text-dim)',
                  }}
                >
                  {tp.prompt}
                </p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                {(tp.tags ?? []).map((tag) => (
                  <Badge key={tag} tone="accent">
                    {tag}
                  </Badge>
                ))}
                {editingThumb === i ? (
                  <span className="ml-auto text-[10.5px] text-faint">
                    Ctrl+Enter to save · Escape to discard
                  </span>
                ) : (
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="ml-auto"
                      icon={Pencil}
                      onClick={() => {
                        setThumbDraft(tp.prompt)
                        setEditingThumb(i)
                      }}
                      aria-label={`Edit ${tp.tool} prompt`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={copiedIndex === i ? Check : Copy}
                      onClick={() => copyThumb(tp.prompt, i)}
                    >
                      {copiedIndex === i ? 'Copied' : 'Copy'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Accordion>

      {/* ── Subtitles ────────────────────────────────────────────────────── */}
      <Accordion
        title="📝 Subtitles"
        open={openSection === 'subtitles'}
        onToggle={() => toggle('subtitles')}
        badge={rows.length ? <Badge tone="accent">{rows.length} blocks</Badge> : null}
      >
        <div className="flex flex-col gap-3">
          <Button
            block
            variant="secondary"
            size="sm"
            icon={busy === 'subtitles' ? Loader2 : Subtitles}
            loading={busy === 'subtitles'}
            onClick={runSubtitles}
          >
            {record.subtitles ? 'Re-chunk subtitles' : 'Generate subtitles'}
          </Button>

          <p className="text-[11px] text-faint leading-relaxed">
            The model only splits the text at clause boundaries — timings are computed in JS from
            the word count, which is deterministic, free, and correct.
          </p>

          {busy === 'subtitles' && <Skeleton className="h-24" />}

          {rows.length > 0 && busy !== 'subtitles' && (
            <>
              <div
                className="rounded-[var(--radius-md)] overflow-hidden"
                style={{ border: '1px solid var(--color-divider)' }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: 320 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-neutral-900)' }}>
                        <th className="px-2 py-1.5 eyebrow">#</th>
                        <th className="px-2 py-1.5 eyebrow">Timestamp</th>
                        <th className="px-2 py-1.5 eyebrow">Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.index} style={{ borderTop: '1px solid var(--color-divider)' }}>
                          <td className="px-2 py-1.5 text-[11px] text-faint tabular-nums align-top">
                            {r.index}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[10.5px] text-dim whitespace-nowrap align-top">
                            {srtTime(r.start).slice(3, 12)} → {srtTime(r.end).slice(3, 12)}
                          </td>
                          <td
                            className="px-2 py-1.5 text-[11.5px] leading-relaxed"
                            lang={record.config.language === 'en' ? 'en' : 'bn'}
                          >
                            {r.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Download}
                  className="flex-1"
                  onClick={() => exportAsSRT(record)}
                >
                  SRT
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Download}
                  className="flex-1"
                  onClick={() => exportAsVTT(record)}
                >
                  VTT
                </Button>
              </div>
            </>
          )}

          {rows.length === 0 && busy !== 'subtitles' && (
            <EmptyState
              icon={Subtitles}
              compact
              dashed
              title="No subtitles yet"
              description="Generate them once the script text is final — re-chunking after an edit is cheap."
            />
          )}
        </div>
      </Accordion>
    </div>
  )
}
