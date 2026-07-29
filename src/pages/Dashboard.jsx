import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  CheckCircle2,
  Mic,
  CalendarDays,
  Clapperboard,
  Package,
  Brain,
  ArrowRight,
} from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import SetupStatus from '../components/settings/SetupStatus'
import { useLibraryStore } from '../store/useLibraryStore'
import { statusMeta, SCRIPT_STATUSES } from '../config/constants'
import { relativeTime, formatDate } from '../utils/text'

function StatTile({ label, value, sublabel, Icon, tint }) {
  return (
    <div className="card elev-sm p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span
          className="grid place-items-center w-7 h-7 rounded-[var(--radius-md)] shrink-0"
          style={{ background: `color-mix(in srgb, ${tint} 14%, transparent)`, color: tint }}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="text-[30px] font-bold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="text-[11px] text-faint">{sublabel}</p>
    </div>
  )
}

/**
 * Status distribution as a stacked bar rather than a donut. With four
 * categories a donut needs a legend to be readable at all, and the bar already
 * carries the labels — one mark instead of two.
 */
function StatusBar({ byStatus, total }) {
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-neutral-800)' }}>
        {SCRIPT_STATUSES.map((s) => {
          const count = byStatus[s.value] ?? 0
          if (!count) return null
          return (
            <div
              key={s.value}
              style={{ width: `${(count / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${count}`}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {SCRIPT_STATUSES.map((s) => (
          <div key={s.value} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-[12px] text-dim flex-1">{s.label}</span>
            <span className="text-[12px] font-semibold tabular-nums">{byStatus[s.value] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Last 14 days of activity. Sparse data is the norm here, so bars stay visible at 1. */
function ActivityChart({ records }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })

  const counts = days.map(
    (day) => records.filter((r) => r.createdAt?.slice(0, 10) === day).length,
  )
  const peak = Math.max(1, ...counts)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 h-24">
        {counts.map((count, i) => (
          <div
            key={days[i]}
            className="flex-1 rounded-t-[3px] transition-[height]"
            title={`${formatDate(days[i])}: ${count} script${count === 1 ? '' : 's'}`}
            style={{
              height: `${Math.max(count ? 8 : 2, (count / peak) * 100)}%`,
              background: count ? 'var(--color-accent)' : 'var(--color-neutral-800)',
              minHeight: 3,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-faint">
        <span>{formatDate(days[0])}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const records = useLibraryStore((s) => s.records)
  const navigate = useNavigate()

  // Derived from `records` here rather than via a `s.stats()` selector: a
  // selector that builds a fresh object each call changes identity on every
  // render, and zustand compares snapshots by reference — that is an infinite
  // render loop, not a perf nit.
  const { stats, recent, upcoming } = useMemo(() => {
    const byStatus = records.reduce((acc, r) => {
      const key = r.status ?? 'draft'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return {
      stats: {
        total: records.length,
        byStatus,
        approved: byStatus.approved ?? 0,
        withVoice: records.filter((r) => r.hasVoice).length,
        scheduled: records.filter((r) => r.scheduledFor).length,
      },
      recent: [...records]
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(0, 5),
      upcoming: records
        .filter((r) => r.scheduledFor)
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        .slice(0, 6),
    }
  }, [records])

  const approvalRate = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0

  return (
    <>
      <Navbar
        breadcrumb={['Dashboard']}
        actions={
          <Button size="sm" icon={Clapperboard} onClick={() => navigate('/studio')}>
            New script
          </Button>
        }
      />

      <div className="scroll-y p-5 flex flex-col gap-3.5">
        {records.length === 0 ? (
          <div className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr] items-start">
            <Card>
              <EmptyState
                icon={Clapperboard}
                title="Nothing here yet"
                description="Pick a product, set the brief, and generate your first script. Everything you save shows up here — counts, recent work, and what is scheduled."
                action={
                  <Button icon={Clapperboard} onClick={() => navigate('/studio')}>
                    Write your first script
                  </Button>
                }
              />
            </Card>
            <SetupStatus />
          </div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Total scripts"
                value={stats.total}
                sublabel={`${records.filter((r) => isThisMonth(r.createdAt)).length} this month`}
                Icon={FileText}
                tint="var(--color-accent)"
              />
              <StatTile
                label="Approved"
                value={stats.approved}
                sublabel={`${approvalRate}% approval rate`}
                Icon={CheckCircle2}
                tint="var(--color-success)"
              />
              <StatTile
                label="With voice"
                value={stats.withVoice}
                sublabel={
                  stats.total ? `${Math.round((stats.withVoice / stats.total) * 100)}% of total` : '—'
                }
                Icon={Mic}
                tint="var(--color-info)"
              />
              <StatTile
                label="Scheduled"
                value={stats.scheduled}
                sublabel="On the calendar"
                Icon={CalendarDays}
                tint="var(--color-warning)"
              />
            </div>

            <div className="grid gap-3.5 lg:grid-cols-2">
              <Card title="Scripts by status">
                <StatusBar byStatus={stats.byStatus} total={stats.total} />
              </Card>
              <Card title="Scripts per day" subtitle="Last 14 days">
                <ActivityChart records={records} />
              </Card>
            </div>

            <div className="grid gap-3.5 lg:grid-cols-2">
              <Card
                title="Recent"
                actions={
                  <Link to="/library" className="text-[11.5px]">
                    View all
                  </Link>
                }
                padded={false}
              >
                <div className="flex flex-col">
                  {recent.map((r) => {
                    const meta = statusMeta(r.status)
                    return (
                      <Link
                        key={r.id}
                        to={`/studio?id=${r.id}`}
                        className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ borderTop: '1px solid var(--color-divider)', color: 'inherit' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium truncate">{r.title}</p>
                          <p className="text-[11px] text-faint truncate">
                            {(r.products ?? []).map((p) => p.name).join(', ') || '—'} ·{' '}
                            {relativeTime(r.updatedAt)}
                          </p>
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-faint" aria-hidden="true" />
                      </Link>
                    )
                  })}
                </div>
              </Card>

              <Card title="Upcoming" subtitle="Scheduled scripts" padded={false}>
                {upcoming.length === 0 ? (
                  <EmptyState
                    compact
                    icon={CalendarDays}
                    title="Nothing scheduled"
                    description="Drag a script onto a day in the Content Calendar to plan it."
                    action={
                      <Button size="sm" variant="secondary" onClick={() => navigate('/calendar')}>
                        Open calendar
                      </Button>
                    }
                  />
                ) : (
                  <div className="flex flex-col">
                    {upcoming.map((r) => {
                      const meta = statusMeta(r.status)
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-2.5 px-4 py-2.5"
                          style={{ borderTop: '1px solid var(--color-divider)' }}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: meta.color }}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium truncate">{r.title}</p>
                            <p className="text-[11px] text-faint">{formatDate(r.scheduledFor)}</p>
                          </div>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              <Button icon={Clapperboard} onClick={() => navigate('/studio')} className="py-3">
                New script
              </Button>
              <Button variant="secondary" icon={Package} onClick={() => navigate('/studio')} className="py-3">
                Browse products
              </Button>
              <Button variant="secondary" icon={Brain} onClick={() => navigate('/brands')} className="py-3">
                Manage brands
              </Button>
              <Button
                variant="secondary"
                icon={CalendarDays}
                onClick={() => navigate('/calendar')}
                className="py-3"
              >
                Open calendar
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function isThisMonth(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}
