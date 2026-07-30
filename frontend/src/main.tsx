import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Polyfill crypto.randomUUID for non-secure HTTP browser contexts
if (typeof window !== 'undefined' && window.crypto && typeof (window.crypto as any).randomUUID !== 'function') {
  (window.crypto as any).randomUUID = function randomUUID() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
