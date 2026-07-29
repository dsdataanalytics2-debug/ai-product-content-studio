import { useEffect, useState } from 'react'
import { Plus, Brain, CheckCircle2, Trash2, X } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { useBrandStore } from '../store/useBrandStore'
import { INDUSTRIES, WRITING_STYLES } from '../config/constants'
import { toast } from '../store/useToastStore'

/** Tag input — used for traits, forbidden words, and CTAs. */
function TagField({ label, hint, values, tone, onAdd, onRemove, placeholder }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    if (!draft.trim()) return
    onAdd(draft.trim())
    setDraft('')
  }

  const palette = {
    accent: { bg: 'var(--accent-wash)', fg: 'var(--color-accent-300)', bd: 'var(--accent-hairline)' },
    danger: {
      bg: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
      fg: 'var(--color-danger-text)',
      bd: 'color-mix(in srgb, var(--color-danger) 22%, transparent)',
    },
    success: {
      bg: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
      fg: 'var(--color-success-text)',
      bd: 'color-mix(in srgb, var(--color-success) 22%, transparent)',
    },
  }[tone]

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[12px] font-medium text-dim">{label}</p>
        {hint && <p className="text-[11px] text-faint mt-0.5">{hint}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[11.5px]"
            style={{ background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}` }}
          >
            {v}
            <button
              type="button"
              onClick={() => onRemove(v)}
              aria-label={`Remove ${v}`}
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          className="input text-[12.5px]"
        />
        <Button size="sm" variant="secondary" icon={Plus} onClick={commit} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

export default function BrandMemory() {
  const brands = useBrandStore((s) => s.brands)
  const activeBrandId = useBrandStore((s) => s.activeBrandId)
  const create = useBrandStore((s) => s.create)
  const update = useBrandStore((s) => s.update)
  const removeBrand = useBrandStore((s) => s.remove)
  const setActive = useBrandStore((s) => s.setActive)
  const addTo = useBrandStore((s) => s.addTo)
  const removeFrom = useBrandStore((s) => s.removeFrom)

  const [selectedId, setSelectedId] = useState(brands[0]?.id ?? null)
  const [pendingDelete, setPendingDelete] = useState(null)

  // Keep the selection valid when the list changes underneath it.
  useEffect(() => {
    if (brands.length === 0) setSelectedId(null)
    else if (!brands.some((b) => b.id === selectedId)) setSelectedId(brands[0].id)
  }, [brands, selectedId])

  const brand = brands.find((b) => b.id === selectedId) ?? null

  const addBrand = () => {
    const created = create({ name: `Brand ${brands.length + 1}` })
    setSelectedId(created.id)
  }

  return (
    <>
      <Navbar
        breadcrumb={['Brand Memory', brand?.name ?? 'No brand selected']}
        actions={
          <Button size="sm" icon={Plus} onClick={addBrand}>
            New brand
          </Button>
        }
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="w-[264px] shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--color-divider)' }}
        >
          <div className="scroll-y p-3 flex flex-col gap-2">
            {brands.length === 0 && (
              <p className="text-[11.5px] text-faint leading-relaxed p-2">
                No brands yet. A brand profile locks tone, forbidden words and preferred CTAs across
                every script you generate for it.
              </p>
            )}

            {brands.map((b) => {
              const selected = b.id === selectedId
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedId(b.id)}
                  className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-lg)] border text-left transition-colors"
                  style={{
                    background: selected ? 'var(--accent-wash)' : 'var(--color-surface)',
                    borderColor: selected ? 'var(--accent-hairline-strong)' : 'var(--color-divider)',
                  }}
                >
                  <span
                    className="grid place-items-center w-8 h-8 rounded-[9px] text-sm shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${b.colors[0] ?? '#9333EA'}, ${b.colors[1] ?? '#EC4899'})`,
                    }}
                    aria-hidden="true"
                  >
                    {b.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium truncate">{b.name}</p>
                    <p className="text-[11px] text-faint truncate">{b.industry}</p>
                    {b.id === activeBrandId && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] mt-1"
                        style={{ color: 'var(--color-accent-300)' }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0 scroll-y">
          {!brand ? (
            <EmptyState
              icon={Brain}
              title="No brand selected"
              description="Create a brand profile to keep tone, vocabulary and CTAs consistent — the difference between ten scripts and one voice."
              action={
                <Button icon={Plus} onClick={addBrand}>
                  Create a brand
                </Button>
              }
            />
          ) : (
            <div className="p-5 flex flex-col gap-5 max-w-[760px]">
              <section className="flex flex-col gap-3">
                <p className="eyebrow eyebrow-accent">Basics</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Brand name"
                    value={brand.name}
                    onChange={(name) => update(brand.id, { name })}
                  />
                  <Select
                    label="Industry"
                    value={brand.industry}
                    onChange={(industry) => update(brand.id, { industry })}
                    options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-medium text-dim">Brand colours</p>
                  <div className="flex items-center gap-2">
                    {[0, 1].map((i) => (
                      <input
                        key={i}
                        type="color"
                        value={brand.colors[i] ?? '#8B5CF6'}
                        aria-label={`Brand colour ${i + 1}`}
                        onChange={(e) => {
                          const colors = [...brand.colors]
                          colors[i] = e.target.value
                          update(brand.id, { colors })
                        }}
                        className="w-9 h-9 rounded-full cursor-pointer bg-transparent"
                        style={{ border: '1px solid var(--color-divider)' }}
                      />
                    ))}
                    <Input
                      value={brand.emoji}
                      onChange={(emoji) => update(brand.id, { emoji: emoji.slice(0, 2) })}
                      className="w-[72px]"
                      aria-label="Brand emoji"
                    />
                    <span className="text-[11px] text-faint">Colours and emoji are for this app only.</span>
                  </div>
                </div>
              </section>

              <hr className="divider" />

              <section className="flex flex-col gap-3">
                <p className="eyebrow eyebrow-accent">Voice &amp; tone</p>
                <Input
                  label="Tone description"
                  multiline
                  rows={2}
                  value={brand.tone}
                  onChange={(tone) => update(brand.id, { tone })}
                  placeholder="Warm, empowering and professional. We celebrate everyday confidence."
                  hint="This is passed to the model verbatim, so write it as a direction, not a slogan."
                />

                <div className="flex flex-col gap-2">
                  <p className="text-[12px] font-medium text-dim">Writing style</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WRITING_STYLES.map((style) => {
                      const active = brand.writingStyle === style
                      return (
                        <button
                          key={style}
                          type="button"
                          onClick={() => update(brand.id, { writingStyle: style })}
                          className="px-2.5 py-1.5 rounded-[var(--radius-md)] border text-[12px] font-medium transition-colors"
                          style={{
                            background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
                            borderColor: active
                              ? 'var(--accent-hairline-strong)'
                              : 'var(--color-divider)',
                            color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
                          }}
                        >
                          {style}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <TagField
                  label="Personality traits"
                  tone="accent"
                  values={brand.traits}
                  placeholder="e.g. Confident"
                  onAdd={(v) => addTo(brand.id, 'traits', v)}
                  onRemove={(v) => removeFrom(brand.id, 'traits', v)}
                />
              </section>

              <hr className="divider" />

              <section className="flex flex-col gap-4">
                <p className="eyebrow eyebrow-accent">Content rules</p>

                <TagField
                  label="Forbidden words"
                  hint="The model is told never to use these. Useful for words a brand has decided cheapen it."
                  tone="danger"
                  values={brand.forbiddenWords}
                  placeholder="e.g. সস্তা"
                  onAdd={(v) => addTo(brand.id, 'forbiddenWords', v)}
                  onRemove={(v) => removeFrom(brand.id, 'forbiddenWords', v)}
                />

                <TagField
                  label="Preferred CTAs"
                  hint="Phrases the brand already uses, so the close sounds like the rest of its marketing."
                  tone="success"
                  values={brand.preferredCTAs}
                  placeholder="e.g. অর্ডার করুন"
                  onAdd={(v) => addTo(brand.id, 'preferredCTAs', v)}
                  onRemove={(v) => removeFrom(brand.id, 'preferredCTAs', v)}
                />

                <Input
                  label="Required disclaimers"
                  multiline
                  rows={2}
                  value={brand.disclaimers}
                  onChange={(disclaimers) => update(brand.id, { disclaimers })}
                  placeholder="e.g. Results vary. Not a medical treatment."
                />
              </section>

              <div
                className="flex items-center gap-2 pt-4"
                style={{ borderTop: '1px solid var(--color-divider)' }}
              >
                <Button
                  variant={brand.id === activeBrandId ? 'secondary' : 'primary'}
                  icon={CheckCircle2}
                  disabled={brand.id === activeBrandId}
                  onClick={() => {
                    setActive(brand.id)
                    toast.success(`${brand.name} is now the default brand`)
                  }}
                >
                  {brand.id === activeBrandId ? 'Default brand' : 'Set as default'}
                </Button>
                <Button variant="ghost" icon={Trash2} onClick={() => setPendingDelete(brand)}>
                  Delete brand
                </Button>
                <p className="text-[11px] text-faint ml-auto">Changes save as you type.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this brand?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed. Scripts already generated with it keep their text — they just lose the link.`
            : ''
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => {
                removeBrand(pendingDelete.id)
                setPendingDelete(null)
                toast.info('Brand deleted')
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}
