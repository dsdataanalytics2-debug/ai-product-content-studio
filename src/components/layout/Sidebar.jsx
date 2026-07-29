import { NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  PenTool,
  Library,
  Brain,
  KanbanSquare,
  CalendarDays,
  Settings as SettingsIcon,
  Clapperboard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useAvailableProviders } from '../../store/useApiStore'
import { useIsNarrow } from '../../hooks/useMediaQuery'
import { initials } from '../../utils/text'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: LayoutGrid, end: true },
  { to: '/studio', label: 'Script Studio', Icon: PenTool },
  { to: '/library', label: 'Library', Icon: Library },
  { to: '/brands', label: 'Brand Memory', Icon: Brain },
  { to: '/team', label: 'Team Workspace', Icon: KanbanSquare },
  { to: '/calendar', label: 'Content Calendar', Icon: CalendarDays },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Sidebar() {
  const sidebarMode = useSettingsStore((s) => s.sidebarMode)
  const setSettings = useSettingsStore((s) => s.set)
  const profileName = useSettingsStore((s) => s.profileName)
  const providerCount = useAvailableProviders().length
  const isNarrow = useIsNarrow()

  // Below 900px the expanded sidebar leaves too little room for content to be
  // usable, so narrow viewports force icons-only regardless of the saved
  // preference — and the toggle is hidden, because a control that cannot change
  // anything is worse than no control.
  const collapsed = isNarrow || sidebarMode === 'collapsed'

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-hidden transition-[width]"
      style={{
        width: collapsed ? 64 : 232,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-divider)',
      }}
    >
      <div className={`flex items-center gap-2.5 shrink-0 ${collapsed ? 'px-3 py-4' : 'px-4 py-4'}`}>
        <div
          className="grid place-items-center shrink-0 rounded-[9px]"
          style={{
            width: 32,
            height: 32,
            background: 'var(--accent-wash-strong)',
            color: 'var(--color-accent)',
          }}
        >
          <Clapperboard className="w-4 h-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-tight tracking-[-0.01em] truncate">
              Content Studio
            </p>
            <p className="text-[10.5px] text-faint">
              {providerCount > 0 ? `${providerCount} provider${providerCount > 1 ? 's' : ''} ready` : 'No provider yet'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 px-2 scroll-y" aria-label="Main">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-[var(--radius-md)] text-[13px] font-medium
               transition-colors ${collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2'}
               ${isActive ? 'nav-active' : 'nav-idle'}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--accent-wash)' : 'transparent',
              color: isActive ? 'var(--color-accent-300)' : 'var(--text-dim)',
            })}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 my-2 divider shrink-0" />

      <div className={`shrink-0 ${collapsed ? 'px-2 pb-3' : 'px-3 pb-3'}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="grid place-items-center shrink-0 rounded-full text-[11px] font-semibold"
            style={{
              width: 30,
              height: 30,
              background:
                'linear-gradient(135deg, var(--color-accent-700), var(--color-accent-300))',
              color: '#fff',
            }}
          >
            {initials(profileName)}
          </div>
          {!collapsed && (
            <p className="text-[12.5px] font-medium truncate flex-1 min-w-0">{profileName}</p>
          )}
        </div>

        {!isNarrow && (
          <button
            type="button"
            onClick={() => setSettings({ sidebarMode: collapsed ? 'expanded' : 'collapsed' })}
            className={`btn btn-ghost mt-2 text-[11.5px] ${collapsed ? 'w-full justify-center py-2' : 'w-full justify-start px-2.5 py-2'}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" /> Collapse
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  )
}
