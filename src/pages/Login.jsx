import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const correo = email.trim().includes('@') ? email.trim() : `${email.trim()}@freshcopty.com`
      await login(correo, password)
      navigate('/')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--grad-marca)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo / Título */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', background: 'white', padding: '16px 22px', borderRadius: '22px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
            <Logo size="lg" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.92)', marginTop: '16px', fontSize: '15px', fontWeight: 600 }}>
            Control de Mercaderistas y Rutas
          </p>
        </div>

        {/* Formulario */}
        <div className="card" style={{ padding: '24px' }}>
          {error && (
            <div className="alerta alerta-error" style={{ marginBottom: '16px' }}>
              ⚠️ {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="campo">
              <label>Usuario</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ej: darkiris"
                required
                autoComplete="username"
                autoCapitalize="none"
                style={{ fontSize: '16px' }}
              />
            </div>
            <div className="campo">
              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ fontSize: '16px' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primario"
              disabled={cargando}
              style={{ marginTop: '8px' }}
            >
              {cargando ? '⏳ Ingresando...' : '🔐 Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
