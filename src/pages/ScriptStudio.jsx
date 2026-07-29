import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Sparkles, AlertTriangle, RotateCw } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import ProductSearch from '../components/product/ProductSearch'
import ScriptConfig from '../components/script/ScriptConfig'
import ScriptOutput, { ScriptOutputSkeleton } from '../components/script/ScriptOutput'
import GenerationStatus from '../components/script/GenerationStatus'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { useScriptStore } from '../store/useScriptStore'
import { useLibraryStore, makeRecord } from '../store/useLibraryStore'
import { useBrandStore } from '../store/useBrandStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { generate } from '../services/aiService'
import {
  buildSystemPrompt,
  buildScriptPrompt,
  buildPromptConfig,
} from '../utils/promptBuilder'
import { normaliseScript } from '../utils/parseAiJson'
import { SCRIPT_SCHEMA } from '../config/constants'
import { AppError, toAppError } from '../utils/errors'
import { toast } from '../store/useToastStore'

export default function ScriptStudio() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const config = useScriptStore((s) => s.config)
  const selectedProducts = useScriptStore((s) => s.selectedProducts)
  const current = useScriptStore((s) => s.current)
  const generation = useScriptStore((s) => s.generation)
  const startGeneration = useScriptStore((s) => s.startGeneration)
  const finishGeneration = useScriptStore((s) => s.finishGeneration)
  const failGeneration = useScriptStore((s) => s.failGeneration)
  const load = useScriptStore((s) => s.load)
  const reset = useScriptStore((s) => s.reset)

  const getRecord = useLibraryStore((s) => s.get)
  const save = useLibraryStore((s) => s.save)
  const getBrand = useBrandStore((s) => s.get)
  const preferredProvider = useSettingsStore((s) => s.preferredProvider)

  const [expanded, setExpanded] = useState(false)

  const startNewScript = () => {
    reset()
    setExpanded(false)
    toast.info('Started a new script', 'The previous one is in the Library.')
  }

  const abortRef = useRef(null)
  const generating = generation.status === 'generating'

  // ?id= opens an existing record. Consumed once, then dropped from the URL so
  // a refresh doesn't silently discard unsaved edits by reloading the original.
  useEffect(() => {
    const id = params.get('id')
    if (!id) return
    const record = getRecord(id)
    if (record) load(record)
    else toast.error('Script not found', 'It may have been deleted from the Library.')
    setParams({}, { replace: true })
  }, [params, getRecord, load, setParams])

  useEffect(() => () => abortRef.current?.abort(), [])

  /**
   * Everything made in the Studio lands in the Library — and therefore on the
   * Workspace board — without anyone pressing Save.
   *
   * One effect covers the lot, because every mutating action in useScriptStore
   * stamps `updatedAt`: generating, editing a block, attaching a shot list or
   * subtitles, resolving a mark. Saving from each call site would have meant
   * remembering to, which is precisely the failure this replaces — a storyboard
   * generated after the last Save simply never existed for the reviewer.
   *
   * The updatedAt comparison is what stops merely opening a record from
   * rewriting it: `load` copies the stored record verbatim, so the timestamps
   * match and nothing is written. `save` stamps its own updatedAt, but it does
   * not touch `current`, so this cannot feed itself.
   */
  useEffect(() => {
    if (!current) return
    const stored = getRecord(current.id)
    if (stored && stored.updatedAt === current.updatedAt) return
    save(current)
  }, [current, getRecord, save])

  const runGeneration = useCallback(async () => {
    if (selectedProducts.length === 0) {
      toast.fromAppError(new AppError('NO_PRODUCTS'))
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    startGeneration(preferredProvider)

    try {
      const promptConfig = buildPromptConfig(config)
      const brand = getBrand(config.brandId)

      const { json, provider, model, usage, cost } = await generate({
        system: buildSystemPrompt(promptConfig),
        prompt: buildScriptPrompt(selectedProducts, promptConfig, brand),
        schema: SCRIPT_SCHEMA,
        signal: controller.signal,
      })

      const script = normaliseScript(json, { durationSeconds: config.durationSeconds })

      const fresh = makeRecord({
        script,
        config,
        products: selectedProducts,
        provider,
        model,
        usage,
        cost,
      })

      // Regenerating updates the record in place rather than minting a new one.
      // makeRecord always mints a fresh id, and a new id here would strand every
      // review mark on an orphaned card — the reviewer would be looking at the
      // old script while the writer works on a new one. Carrying the review
      // context forward is what makes the review → fix → review loop close.
      const existing = useScriptStore.getState().current
      const next = existing
        ? {
            ...fresh,
            id: existing.id,
            createdAt: existing.createdAt,
            status: existing.status,
            marks: existing.marks ?? [],
            comments: existing.comments ?? [],
            assignee: existing.assignee ?? null,
            scheduledFor: existing.scheduledFor ?? null,
            activity: [
              ...(existing.activity ?? []),
              { text: 'Script regenerated', when: new Date().toISOString() },
            ],
          }
        : fresh

      finishGeneration(next)

      toast.success('Script ready', 'Saved to Library and on the Workspace board.')
    } catch (err) {
      const appError = toAppError(err)
      failGeneration(appError)
      // ABORTED means the user pressed Cancel — they know; no toast needed.
      if (appError.code !== 'ABORTED') toast.fromAppError(appError)
    }
  }, [
    selectedProducts,
    config,
    preferredProvider,
    startGeneration,
    finishGeneration,
    failGeneration,
    getBrand,
  ])

  const cancel = () => {
    abortRef.current?.abort()
    failGeneration(new AppError('ABORTED'))
  }

  return (
    <>
      <Navbar breadcrumb={['Script Studio', current ? current.title : 'New script']} />

      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex gap-3.5 p-3.5 h-full" style={{ minWidth: 1120 }}>
          {/* Column 1 — products */}
          <div className="card elev-sm w-[276px] shrink-0 p-3.5 flex flex-col min-h-0">
            <ProductSearch onContinue={runGeneration} />
          </div>

          {/* Column 2 — configuration */}
          <div className="card elev-sm flex-1 min-w-0 flex flex-col min-h-0">
            <div className="scroll-y p-3.5">
              <ScriptConfig onGenerate={runGeneration} />
            </div>
          </div>

          {/* Column 3 — output */}
          <div className="card elev-sm w-[400px] shrink-0 flex flex-col min-h-0 overflow-hidden">
            {generating && (
              <div className="p-3.5 flex flex-col gap-3.5">
                <GenerationStatus
                  status={generation.status}
                  provider={generation.provider}
                  startedAt={generation.startedAt}
                  onCancel={cancel}
                />
                <ScriptOutputSkeleton />
              </div>
            )}

            {!generating && generation.status === 'error' && !current && (
              <div className="p-3.5">
                <EmptyState
                  icon={AlertTriangle}
                  title={generation.error?.display().title ?? 'Generation failed'}
                  description={generation.error?.display().body}
                  action={
                    <div className="flex items-center gap-2">
                      <Button size="sm" icon={RotateCw} onClick={runGeneration}>
                        Try again
                      </Button>
                      {generation.error?.display().action && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(generation.error.display().action.to)}
                        >
                          {generation.error.display().action.label}
                        </Button>
                      )}
                    </div>
                  }
                />
              </div>
            )}

            {/* Rendered here only while collapsed. The expanded copy lives in
                the overlay below — one instance either way, so editing state and
                open tabs never diverge between two versions of the same panel. */}
            {!generating && current && !expanded && (
              <ScriptOutput
                record={current}
                onRegenerate={runGeneration}
                onNew={startNewScript}
                onToggleExpand={() => setExpanded(true)}
              />
            )}

            {!generating && current && expanded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="h-full w-full grid place-items-center p-3.5 text-[12px] text-faint"
              >
                Open full size — click to bring it back here
              </button>
            )}

            {!generating && !current && generation.status !== 'error' && (
              <div className="p-3.5 h-full grid place-items-center">
                <EmptyState
                  icon={Sparkles}
                  title="No script yet"
                  description={
                    selectedProducts.length === 0
                      ? 'Pick a product on the left, set the brief in the middle, then generate.'
                      : `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} selected. Set the brief, then generate.`
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-size view. `bare` because ScriptOutput brings its own title bar,
          tabs and action bar — a modal header on top would give it two. */}
      <Modal
        open={Boolean(current) && expanded}
        onClose={() => setExpanded(false)}
        title={current?.title ?? 'Script'}
        width={1080}
        bare
      >
        {current && (
          <ScriptOutput
            record={current}
            onRegenerate={runGeneration}
            onNew={startNewScript}
            expanded
            onToggleExpand={() => setExpanded(false)}
          />
        )}
      </Modal>
    </>
  )
}
