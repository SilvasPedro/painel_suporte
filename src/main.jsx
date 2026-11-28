import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initButtonGloss } from './utils/buttonGloss.js'
import { applyDepth, readSavedDepth } from './utils/depthMode.js'

applyDepth(readSavedDepth()) // evita piscar em 3D antes do React montar
initButtonGloss()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
