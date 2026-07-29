import { useState } from 'react'
import {
  Copy,
  RotateCw,
  Save,
  Undo2,
  Camera,
  Loader2,
  Printer,
  Download,
  Check,
  FilePlus,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import ScriptBlock from './ScriptBlock'
import SceneCard, { SceneStoryboardCard } from './SceneCard'
import ReviewMarkList from './ReviewMarkList'
import VoicePanel from './VoicePanel'
import ToolsPanel from './ToolsPanel'
import ExportMenu from '../shared/ExportMenu'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import Select from '../ui/Select'
import { useScriptStore } from '../../store/useScriptStore'
import { useLibraryStore } from '../../store/useLibraryStore'
import { generate } from '../../services/aiService'
import {
  buildSceneRegenPrompt,
  buildShotListPrompt,
  buildSystemPrompt,
  buildPromptConfig,
} from '../../utils/promptBuilder'
import { languageMeta, SCRIPT_STATUSES, DURATIONS } from '../../config/constants'
import { formatCost } from '../../config/pricing'
import { copyToClipboard, scriptToText, exportShotListCSV } from '../../utils/exportUtils'
import { toast } from '../../store/useToastStore'
import { toAppError } from '../../utils/errors'
import { wordCount } from '../../utils/text'
import {
  partition,
  groupMarks,
  markContext,
  markKey,
  resolveMark,
  hookPath,
  ctaPath,
  scenePath,
} from '../../utils/reviewMarks'

const TABS = [
  { id: 'script', label: 'Script' },
  { id: 'scenes', label: 'Storyboard' },
  { id: 'shots', label: 'Shots' },
  { id: 'voice', label: 'Voice' },
  { id: 'tools', label: 'Tools' },
]

export function ScriptOutputSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <Skeleton className="h-[76px]" />
      <Skeleton className="h-[118px]" delay={0.2} />
      <Skeleton className="h-[118px]" delay={0.4} />
      <Skeleton className="h-[80px]" delay={0.6} />
    </div>
  )
}

