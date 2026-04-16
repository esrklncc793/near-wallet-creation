import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import process from 'process'
import './index.css'
import App from './App.tsx'

globalThis.Buffer = Buffer
globalThis.process = process

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
