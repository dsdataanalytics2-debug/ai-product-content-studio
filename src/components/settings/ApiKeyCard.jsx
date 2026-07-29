import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Trash2 } from 'lucide-react'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { useApiStore } from '../../store/useApiStore'
import { toast } from '../../store/useToastStore'

const STATE = {
  ok: { Icon: CheckCircle2, label: 'Connected', tone: 'tag-success' },
  fail: { Icon: XCircle, label: 'Rejected', tone: 'tag-danger' },
  unset: { Icon: AlertTriangle, label: 'Not set', tone: 'tag-warning' },
  untested: { Icon: AlertTriangle, label: 'Untested', tone: 'tag-neutral' },
}

export default function ApiKeyCard({
  keyName,
  label,
  role,
  emoji,
  hint,
  docsUrl,
  masked = true,
  onTest,
}) {
  const value = useApiStore((s) => s.keys[keyName])
  const setKey = useApiStore((s) => s.setKey)
  const clearKey = useApiStore((s) => s.clearKey)
  const result = useApiStore((s) => s.testResults[keyName])

  const [draft, setDraft] = useState(value ?? '')
  const [testing, setTesting] = useState(false)

  const dirty = draft.trim() !== (value ?? '')
  const stateKey = !value ? 'unset' : result?.status === 'ok' ? 'ok' : result?.status === 'fail' ? 'fail' : 'untested'
  const { Icon, label: stateLabel, tone } = STATE[stateKey]

  const save = () => {
    setKey(keyName, draft)
    toast.success(`${label} key saved`, 'Stored in this browser only.')
  }

  const test = async () => {
    if (dirty) setKey(keyName, draft)
    setTesting(true)
    try {
      await onTest?.(keyName)
    } finally {
      setTesting(false)
    }
  }

  const remove = () => {
    clearKey(keyName)
    setDraft('')
  }

  return (
    <div className="card elev-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0" aria-hidden="true">
            {emoji}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold leading-tight">{label}</p>
            <p className="text-[11.5px] text-faint mt-0.5">{role}</p>
          </div>
        </div>
        <span className={`tag ${tone} shrink-0`}>
          <Icon className="w-3 h-3" aria-hidden="true" />
          {stateLabel}
        </span>
      </div>

      <Input
        value={draft}
        onChange={setDraft}
        masked={masked}
        mono
        placeholder={value ? '•••••••••••••••• (saved)' : `Paste your ${label} key`}
        aria-label={`${label} API key`}
        error={result?.status === 'fail' ? result.message : undefined}
        hint={result?.status === 'ok' ? result.message : hint}
      />

      <div className="flex items-center gap-1.5">
        <Button size="sm" disabled={!dirty} onClick={save}>
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={testing}
          disabled={!draft.trim()}
          onClick={test}
        >
          Test
        </Button>
        {value && (
          <Button size="sm" variant="ghost" icon={Trash2} onClick={remove} aria-label={`Remove ${label} key`}>
            Remove
          </Button>
        )}
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto flex items-center gap-1 text-[11.5px] shrink-0"
          >
            Get a key <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}
