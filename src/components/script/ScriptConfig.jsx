import { useState } from 'react'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import OptionCard from '../ui/OptionCard'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import PromptChips from './PromptChips'
import { useScriptStore } from '../../store/useScriptStore'
import { useBrandStore } from '../../store/useBrandStore'
import {
  VIDEO_TYPES,
  TONES,
  LANGUAGES,
  DURATIONS,
  VOICE_SCOPES,
  PROMPT_MAX_CHARS,
  OFFER_TYPES,
  PRICE_EMPHASIS,
  URGENCY_LEVELS,
  OCCASIONS,
  AWARENESS_STAGES,
  AGE_RANGES,
  GENDERS,
  LOCATIONS,
} from '../../config/constants'
import { generate } from '../../services/aiService'
import { buildEnhancePromptPrompt } from '../../utils/promptBuilder'
import { toAppError } from '../../utils/errors'
import { toast } from '../../store/useToastStore'

function Section({ label, children, action }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

/** Small pill selector — used where a grid of cards would be too heavy. */
function Chips({ options, value, onChange, columns }) {
  return (
    <div
      className={columns ? 'grid gap-1.5' : 'flex flex-wrap gap-1.5'}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      role="radiogroup"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="px-2.5 py-1.5 rounded-[var(--radius-md)] border text-[12px] font-medium transition-colors"
            style={{
              background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
              borderColor: active ? 'var(--accent-hairline-strong)' : 'var(--color-divider)',
              color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
            }}
          >
            {o.icon ? `${o.icon} ${o.label}` : o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ScriptConfig({ onGenerate }) {
  const config = useScriptStore((s) => s.config)
  const setConfig = useScriptStore((s) => s.setConfig)
  const selectedProducts = useScriptStore((s) => s.selectedProducts)
  const generation = useScriptStore((s) => s.generation)
  const wordBudget = useScriptStore((s) => s.wordBudget())

  const brands = useBrandStore((s) => s.brands)
  const [enhancing, setEnhancing] = useState(false)

  const generating = generation.status === 'generating'
  const comparisonNeedsTwo = config.videoType === 'comparison' && selectedProducts.length < 2
  const onSaleCount = selectedProducts.filter((p) => p.salePrice).length

  const enhancePrompt = async () => {
    if (!config.userPrompt.trim()) return
    setEnhancing(true)
    try {
      const { text } = await generate({
        system: 'You are a concise creative director. Return plain text only.',
        prompt: buildEnhancePromptPrompt(config.userPrompt, config),
        json: false,
      })
      const cleaned = text.trim().replace(/^["']|["']$/g, '').slice(0, PROMPT_MAX_CHARS)
      if (cleaned) setConfig({ userPrompt: cleaned })
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      setEnhancing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[13px] font-semibold">Script configuration</h2>

      <Section label="Video type">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Video type">
          {VIDEO_TYPES.map((t) => (
            <OptionCard
              key={t.value}
              icon={t.icon}
              label={t.label}
              selected={config.videoType === t.value}
              onClick={() => setConfig({ videoType: t.value })}
            />
          ))}
        </div>
        {/* The catalogue already knows which products carry a real discount, so
            there is no reason to make the user work it out. */}
        {onSaleCount > 0 && config.videoType !== 'promo' && (
          <button
            type="button"
            onClick={() => setConfig({ videoType: 'promo' })}
            className="text-[11px] leading-relaxed text-left underline"
            style={{ color: 'var(--color-accent-300)' }}
          >
            {onSaleCount === 1
              ? 'This product is on sale'
              : `${onSaleCount} of your products are on sale`}{' '}
            — use Promotional to build the script around the offer.
          </button>
        )}
        {comparisonNeedsTwo && (
          <p className="text-[11.5px]" style={{ color: 'var(--color-warning-text)' }}>
            A comparison needs at least two products — pick another, or switch type.
          </p>
        )}
      </Section>

      <hr className="divider" />

      <Section label="Tone">
        <Chips options={TONES} value={config.tone} onChange={(tone) => setConfig({ tone })} />
      </Section>

      <hr className="divider" />

      <div className="grid grid-cols-2 gap-4">
        <Section label="Language">
          <Chips
            options={LANGUAGES}
            value={config.language}
            onChange={(language) => setConfig({ language })}
            columns={1}
          />
        </Section>

        <Section label="Duration">
          <Chips
            options={DURATIONS}
            value={config.durationSeconds}
            onChange={(durationSeconds) => setConfig({ durationSeconds })}
            columns={2}
          />
          <p className="text-[11px] text-faint">
            ≈ {wordBudget} words of voiceover
          </p>
        </Section>
      </div>

      <hr className="divider" />

      <Section label="Delivery">
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Delivery">
          {VOICE_SCOPES.map((s) => (
            <OptionCard
              key={s.value}
              compact
              icon={s.icon}
              label={s.label}
              selected={config.voiceScope === s.value}
              onClick={() => setConfig({ voiceScope: s.value })}
            />
          ))}
        </div>
      </Section>

      <hr className="divider" />

      <Section label="Customer">
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Age"
            value={config.ageRange}
            onChange={(ageRange) => setConfig({ ageRange })}
            options={AGE_RANGES}
          />
          <Select
            label="Gender"
            value={config.gender}
            onChange={(gender) => setConfig({ gender })}
            options={GENDERS}
          />
          <Select
            label="Location"
            value={config.location}
            onChange={(location) => setConfig({ location })}
            options={LOCATIONS}
          />
          <Select
            label="Knows the product?"
            value={config.awareness}
            onChange={(awareness) => setConfig({ awareness })}
            options={AWARENESS_STAGES}
          />
        </div>

        <Input
          label="Main problem they have"
          value={config.painPoint}
          onChange={(painPoint) => setConfig({ painPoint })}
          placeholder="e.g. hair falls out after every wash"
          hint="Given one, the script opens on this instead of a generic hook."
        />

        <Input
          label="Anything else about them"
          multiline
          rows={2}
          value={config.targetAudience}
          onChange={(targetAudience) => setConfig({ targetAudience })}
          placeholder="e.g. already buys skincare online, price-conscious"
          hint="Left blank, the fields above are used on their own."
        />
      </Section>

      <Section label="Promotion">
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Offer"
            value={config.offerType}
            onChange={(offerType) => setConfig({ offerType })}
            options={OFFER_TYPES}
          />
          <Select
            label="Occasion"
            value={config.occasion}
            onChange={(occasion) => setConfig({ occasion })}
            options={OCCASIONS}
          />
          <Select
            label="Price"
            value={config.priceEmphasis}
            onChange={(priceEmphasis) => setConfig({ priceEmphasis })}
            options={PRICE_EMPHASIS}
          />
          <Select
            label="Urgency"
            value={config.urgency}
            onChange={(urgency) => setConfig({ urgency })}
            options={URGENCY_LEVELS}
          />
        </div>
        {config.offerType !== 'none' && (
          <p className="text-[11px] text-faint leading-relaxed">
            Only used if the synced product data actually shows this offer. The script will never
            invent a discount or deadline that your shop is not running.
          </p>
        )}
      </Section>

      <Select
        label="Brand profile"
        value={config.brandId ?? ''}
        onChange={(brandId) => setConfig({ brandId: brandId || null })}
        options={[
          { value: '', label: 'No brand — neutral seller voice' },
          ...brands.map((b) => ({ value: b.id, label: `${b.emoji} ${b.name}` })),
        ]}
        hint={brands.length === 0 ? 'Create one in Brand Memory to lock tone across scripts.' : undefined}
      />

      <hr className="divider" />

      <Section
        label="Your direction to the AI"
        action={
          <button
            type="button"
            onClick={enhancePrompt}
            disabled={!config.userPrompt.trim() || enhancing}
            className="btn btn-ghost text-[11px] px-2 py-1 disabled:opacity-40"
          >
            {enhancing ? (
              <Loader2 className="w-3 h-3 animate-spin-slow" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            Enhance
          </button>
        }
      >
        <textarea
          value={config.userPrompt}
          onChange={(e) => setConfig({ userPrompt: e.target.value.slice(0, PROMPT_MAX_CHARS) })}
          maxLength={PROMPT_MAX_CHARS}
          rows={3}
          aria-label="Direction to the AI"
          placeholder="AI কে বলো কেমন script চাও… e.g. emotional script for mothers, strong hook, urgency CTA"
          className="input text-[13px] resize-y"
        />
        <PromptChips
          value={config.userPrompt}
          onApply={(userPrompt) => setConfig({ userPrompt })}
        />
      </Section>

      <Button
        size="lg"
        block
        icon={Sparkles}
        loading={generating}
        disabled={selectedProducts.length === 0 || comparisonNeedsTwo}
        onClick={() => onGenerate(config)}
        className={generating ? '' : 'animate-glow'}
      >
        {generating ? 'Generating…' : 'Generate script'}
      </Button>
    </div>
  )
}
