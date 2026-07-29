import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import ErrorBoundary from '../ui/ErrorBoundary'
import Toaster from '../ui/Toaster'
import { useSettingsStore, applyAppearance } from '../../store/useSettingsStore'

export default function AppLayout() {
  const settings = useSettingsStore()
  const location = useLocation()

  // Appearance is applied here rather than in each page: one place that owns the
  // document attributes, so a theme change can never leave a screen half-styled.
  useEffect(() => {
    applyAppearance(settings)
  }, [settings.theme, settings.accent, settings.fontScale, settings])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyAppearance(useSettingsStore.getState())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Keyed on the route so a crash on one screen doesn't wedge the others —
            navigating away remounts a fresh boundary. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Toaster />
    </div>
  )
}
