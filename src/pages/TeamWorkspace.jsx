import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GripVertical,
  MessageCircle,
  MessageSquareWarning,
  Search,
  X,
  Clapperboard,
  ArrowRight,
} from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Input from '../components/ui/Input'
import EmptyState from '../components/ui/EmptyState'
import ScriptReviewPanel from '../components/script/ScriptReviewPanel'
import { makeMark, markLocation, resolveMark, openCount } from '../utils/reviewMarks'
import { useLibraryStore } from '../store/useLibraryStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { SCRIPT_STATUSES, statusMeta, languageMeta } from '../config/constants'
import { initials, relativeTime, formatDate } from '../utils/text'
import { toast } from '../store/useToastStore'

/**
 * A status board over the same library records — not a separate data model.
 * Dragging a card sets `status`, which is the same field the Studio's status
 * dropdown writes, so the two views can never disagree.
 *
 * "Team" is aspirational in an MVP with no backend: comments and assignees are
 * local to this browser. The UI says so rather than implying sync.
 */
export default function TeamWorkspace() {
  const records = useLibraryStore((s) => s.records)
  const patch = useLibraryStore((s) => s.patch)
  const profileName = useSettingsStore((s) => s.profileName)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return records
    return records.filter((r) =>
      `${r.title} ${(r.products ?? []).map((p) => p.name).join(' ')} ${r.assignee ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [records, query])

  const columns = SCRIPT_STATUSES.map((s) => ({
    ...s,
    cards: filtered.filter((r) => (r.status ?? 'draft') === s.value),
  }))

  const openCard = records.find((r) => r.id === openId) ?? null

  const moveTo = (id, status) => {
    const record = records.find((r) => r.id === id)
    if (!record || record.status === status) return

    patch(id, {
      status,
      activity: [
        ...(record.activity ?? []),
        { text: `Moved to ${statusMeta(status).label}`, when: new Date().toISOString() },
      ],
    })
  }

  /** Marks live on the record, so the Studio sees them when it opens the script. */
  const addMark = (record, path, note) => {
    patch(record.id, {
      marks: [...(record.marks ?? []), makeMark({ path, note, author: profileName })],
      activity: [
        ...(record.activity ?? []),
        { text: `Marked ${markLocation(path)}`, when: new Date().toISOString() },
      ],
    })
    toast.info('Note added', markLocation(path))
  }

  const resolveCardMark = (record, mark) => {
    patch(record.id, { marks: resolveMark(record.marks ?? [], mark.id) })
  }

  const addComment = () => {
    if (!commentDraft.trim() || !openCard) return
    patch(openCard.id, {
      comments: [
        ...(openCard.comments ?? []),
        { author: profileName, text: commentDraft.trim(), when: new Date().toISOString() },
      ],
    })
    setCommentDraft('')
  }

  const advance = () => {
    if (!openCard) return
    const order = SCRIPT_STATUSES.map((s) => s.value)
    const next = order[Math.min(order.length - 1, order.indexOf(openCard.status ?? 'draft') + 1)]
    if (next === openCard.status) {
      toast.info('Already published', 'This is the last stage on the board.')
      return
    }
    moveTo(openCard.id, next)
    toast.success(`Moved to ${statusMeta(next).label}`)
  }

  return (
    <>
      <Navbar
        breadcrumb={['Team Workspace', 'Board']}
        actions={
          <Button size="sm" icon={Clapperboard} onClick={() => navigate('/studio')}>
            New script
          </Button>
        }
      />

      <div
        className="flex items-center gap-2 px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <div className="relative w-[260px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the board…"
            aria-label="Search board"
            className="input text-[13px] pl-8"
          />
        </div>
        <p className="text-[11px] text-faint ml-auto">
          Local to this browser — there is no server, so nothing syncs to anyone else.
        </p>
      </div>

      {records.length === 0 ? (
        <div className="flex-1 grid place-items-center p-5">
          <EmptyState
            icon={Clapperboard}
            title="No scripts to track"
            description="Save a script from the Studio and it appears here as a card you can move through Draft → Review → Approved → Published."
            action={
              <Button icon={Clapperboard} onClick={() => navigate('/studio')}>
                Write a script
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto p-4">
          <div className="grid gap-3 h-full" style={{ gridTemplateColumns: 'repeat(4, minmax(258px, 1fr))' }}>
            {columns.map((col) => (
              <div
                key={col.value}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverColumn(col.value)
                }}
                onDragLeave={() => setDragOverColumn((c) => (c === col.value ? null : c))}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverColumn(null)
                  if (dragId) moveTo(dragId, col.value)
                  setDragId(null)
                }}
                className="card flex flex-col min-h-0 transition-colors"
                style={{
                  background:
                    dragOverColumn === col.value ? 'var(--accent-wash)' : 'var(--color-surface)',
                  borderColor:
                    dragOverColumn === col.value
                      ? 'var(--accent-hairline-strong)'
                      : 'var(--color-divider)',
                }}
              >
                <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
                  <span aria-hidden="true">{col.icon}</span>
                  <span className="text-[12.5px] font-semibold">{col.label}</span>
                  <Badge tone="neutral" className="ml-auto">
                    {col.cards.length}
                  </Badge>
                </div>
                <div className="h-[2px] mx-3 rounded-full shrink-0" style={{ background: col.color }} />

                <div className="scroll-y p-2.5 flex flex-col gap-2">
                  {col.cards.length === 0 && (
                    <p className="text-[11px] text-faint text-center py-6">
                      Drop a card here
                    </p>
                  )}

                  {col.cards.map((r) => (
                    <article
                      key={r.id}
                      draggable
                      onDragStart={() => setDragId(r.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setOpenId(r.id)}
                      className="rounded-[var(--radius-lg)] p-2.5 cursor-pointer transition-opacity"
                      style={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-divider)',
                        opacity: dragId === r.id ? 0.4 : 1,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical
                          className="w-3.5 h-3.5 shrink-0 mt-px cursor-grab text-faint"
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold leading-snug line-clamp-2">
                            {r.title}
                          </p>
                          <p className="text-[11px] text-faint mt-0.5 truncate">
                            {(r.products ?? []).map((p) => p.name).join(', ') || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge tone="neutral">{languageMeta(r.config?.language).label}</Badge>
                        <Badge tone="outline">{r.config?.videoType}</Badge>
                        {r.scheduledFor && (
                          <Badge tone="accent">{formatDate(r.scheduledFor)}</Badge>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-2 mt-2 pt-2"
                        style={{ borderTop: '1px solid var(--color-divider)' }}
                      >
                        <span
                          className="grid place-items-center w-5 h-5 rounded-full text-[9px] font-semibold shrink-0"
                          style={{ background: 'var(--color-accent-700)', color: '#fff' }}
                        >
                          {initials(r.assignee ?? profileName)}
                        </span>
                        <span className="text-[11px] text-dim flex-1 min-w-0 truncate">
                          {r.assignee ?? profileName}
                        </span>
                        {openCount(r.marks) > 0 && (
                          <span
                            className="flex items-center gap-1 text-[11px] shrink-0"
                            style={{ color: 'var(--color-warning-text)' }}
                            title={`${openCount(r.marks)} unresolved review note(s)`}
                          >
                            <MessageSquareWarning className="w-3 h-3" aria-hidden="true" />
                            {openCount(r.marks)}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-faint shrink-0">
                          <MessageCircle className="w-3 h-3" aria-hidden="true" />
                          {r.comments?.length ?? 0}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {openCard && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgb(0 0 0 / 0.5)' }}
            onClick={() => setOpenId(null)}
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 right-0 bottom-0 z-50 w-[min(420px,100vw)] flex flex-col animate-fade-up"
            style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-divider)' }}
            role="dialog"
            aria-label={openCard.title}
          >
            <header
              className="flex items-start gap-2.5 p-4 shrink-0"
              style={{ borderBottom: '1px solid var(--color-divider)' }}
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.015em]">
                  {openCard.title}
                </h2>
                <p className="text-[11.5px] text-faint mt-1">
                  {(openCard.products ?? []).map((p) => p.name).join(', ') || '—'} · updated{' '}
                  {relativeTime(openCard.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close"
                className="btn btn-ghost p-1.5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="scroll-y p-4 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="eyebrow">Status</span>
                <select
                  value={openCard.status ?? 'draft'}
                  onChange={(e) => moveTo(openCard.id, e.target.value)}
                  aria-label="Status"
                  className="input text-[12px] w-auto py-1.5"
                >
                  {SCRIPT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="eyebrow">Review</p>
                  <p className="text-[11px] text-faint">
                    Mark the block that has a problem — fix it in the Studio.
                  </p>
                </div>
                <ScriptReviewPanel
                  record={openCard}
                  onAddMark={(path, note) => addMark(openCard, path, note)}
                  onResolve={(mark) => resolveCardMark(openCard, mark)}
                />
              </div>

              <div>
                <p className="eyebrow mb-2">Comments ({openCard.comments?.length ?? 0})</p>
                <div className="flex gap-1.5 mb-3">
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addComment()}
                    placeholder="Write a note to yourself…"
                    aria-label="New comment"
                    className="input text-[12.5px]"
                  />
                  <Button size="sm" onClick={addComment} disabled={!commentDraft.trim()}>
                    Post
                  </Button>
                </div>

                <div className="flex flex-col gap-2.5">
                  {(openCard.comments ?? []).map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <span
                        className="grid place-items-center w-6 h-6 rounded-full text-[9px] font-semibold shrink-0"
                        style={{ background: 'var(--color-accent-700)', color: '#fff' }}
                      >
                        {initials(c.author)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px]">
                          <strong>{c.author}</strong>{' '}
                          <span className="text-faint text-[10.5px]">{relativeTime(c.when)}</span>
                        </p>
                        <p className="text-[12.5px] leading-relaxed text-body mt-0.5">{c.text}</p>
                      </div>
                    </div>
                  ))}
                  {(openCard.comments?.length ?? 0) === 0 && (
                    <p className="text-[11.5px] text-faint">No comments yet.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">Activity</p>
                <div className="flex flex-col gap-2">
                  {(openCard.activity ?? []).slice(-8).reverse().map((a, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: 'var(--color-accent-700)' }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] text-body leading-snug">{a.text}</p>
                        <p className="text-[10.5px] text-faint">{relativeTime(a.when)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer
              className="flex gap-2 p-3 shrink-0"
              style={{ borderTop: '1px solid var(--color-divider)' }}
            >
              <Button
                variant="secondary"
                size="sm"
                block
                onClick={() => navigate(`/studio?id=${openCard.id}`)}
              >
                Open in Studio
              </Button>
              <Button size="sm" block icon={ArrowRight} onClick={advance}>
                Advance
              </Button>
            </footer>
          </aside>
        </>
      )}
    </>
  )
}
