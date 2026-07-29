import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import ScriptStudio from './pages/ScriptStudio'
import ScriptLibrary from './pages/ScriptLibrary'
import BrandMemory from './pages/BrandMemory'
import TeamWorkspace from './pages/TeamWorkspace'
import ContentCalendar from './pages/ContentCalendar'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="studio" element={<ScriptStudio />} />
          <Route path="library" element={<ScriptLibrary />} />
          <Route path="brands" element={<BrandMemory />} />
          <Route path="team" element={<TeamWorkspace />} />
          <Route path="calendar" element={<ContentCalendar />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
