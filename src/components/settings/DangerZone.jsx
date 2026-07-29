import { useRef, useState } from 'react'
import { Download, Upload, Trash2, AlertTriangle, HardDrive } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import {
  exportBackup,
  importBackup,
  clearAllAppData,
  storageFootprint,
  formatBytes,
} from '../../utils/storage'
import { downloadBackup } from '../../utils/exportUtils'
import { toast } from '../../store/useToastStore'
import { toAppError } from '../../utils/errors'

/**
 * Backup/restore lives next to the destructive button on purpose: the moment
 * someone considers "clear everything" is exactly the moment they should be
 * offered an export.
 */
export default function DangerZone() {
  const fileRef = useRef(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const footprint = storageFootprint()

  const doExport = () => {
    try {
      downloadBackup(exportBackup())
      toast.success('Backup downloaded', 'API keys are excluded — re-enter them after restoring.')
    } catch (err) {
      toast.fromAppError(toAppError(err))
    }
  }

  const doImport = async (file) => {
    if (!file) return
    try {
      const restored = importBackup(JSON.parse(await file.text()))
      toast.success(`Restored ${restored} keys`, 'Reloading so every screen picks up the new data…')
      // A reload is the honest way to rehydrate every persisted store at once.
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      toast.fromAppError(toAppError(err))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const doClear = () => {
    const removed = clearAllAppData()
    setConfirmOpen(false)
    toast.info(`Cleared ${removed} keys`, 'Reloading…')
    setTimeout(() => window.location.reload(), 700)
  }

  return (
    <>
      <div className="card elev-sm p-4 flex flex-col gap-3.5">
        <div>
          <h2 className="text-[13px] font-semibold">Data</h2>
          <p className="text-[11.5px] text-faint mt-0.5 leading-relaxed">
            Everything lives in this browser. Clearing browsing data deletes it — which is why the
            export button is not buried.
          </p>
        </div>

        <div
          className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-md)]"
          style={{ background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}
        >
          <HardDrive className="w-4 h-4 shrink-0 text-faint" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium">{formatBytes(footprint.bytes)} used</p>
            <p className="text-[11px] text-faint">
              {footprint.keys} storage keys · typical browser limit is about 5 MB
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={Download} onClick={doExport}>
            Export backup
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Upload}
            onClick={() => fileRef.current?.click()}
          >
            Restore from backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => doImport(e.target.files?.[0])}
          />
        </div>
      </div>

      <div
        className="card p-4 flex items-center gap-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-danger) 30%, var(--color-divider))',
          background: 'color-mix(in srgb, var(--color-danger) 4%, var(--color-surface))',
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-danger-text)' }}>
            Danger zone
          </p>
          <p className="text-[11.5px] text-dim mt-1 leading-relaxed">
            Deletes every script, brand profile, calendar entry and saved key from this browser.
            Cannot be undone. Export a backup first.
          </p>
        </div>
        <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmOpen(true)}>
          Clear all data
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false)
          setConfirmText('')
        }}
        title="Clear all local data?"
        description="Every script, brand, calendar entry and API key stored in this browser will be deleted. There is no undo and no server-side copy."
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmOpen(false)
                setConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
              onClick={doClear}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div
            className="flex items-start gap-2 p-2.5 rounded-[var(--radius-md)]"
            style={{
              background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)',
            }}
          >
            <AlertTriangle
              className="w-3.5 h-3.5 shrink-0 mt-px"
              style={{ color: 'var(--color-danger-text)' }}
            />
            <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--color-danger-text)' }}>
              Close this and use <strong>Export backup</strong> first if there is anything here you
              would miss.
            </p>
          </div>

          <Input
            label="Type DELETE to confirm"
            value={confirmText}
            onChange={setConfirmText}
            placeholder="DELETE"
          />
        </div>
      </Modal>
    </>
  )
}
