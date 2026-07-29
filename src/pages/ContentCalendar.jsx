import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, GripVertical, Undo2, CalendarDays, Clapperboard } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { useLibraryStore } from '../store/useLibraryStore'
import { SCRIPT_STATUSES, statusMeta } from '../config/constants'
import { formatDate } from '../utils/text'
import { toast } from '../store/useToastStore'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Local YYYY-MM-DD. toISOString() would shift the date across a timezone. */
const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Six-week grid, Monday-first, with leading/trailing days from adjacent months. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // JS weeks start Sunday; we start Monday
  const start = new Date(year, month, 1 - offset)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { date: d, iso: isoDay(d), inMonth: d.getMonth() === month }
  })
}

export default function ContentCalendar() {
  const records = useLibraryStore((s) => s.records)
  const patch = useLibraryStore((s) => s.patch)
  const navigate = useNavigate()

  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [view, setView] = useState('month')
  const [filter, setFilter] = useState('all')
  const [dragId, setDragId] = useState(null)
  const [dragOverDay, setDragOverDay] = useState(null)

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter((r) => (r.status ?? 'draft') === filter)),
    [records, filter],
  )

  const unscheduled = visible.filter((r) => !r.scheduledFor)
  const byDay = useMemo(() => {
    const map = new Map()
    for (const r of visible) {
      if (!r.scheduledFor) continue
      const list = map.get(r.scheduledFor) ?? []
      list.push(r)
      map.set(r.scheduledFor, list)
    }
    return map
  }, [visible])

  const schedule = (id, iso) => {
    patch(id, { scheduledFor: iso })
    toast.success(iso ? `Scheduled for ${formatDate(iso)}` : 'Moved back to unscheduled')
  }

  const monthLabel = new Date(cursor.year, cursor.month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const shiftMonth = (delta) => {
    const d = new Date(cursor.year, cursor.month + delta)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  const listDays = [...byDay.entries()]
    .filter(([iso]) => iso.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`))
    .sort(([a], [b]) => a.localeCompare(b))

  const Pill = ({ record, compact = false }) => {
    const meta = statusMeta(record.status)
    return (
      <div
        draggable
        onDragStart={() => setDragId(record.id)}
        onDragEnd={() => setDragId(null)}
        onClick={() => navigate(`/studio?id=${record.id}`)}
        title={record.title}
        className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer transition-opacity ${
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5'
        }`}
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-divider)',
          opacity: dragId === record.id ? 0.4 : 1,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: meta.color }}
          aria-hidden="true"
        />
        <span className="text-[10.5px] truncate flex-1 min-w-0">{record.title}</span>
      </div>
    )
  }

  return (
    <>
      <Navbar
        breadcrumb={['Content Calendar', monthLabel]}
        actions={
          <Button size="sm" icon={Clapperboard} onClick={() => navigate('/studio')}>
            New script
          </Button>
        }
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Unscheduled rail */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragId) schedule(dragId, null)
            setDragId(null)
          }}
          className="w-[248px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--color-divider)' }}
        >
          <div className="p-3.5 pb-2.5 shrink-0">
            <p className="text-[13px] font-semibold">Unscheduled</p>
            <p className="text-[11px] text-faint mt-0.5">Drag onto a day. Drop back here to unschedule.</p>

            <div className="flex gap-1 mt-3 flex-wrap">
              {[{ value: 'all', label: 'All' }, ...SCRIPT_STATUSES].map((f) => {
                const active = filter === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className="px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] font-medium transition-colors"
                    style={{
                      background: active ? 'var(--accent-wash)' : 'transparent',
                      borderColor: active ? 'var(--accent-hairline-strong)' : 'var(--color-divider)',
                      color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="scroll-y px-3 pb-3 flex flex-col gap-1.5">
            {unscheduled.length === 0 ? (
              <EmptyState
                compact
                dashed
                icon={CalendarDays}
                title="Nothing waiting"
                description={
                  records.length === 0
                    ? 'Save a script from the Studio to start planning it.'
                    : 'Everything visible is on the calendar.'
                }
              />
            ) : (
              unscheduled.map((r) => {
                const meta = statusMeta(r.status)
                return (
                  <div
                    key={r.id}
                    draggable
                    onDragStart={() => setDragId(r.id)}
                    onDragEnd={() => setDragId(null)}
                    className="flex items-start gap-1.5 p-2 rounded-[var(--radius-md)] cursor-grab transition-opacity"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-divider)',
                      opacity: dragId === r.id ? 0.4 : 1,
                    }}
                  >
                    <GripVertical className="w-3.5 h-3.5 shrink-0 mt-px text-faint" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium leading-snug line-clamp-2">{r.title}</p>
                      <Badge tone={meta.tone} className="mt-1.5">
                        {meta.label}
                      </Badge>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div
            className="flex items-center gap-2 px-4 py-2.5 shrink-0 flex-wrap"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="btn btn-ghost p-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[13.5px] font-semibold tracking-[-0.015em] min-w-[130px] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="btn btn-ghost p-1.5"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            >
              Today
            </Button>

            <div
              className="flex gap-0.5 p-0.5 rounded-[var(--radius-md)] ml-auto"
              style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
            >
              {['month', 'list'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className="px-2.5 py-1 rounded-[var(--radius-sm)] text-[11.5px] font-medium capitalize transition-colors"
                  style={{
                    background: view === v ? 'var(--color-surface-2)' : 'transparent',
                    color: view === v ? 'var(--color-text)' : 'var(--text-dim)',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view === 'month' ? (
            <div className="scroll-y p-4">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="eyebrow pl-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((cell) => {
                    const items = byDay.get(cell.iso) ?? []
                    const isToday = cell.iso === isoDay(today)
                    const isDropTarget = dragOverDay === cell.iso

                    return (
                      <div
                        key={cell.iso}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverDay(cell.iso)
                        }}
                        onDragLeave={() => setDragOverDay((d) => (d === cell.iso ? null : d))}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOverDay(null)
                          if (dragId) schedule(dragId, cell.iso)
                          setDragId(null)
                        }}
                        className="flex flex-col gap-1 p-1.5 rounded-[var(--radius-md)] min-h-[92px] transition-colors"
                        style={{
                          background: isDropTarget
                            ? 'var(--accent-wash)'
                            : cell.inMonth
                              ? 'var(--color-surface)'
                              : 'transparent',
                          border: `1px solid ${
                            isDropTarget ? 'var(--accent-hairline-strong)' : 'var(--color-divider)'
                          }`,
                          opacity: cell.inMonth ? 1 : 0.45,
                        }}
                      >
                        <span
                          className="text-[11px] font-medium tabular-nums shrink-0"
                          style={{
                            color: isToday ? 'var(--color-accent-300)' : 'var(--text-dim)',
                            fontWeight: isToday ? 700 : 500,
                          }}
                        >
                          {cell.date.getDate()}
                        </span>

                        <div className="flex flex-col gap-1 min-h-0 overflow-hidden">
                          {items.slice(0, 3).map((r) => (
                            <Pill key={r.id} record={r} compact />
                          ))}
                          {items.length > 3 && (
                            <span className="text-[10px] text-faint pl-1">
                              +{items.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-3.5">
                  {SCRIPT_STATUSES.map((s) => (
                    <span key={s.value} className="flex items-center gap-1.5 text-[11px] text-dim">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: s.color }}
                        aria-hidden="true"
                      />
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="scroll-y p-4">
              {listDays.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="Nothing scheduled this month"
                  description="Drag a script from the left rail onto a day to plan it."
                />
              ) : (
                listDays.map(([iso, items]) => (
                  <div key={iso} className="mb-4">
                    <div
                      className="flex items-baseline gap-2 pb-2 mb-2"
                      style={{ borderBottom: '1px solid var(--color-divider)' }}
                    >
                      <span className="text-[13px] font-semibold">{formatDate(iso)}</span>
                      <span className="text-[11px] text-faint">
                        {new Date(iso).toLocaleDateString(undefined, { weekday: 'long' })}
                      </span>
                      <span className="text-[11px] text-faint ml-auto">
                        {items.length} scheduled
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {items.map((r) => {
                        const meta = statusMeta(r.status)
                        return (
                          <div
                            key={r.id}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-lg)]"
                            style={{
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-divider)',
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: meta.color }}
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12.5px] font-medium truncate">{r.title}</p>
                              <p className="text-[11px] text-faint truncate">
                                {(r.products ?? []).map((p) => p.name).join(', ') || '—'}
                              </p>
                            </div>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Undo2}
                              onClick={() => schedule(r.id, null)}
                              aria-label={`Unschedule ${r.title}`}
                            >
                              Unschedule
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
