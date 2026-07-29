import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useSettingsStore, applyAppearance } from './store/useSettingsStore'
import './index.css'

// Apply the saved theme before the first paint. Doing it inside a component
// means a frame of default-dark on a light-theme user's screen.
applyAppearance(useSettingsStore.getState())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
