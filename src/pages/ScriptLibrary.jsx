import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Library as LibraryIcon, Copy, Trash2, Pencil, Clapperboard } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import ExportMenu from '../components/shared/ExportMenu'
import { useLibraryStore } from '../store/useLibraryStore'
import { SCRIPT_STATUSES, LANGUAGES, statusMeta, languageMeta } from '../config/constants'
import { relativeTime, wordCount } from '../utils/text'
import { toast } from '../store/useToastStore'

export default function ScriptLibrary() {
  const records = useLibraryStore((s) => s.records)
  const search = useLibraryStore((s) => s.search)
  const remove = useLibraryStore((s) => s.remove)
  const duplicate = useLibraryStore((s) => s.duplicate)

  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [language, setLanguage] = useState('all')
  const [pendingDelete, setPendingDelete] = useState(null)

  // `records` is in the dep list because `search` reads the store — without it
  // the list would not refresh after a delete.
  const results = useMemo(
    () => search({ q: query, status, language }),
    [query, status, language, search, records],
  )

  const confirmDelete = () => {
    remove(pendingDelete.id)
    toast.info('Script deleted', `“${pendingDelete.title}” is gone. There is no undo for this one.`)
    setPendingDelete(null)
  }

  return (
    <>
      <Navbar
        breadcrumb={['Library']}
        actions={
          <Button size="sm" icon={Clapperboard} onClick={() => navigate('/studio')}>
            New script
          </Button>
        }
      />

      <div
        className="flex flex-wrap items-center gap-2 px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
      >
        <div className="relative flex-1 min-w-[220px] max-w-[380px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, hooks, product names…"
            aria-label="Search library"
            className="input text-[13px] pl-8"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="input text-[13px] w-[140px]"
        >
          <option value="all">All statuses</option>
          {SCRIPT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Filter by language"
          className="input text-[13px] w-[140px]"
        >
          <option value="all">All languages</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.icon} {l.label}
            </option>
          ))}
        </select>

        <span className="text-[11.5px] text-faint ml-auto tabular-nums">
          {results.length} of {records.length}
        </span>
      </div>

      <div className="scroll-y p-5">
        {records.length === 0 && (
          <EmptyState
            icon={LibraryIcon}
            title="Your library is empty"
            description="Scripts you save from the Studio land here. They persist in this browser — export a backup from Settings if you care about them surviving a cache clear."
            action={
              <Button icon={Clapperboard} onClick={() => navigate('/studio')}>
                Write a script
              </Button>
            }
          />
        )}

        {records.length > 0 && results.length === 0 && (
          <EmptyState
            icon={Search}
            title="Nothing matches"
            description="Try a shorter search, or reset the status and language filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                  setLanguage('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}

        {results.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => {
              const meta = statusMeta(r.status)
              const words =
                wordCount(r.script?.hook ?? '') +
                (r.script?.scenes ?? []).reduce((sum, s) => sum + wordCount(s.voiceover), 0)

              return (
                <article key={r.id} className="card elev-sm p-3.5 flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[13px] font-semibold leading-snug line-clamp-2">
                        {r.title}
                      </h2>
                      <p className="text-[11px] text-faint mt-1 truncate">
                        {(r.products ?? []).map((p) => p.name).join(', ') || 'No products recorded'}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>

                  <p
                    className="text-[12px] leading-relaxed line-clamp-3 text-dim"
                    lang={languageMeta(r.config?.language).htmlLang}
                  >
                    {r.script?.hook}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="outline">{languageMeta(r.config?.language).label}</Badge>
                    <Badge tone="outline">{r.config?.videoType}</Badge>
                    <Badge tone="outline">{r.config?.durationSeconds}s</Badge>
                    <Badge tone="neutral">{words} words</Badge>
                  </div>

                  <p className="text-[11px] text-faint">Updated {relativeTime(r.updatedAt)}</p>

                  <div
                    className="flex items-center gap-1.5 pt-2.5 mt-auto"
                    style={{ borderTop: '1px solid var(--color-divider)' }}
                  >
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => navigate(`/studio?id=${r.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={Copy}
                      onClick={() => {
                        duplicate(r.id)
                        toast.success('Duplicated')
                      }}
                      aria-label={`Duplicate ${r.title}`}
                    >
                      Copy
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => setPendingDelete(r)}
                      aria-label={`Delete ${r.title}`}
                    >
                      Delete
                    </Button>
                    <div className="ml-auto">
                      <ExportMenu record={r} size="sm" formats={['txt', 'docx', 'pdf', 'json']} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this script?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed from this browser permanently. Export it first if you might want it back.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}