export default function ScriptOutput({
  record,
  onRegenerate,
  onNew,
  expanded = false,
  onToggleExpand,
}) {
  const updateField = useScriptStore((s) => s.updateField)
  const replaceScene = useScriptStore((s) => s.replaceScene)
  const attach = useScriptStore((s) => s.attach)
  const setStatus = useScriptStore((s) => s.setStatus)
  const undo = useScriptStore((s) => s.undo)
  const canUndo = useScriptStore((s) => s.history.length > 0)
  const generation = useScriptStore((s) => s.generation)

  const save = useLibraryStore((s) => s.save)

  const [tab, setTab] = useState('script')
  const [regenIndex, setRegenIndex] = useState(null)
  const [shotsBusy, setShotsBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const language = record.config.language
  const lang = languageMeta(language).htmlLang

  const totalWords =
    wordCount(record.script.hook) +
    record.script.scenes.reduce((sum, s) => sum + wordCount(s.voiceover), 0) +
    wordCount(record.script.cta)

  const totalDuration = record.script.scenes.reduce((sum, s) => sum + s.duration_seconds, 0)

  const marks = record.marks ?? []
  const context = markContext(record)
  const { detached } = partition(marks, context)
  const grouped = groupMarks(marks, context)

  const marksAt = (path) => grouped.get(markKey(path)) ?? []

  const resolve = (mark) => {
    attach('marks', resolveMark(marks, mark.id))
    toast.info('Note resolved')
  }

  const regenerateScene = async (index, instruction) => {
    setRegenIndex(index)
    try {
      const promptConfig = buildPromptConfig(record.config)
      const { json } = await generate({
        system: buildSystemPrompt(promptConfig),
        prompt: buildSceneRegenPrompt(record.script, index, instruction),
      })
      // The model returns one scene object; keep its duration so the timeline
      // still adds up even if it ignored the instruction to preserve it.
      replaceScene(index, { ...json, duration_seconds: record.script.scenes[index].duration_seconds })
      toast.success(`Scene ${index + 1} rewritten`)
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      setRegenIndex(null)
    }
  }

  /**
   * The reviewer's note IS the rewrite instruction — which is why this feature
   * costs almost nothing to build. Resolve first: the note describes the text
   * about to be replaced, so leaving it open would pin stale feedback to new
   * copy.
   */
  const fixWithAi = async (mark) => {
    attach('marks', resolveMark(marks, mark.id))
    await regenerateScene(mark.path.index, mark.note)
  }

  const generateShots = async () => {
    setShotsBusy(true)
    try {
      const promptConfig = buildPromptConfig(record.config)
      const { json } = await generate({
        system: buildSystemPrompt(promptConfig),
        prompt: buildShotListPrompt(record.script),
      })
      attach('shots', json.shots ?? [])
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      setShotsBusy(false)
    }
  }

  const copyAll = async () => {
    if (await copyToClipboard(scriptToText(record))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  const saveToLibrary = () => {
    save(record)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    toast.success('Saved to Library', 'It will survive a reload — the working draft would not.')
  }

  let elapsed = 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <span
          className={`font-semibold flex-1 min-w-0 truncate ${expanded ? 'text-[16px]' : 'text-[13px]'}`}
        >
          {record.title}
        </span>
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Shrink to the side panel' : 'Open the script full size'}
            title={expanded ? 'Back to the side panel' : 'Read and edit full size'}
            className="btn btn-ghost p-1.5 shrink-0"
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
        <Badge tone="accent">{languageMeta(language).label}</Badge>
        <Badge tone="neutral">
          {DURATIONS.find((d) => d.value === record.config.durationSeconds)?.label ??
            `${record.config.durationSeconds}s`}
        </Badge>
      </div>

      {/* Meta strip — the honest numbers, not a vanity score. */}
      <div
        className="flex items-center gap-3 px-3.5 py-1.5 shrink-0 text-[10.5px] text-faint tabular-nums"
        style={{ background: 'var(--color-neutral-900)', borderBottom: '1px solid var(--color-divider)' }}
      >
        <span>{totalWords} words</span>
        <span>{totalDuration}s of scenes</span>
        <span>{record.script.scenes.length} scenes</span>
        {record.model && <span className="truncate">{record.model}</span>}
        <span className="ml-auto shrink-0">{formatCost(record.cost)}</span>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0.5 px-2 py-1.5 shrink-0 overflow-x-auto"
        style={{ background: 'var(--color-neutral-900)', borderBottom: '1px solid var(--color-divider)' }}
        role="tablist"
      >
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className="px-2.5 py-1.5 rounded-[var(--radius-md)] text-[12px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: active ? 'var(--color-surface-2)' : 'transparent',
                color: active ? 'var(--color-text)' : 'var(--text-dim)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className={`scroll-y ${expanded ? 'px-6 py-5' : 'p-3.5'}`} role="tabpanel">
        {tab === 'script' && (
          <div className="flex flex-col gap-2.5">
            {detached.length > 0 && (
              <div
                className="rounded-[var(--radius-lg)] p-3"
                style={{
                  background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
                }}
              >
                <p className="eyebrow mb-1">Detached notes</p>
                <p className="text-[11px] text-faint leading-relaxed">
                  The scenes these referred to no longer exist — a rewrite returned fewer.
                  Kept so the feedback is not lost silently.
                </p>
                <ReviewMarkList marks={detached} onResolve={resolve} showLocation />
              </div>
            )}

            <ScriptBlock
              label="Hook"
              emoji="🪝"
              value={record.script.hook}
              language={language}
              onEdit={(v) => updateField('script.hook', v)}
              markCount={marksAt(hookPath()).length}
              large={expanded}
            >
              {/* No AI fix: buildSceneRegenPrompt is scene-shaped, so hook and
                  CTA get inline editing and Resolve only. */}
              <ReviewMarkList marks={marksAt(hookPath())} onResolve={resolve} />
            </ScriptBlock>

            {record.script.scenes.map((scene, i) => {
              const startsAt = elapsed
              elapsed += scene.duration_seconds
              return (
                <SceneCard
                  key={i}
                  scene={scene}
                  index={i}
                  startsAt={startsAt}
                  language={language}
                  isRegenerating={regenIndex === i}
                  onEdit={(field, value) => updateField(`script.scenes.${i}.${field}`, value)}
                  onRegenerate={regenerateScene}
                  large={expanded}
                  markCountFor={(field) => marksAt(scenePath(i, field)).length}
                  renderMarks={(field) => (
                    <ReviewMarkList
                      marks={marksAt(scenePath(i, field))}
                      onResolve={resolve}
                      onFixWithAi={fixWithAi}
                      busy={regenIndex === i}
                    />
                  )}
                />
              )
            })}

            <ScriptBlock
              label="Call to action"
              emoji="💚"
              tone="cta"
              value={record.script.cta}
              language={language}
              onEdit={(v) => updateField('script.cta', v)}
              markCount={marksAt(ctaPath()).length}
              large={expanded}
            >
              <ReviewMarkList marks={marksAt(ctaPath())} onResolve={resolve} />
            </ScriptBlock>

            {record.script.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {record.script.hashtags.map((h) => (
                  <Badge key={h} tone="outline">
                    {h}
                  </Badge>
                ))}
              </div>
            )}

            {record.script.claims_used?.length > 0 && (
              <div
                className="p-2.5 rounded-[var(--radius-md)]"
                style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
              >
                <p className="eyebrow mb-1.5">Claims traced to product data</p>
                <ul className="flex flex-col gap-1">
                  {record.script.claims_used.map((c, i) => (
                    <li key={i} className="text-[11.5px] leading-relaxed text-dim" lang={lang}>
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'scenes' && (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto pb-1">
              <div className="flex items-stretch" style={{ minWidth: 'max-content' }}>
                {record.script.scenes.map((scene, i) => {
                  const startsAt = elapsed
                  elapsed += scene.duration_seconds
                  return (
                    <SceneStoryboardCard
                      key={i}
                      scene={scene}
                      index={i}
                      startsAt={startsAt}
                      language={language}
                      isLast={i === record.script.scenes.length - 1}
                    />
                  )
                })}
              </div>
            </div>
            <p className="text-[11px] text-faint">
              Scroll sideways. Edit scene text on the Script tab — this view is for judging pacing.
            </p>
          </div>
        )}

        {tab === 'shots' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                icon={shotsBusy ? Loader2 : Camera}
                loading={shotsBusy}
                onClick={generateShots}
              >
                {record.shots ? 'Regenerate shot list' : 'Generate shot list'}
              </Button>
              {record.shots?.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={() => exportShotListCSV(record)}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Printer}
                    className="no-print"
                    onClick={() => window.print()}
                  >
                    Print
                  </Button>
                </>
              )}
            </div>

            {shotsBusy && (
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8" delay={i * 0.15} />
                ))}
              </div>
            )}

            {!shotsBusy && record.shots?.length > 0 && (
              <div
                className="rounded-[var(--radius-md)] overflow-x-auto"
                style={{ border: '1px solid var(--color-divider)' }}
              >
                <table className="text-left" style={{ minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-neutral-900)' }}>
                      {['Scene', 'Shot', 'Type', 'Angle', 'Movement', 'Subject', 'Props', 'Location', 'B-roll', 'Notes'].map(
                        (h) => (
                          <th key={h} className="px-2 py-1.5 eyebrow whitespace-nowrap">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {record.shots.map((s, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-divider)' }}>
                        <td className="px-2 py-1.5 text-[11.5px] tabular-nums">{s.scene}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.shot}</td>
                        <td className="px-2 py-1.5">
                          <Badge tone="accent">{s.type}</Badge>
                        </td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.angle}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.movement}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.subject}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.props}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.location}</td>
                        <td className="px-2 py-1.5 text-[11.5px]">{s.broll}</td>
                        <td className="px-2 py-1.5 text-[11.5px] text-dim">{s.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!shotsBusy && !record.shots && (
              <EmptyState
                icon={Camera}
                compact
                dashed
                title="No shot list yet"
                description="A per-scene breakdown of shot type, angle, movement and props — the thing you actually take to the shoot."
              />
            )}
          </div>
        )}

        {tab === 'voice' && <VoicePanel record={record} />}
        {tab === 'tools' && <ToolsPanel record={record} />}
      </div>

      {/* Action bar.
          Wraps deliberately: six controls with `white-space: nowrap` do not fit
          the 400px output column, and the column clips overflow rather than
          scrolling it — which silently hid Save and Export off the right edge.
          Wrapping costs a second row and guarantees every action stays reachable
          however the labels change. */}
      <div
        className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 shrink-0 no-print"
        style={{ background: 'var(--color-neutral-900)', borderTop: '1px solid var(--color-divider)' }}
      >
        <Select
          value={record.status}
          onChange={setStatus}
          aria-label="Script status"
          className="w-[124px]"
          options={SCRIPT_STATUSES.map((s) => ({ value: s.value, label: `${s.icon} ${s.label}` }))}
        />

        <Button
          size="sm"
          variant="ghost"
          icon={Undo2}
          disabled={!canUndo}
          onClick={() => undo() && toast.info('Undone')}
          title="Undo last edit"
        >
          Undo
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={copied ? Check : Copy}
          onClick={copyAll}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={RotateCw}
          loading={generation.status === 'generating'}
          onClick={onRegenerate}
        >
          Regen
        </Button>
        {/* Everything already auto-saves; this is a manual re-save for
            reassurance, and the confirmation people expect from a Save button. */}
        <Button size="sm" variant="secondary" icon={saved ? Check : Save} onClick={saveToLibrary}>
          {saved ? 'Saved' : 'Save'}
        </Button>
        {onNew && (
          <Button
            size="sm"
            variant="ghost"
            icon={FilePlus}
            onClick={onNew}
            title="Start a separate script — this one stays in the Library"
          >
            New
          </Button>
        )}
        <ExportMenu record={record} size="sm" />
      </div>
    </div>
  )
}
