import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import './styles/global.css'
import 'leaflet/dist/leaflet.css'

// Captura de errores para diagnóstico (muestra el error en pantalla)
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.dataset.ok) {
    root.innerHTML = '<pre style="padding:20px;color:#b00;white-space:pre-wrap;font-size:14px">ERROR: ' +
      (e.message || '') + '\n' + (e.error && e.error.stack ? e.error.stack : '') + '</pre>'
  }
})
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root')
  if (root && !root.dataset.ok) {
    root.innerHTML = '<pre style="padding:20px;color:#b00;white-space:pre-wrap;font-size:14px">PROMISE ERROR: ' +
      (e.reason && e.reason.message ? e.reason.message : JSON.stringify(e.reason)) + '\n' +
      (e.reason && e.reason.stack ? e.reason.stack : '') + '</pre>'
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
