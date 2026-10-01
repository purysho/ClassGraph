import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './app.css'

const root = document.getElementById('root')
if (!root) throw new Error('CG-9002 app root is missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
