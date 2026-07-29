import { useState } from 'react'
import { Copy, Check, Bug, Palette, KeyRound, Database, Cpu } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Toggle from '../components/ui/Toggle'
import Badge from '../components/ui/Badge'
import ApiKeyCard from '../components/settings/ApiKeyCard'
import SetupStatus from '../components/settings/SetupStatus'
import StoreSync from '../components/settings/StoreSync'
import DangerZone from '../components/settings/DangerZone'
import { useApiStore } from '../store/useApiStore'
import { useSettingsStore, debug } from '../store/useSettingsStore'
import { PROVIDERS, PROVIDER_ORDER, VOICE_PROVIDERS } from '../config/models'
import { ACCENT_PRESETS, FONT_SCALES } from '../config/constants'
import { PRICING } from '../config/pricing'
import { testProvider } from '../services/aiService'
import { testVoiceKey } from '../services/voiceService'
import { copyToClipboard } from '../utils/exportUtils'
import { toast } from '../store/useToastStore'

const TABS = [
  { id: 'keys', label: 'API keys', Icon: KeyRound },
  { id: 'ai', label: 'AI behaviour', Icon: Cpu },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'data', label: 'Data & debug', Icon: Database },
]

export default function Settings() {
  const [tab, setTab] = useState('keys')

  const setTestResult = useApiStore((s) => s.setTestResult)

  const settings = useSettingsStore()
  const setSettings = useSettingsStore((s) => s.set)
  const setProvider = useSettingsStore((s) => s.setProvider)
  const setNotification = useSettingsStore((s) => s.setNotification)
  const toggleDebug = useSettingsStore((s) => s.toggleDebug)

  const [copiedLog, setCopiedLog] = useState(false)

  const runProviderTest = async (keyName) => {
    const provider = PROVIDER_ORDER.find((p) => PROVIDERS[p].keyName === keyName)
    if (!provider) return
    const result = await testProvider(provider)
    setTestResult(keyName, result)
    if (result.status === 'ok') toast.success(`${PROVIDERS[provider].label} key works`)
    else toast.error(`${PROVIDERS[provider].label} key rejected`, result.message)
  }

  /** Voice keys verify against a free listing endpoint — see testVoiceKey. */
  const runVoiceTest = async (keyName) => {
    const provider = Object.keys(VOICE_PROVIDERS).find(
      (p) => VOICE_PROVIDERS[p].keyName === keyName,
    )
    if (!provider) return
    const result = await testVoiceKey(provider)
    setTestResult(keyName, result)
    if (result.status === 'ok') toast.success(`${VOICE_PROVIDERS[provider].label} key works`, result.message)
    else toast.error(`${VOICE_PROVIDERS[provider].label} key rejected`, result.message)
  }

  const copyDebugLog = async () => {
    if (await copyToClipboard(debug.asText())) {
      setCopiedLog(true)
      setTimeout(() => setCopiedLog(false), 1800)
    }
  }

  const providerModels = PROVIDERS[settings.preferredProvider]?.models ?? []

  return (
    <>
      <Navbar breadcrumb={['Settings', TABS.find((t) => t.id === tab).label]} />

      <div
        className="flex gap-0.5 px-5 py-2 shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--color-divider)' }}
        role="tablist"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[12.5px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: active ? 'var(--accent-wash)' : 'transparent',
                color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
              }}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      <div className="scroll-y p-5" role="tabpanel">
        {/* ── API keys ─────────────────────────────────────────────────── */}
        {tab === 'keys' && (
          <div className="grid gap-3.5 xl:grid-cols-[1fr_300px] items-start max-w-[1180px]">
            <div className="flex flex-col gap-3.5">
              <div className="grid gap-3 lg:grid-cols-2">
                {PROVIDER_ORDER.map((id) => {
                  const p = PROVIDERS[id]
                  return (
                    <ApiKeyCard
                      key={id}
                      keyName={p.keyName}
                      label={p.label}
                      role={p.role}
                      emoji={p.emoji}
                      hint={p.keyHint}
                      docsUrl={p.docsUrl}
                      onTest={runProviderTest}
                    />
                  )
                })}

                <ApiKeyCard
                  keyName="elevenLabsKey"
                  label={VOICE_PROVIDERS.elevenlabs.label}
                  role="Realistic voice generation"
                  emoji="🎙️"
                  hint="Only needed to download MP3s. Previews use free browser TTS."
                  docsUrl="https://elevenlabs.io/app/settings/api-keys"
                  onTest={runVoiceTest}
                />
                <ApiKeyCard
                  keyName="googleTtsKey"
                  label={VOICE_PROVIDERS.googletts.label}
                  role="Multi-language voice"
                  emoji="🔊"
                  hint="A Google Cloud API key (AIzaSy…) with the Text-to-Speech API enabled. Not a service-account JSON file."
                  docsUrl="https://console.cloud.google.com/apis/credentials"
                  onTest={runVoiceTest}
                />
              </div>

              <StoreSync />
            </div>

            <SetupStatus />
          </div>
        )}

        {/* ── AI behaviour ─────────────────────────────────────────────── */}
        {tab === 'ai' && (
          <div className="flex flex-col gap-3.5 max-w-[720px]">
            <Card title="Provider and model">
              <div className="flex flex-col gap-3">
                <Select
                  label="Preferred provider"
                  value={settings.preferredProvider}
                  onChange={setProvider}
                  options={PROVIDER_ORDER.map((id) => ({
                    value: id,
                    label: `${PROVIDERS[id].emoji} ${PROVIDERS[id].label}`,
                  }))}
                />

                <Select
                  label="Model"
                  value={settings.model}
                  onChange={(model) => setSettings({ model })}
                  options={providerModels.map((m) => ({ value: m.id, label: m.label }))}
                  hint={
                    PRICING[settings.model]?.in
                      ? `$${PRICING[settings.model].in}/M input · $${PRICING[settings.model].out}/M output`
                      : 'Cost tracking not configured for this model — see config/pricing.js.'
                  }
                />

                <div className="flex items-start gap-3 pt-1">
                  <Toggle
                    checked={settings.autoFallback}
                    onChange={(autoFallback) => setSettings({ autoFallback })}
                    label="Automatic provider fallback"
                  />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium">Automatic fallback</p>
                    <p className="text-[11.5px] text-faint leading-relaxed mt-0.5">
                      If the preferred provider errors or is rate limited, try the next configured
                      one. A rejected key never falls back — that is a setup problem you should see.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title="Reasoning effort"
              subtitle="Claude only. Higher effort means more thorough scripts and more tokens."
            >
              <div className="flex flex-wrap gap-1.5">
                {['low', 'medium', 'high', 'xhigh', 'max'].map((level) => {
                  const active = settings.effort === level
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSettings({ effort: level })}
                      className="px-3 py-1.5 rounded-[var(--radius-md)] border text-[12px] font-medium transition-colors"
                      style={{
                        background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
                        borderColor: active
                          ? 'var(--accent-hairline-strong)'
                          : 'var(--color-divider)',
                        color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
                      }}
                    >
                      {level}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11.5px] text-faint leading-relaxed mt-3">
                <strong>high</strong> is the default and the right answer for most scripts. Drop to{' '}
                <strong>low</strong> for quick drafts; <strong>max</strong> is rarely worth it here —
                a 60-second script is not a hard reasoning problem.
              </p>
            </Card>

            <Card title="Notifications" subtitle="In-app only — there is no server to send from.">
              <div className="flex flex-col">
                {[
                  ['generated', 'Script finished generating', 'A toast when a generation completes.'],
                  ['apiErrors', 'API errors', 'Provider failures and rejected keys.'],
                  ['calendar', 'Calendar reminders', 'When something scheduled is due today.'],
                  ['weekly', 'Weekly summary', 'A count of what you produced this week.'],
                ].map(([id, label, detail], i) => (
                  <div
                    key={id}
                    className="flex items-center gap-3 py-2.5"
                    style={{ borderTop: i ? '1px solid var(--color-divider)' : 'none' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-medium">{label}</p>
                      <p className="text-[11px] text-faint mt-0.5">{detail}</p>
                    </div>
                    <Toggle
                      checked={settings.notifications[id]}
                      onChange={(v) => setNotification(id, v)}
                      label={label}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── Appearance ───────────────────────────────────────────────── */}
        {tab === 'appearance' && (
          <div className="flex flex-col gap-3.5 max-w-[720px]">
            <Card title="Theme" subtitle="How Content Studio looks on this device.">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['dark', 'Dark', 'Default. Easier for long sessions.'],
                  ['light', 'Light', 'For bright rooms.'],
                  ['system', 'System', 'Follow the OS setting.'],
                ].map(([value, label, hint]) => {
                  const active = settings.theme === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSettings({ theme: value })}
                      className="flex flex-col items-start gap-1 p-3 rounded-[var(--radius-lg)] border text-left transition-colors"
                      style={{
                        background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
                        borderColor: active
                          ? 'var(--accent-hairline-strong)'
                          : 'var(--color-divider)',
                      }}
                    >
                      <span className="text-[12.5px] font-semibold">{label}</span>
                      <span className="text-[11px] text-faint leading-snug">{hint}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            <Card
              title="Accent colour"
              subtitle="Used for highlights, active states and primary buttons — the whole ramp derives from this one value."
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                {ACCENT_PRESETS.map((hex) => {
                  const active = settings.accent.toUpperCase() === hex.toUpperCase()
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSettings({ accent: hex })}
                      aria-label={`Accent ${hex}`}
                      className="grid place-items-center w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: hex,
                        outline: active ? `2px solid ${hex}` : 'none',
                        outlineOffset: 2,
                      }}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </button>
                  )
                })}
                <span className="w-px h-6 mx-1" style={{ background: 'var(--color-divider)' }} />
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(e) => setSettings({ accent: e.target.value })}
                  aria-label="Custom accent colour"
                  className="w-7 h-7 rounded-full cursor-pointer bg-transparent"
                  style={{ border: '1px solid var(--color-divider)' }}
                />
                <input
                  value={settings.accent}
                  onChange={(e) => {
                    const v = e.target.value
                    // Only commit a complete hex — a partial one would blank the
                    // entire accent ramp on every keystroke.
                    if (/^#[0-9a-f]{6}$/i.test(v)) setSettings({ accent: v })
                  }}
                  aria-label="Accent hex"
                  className="input font-mono text-[12px] uppercase w-[110px]"
                  defaultValue={settings.accent}
                />
              </div>
            </Card>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Card title="Font size">
                <div className="flex gap-1.5">
                  {FONT_SCALES.map((f) => {
                    const active = settings.fontScale === f.value
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setSettings({ fontScale: f.value })}
                        className="flex-1 px-2 py-1.5 rounded-[var(--radius-md)] border text-[12px] font-medium transition-colors"
                        style={{
                          background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
                          borderColor: active
                            ? 'var(--accent-hairline-strong)'
                            : 'var(--color-divider)',
                          color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
                        }}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[12.5px] mt-3 leading-relaxed text-dim" lang="bn">
                  আপনার ত্বকের জন্য সেরা সমাধান — নমুনা লেখা।
                </p>
              </Card>

              <Card title="Sidebar">
                <div className="flex gap-1.5">
                  {[
                    ['expanded', 'Expanded'],
                    ['collapsed', 'Icons only'],
                  ].map(([value, label]) => {
                    const active = settings.sidebarMode === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSettings({ sidebarMode: value })}
                        className="flex-1 px-2 py-1.5 rounded-[var(--radius-md)] border text-[12px] font-medium transition-colors"
                        style={{
                          background: active ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
                          borderColor: active
                            ? 'var(--accent-hairline-strong)'
                            : 'var(--color-divider)',
                          color: active ? 'var(--color-accent-300)' : 'var(--text-dim)',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-faint mt-3 leading-relaxed">
                  Icons only buys about 170px — worth it on a laptop when the Studio&apos;s three
                  columns get tight.
                </p>
              </Card>
            </div>

            <Card title="Profile">
              <Input
                label="Display name"
                value={settings.profileName}
                onChange={(profileName) => setSettings({ profileName })}
                hint="Shown in the sidebar and used as the default assignee on the team board."
              />
            </Card>

            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  useSettingsStore.getState().resetAppearance()
                  toast.info('Appearance reset')
                }}
              >
                Reset appearance
              </Button>
            </div>
          </div>
        )}

        {/* ── Data & debug ─────────────────────────────────────────────── */}
        {tab === 'data' && (
          <div className="flex flex-col gap-3.5 max-w-[720px]">
            <Card
              title="Debug mode"
              subtitle="Logs every AI request and response — prompt, provider, tokens, milliseconds, raw text."
            >
              <div className="flex items-start gap-3">
                <Toggle checked={settings.debugMode} onChange={toggleDebug} label="Debug mode" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium">
                    {settings.debugMode ? 'Recording' : 'Off'}
                    {settings.debugMode && (
                      <Badge tone="accent" className="ml-2">
                        {debug.all().length} entries
                      </Badge>
                    )}
                  </p>
                  <p className="text-[11.5px] text-faint leading-relaxed mt-1">
                    Kept in memory only — never written to storage, never persisted across reloads.
                    When a generation comes back wrong, the first question is always &ldquo;what did
                    we actually send&rdquo;, and this answers it.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copiedLog ? Check : Copy}
                  disabled={!settings.debugMode || debug.all().length === 0}
                  onClick={copyDebugLog}
                >
                  {copiedLog ? 'Copied' : 'Copy debug log'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Bug}
                  disabled={debug.all().length === 0}
                  onClick={() => {
                    debug.clear()
                    toast.info('Debug log cleared')
                  }}
                >
                  Clear log
                </Button>
              </div>
            </Card>

            <DangerZone />
          </div>
        )}
      </div>
    </>
  )
}
