// Browser entry point: mounts App into #root, pulls in the one stylesheet, and arms
// the post-deploy reload. Everything else in this repo hangs off these few lines.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installPreloadRecovery } from './preloadRecovery.ts'

installPreloadRecovery()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
