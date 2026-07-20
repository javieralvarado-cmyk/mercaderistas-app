import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import Logo from '../components/Logo'

// Para agregar más usuarios: agrega una línea aquí y genera el link /activar/<token>
const INVITACIONES = {
  darkiris: { nombreDefault: 'Darkiris', email: 'darkiris@freshcopty.com', role: 'mercaderista' },
  digna:    { nombreDefault: 'Digna',    email: 'digna@freshcopty.com',    role: 'mercaderista' },
  solimar:  { nombreDefault: 'Solimar',  email: 'solimar@freshcopty.com',  role: 'mercaderista' },
  demo:     { nombreDefault: 'Demo',     email: 'demo@freshcopty.com',     role: 'mercaderista' },
}

export default function Activar() {
  const { token } = useParams()
  const nav = useNavigate()
  const inv = INVITACIONES[token?.toLowerCase()]

  const [nombre,    setNombre]    = useState(inv?.nombreDefault || '')
  const [apellido,  setApellido]  = useState('')
  const [clave,     setClave]     = useState('')
  const [clave2,    setClave2]    = useState('')
  const [verClave,  setVerClave]  = useState(false)
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')
  const [listo,     setListo]     = useState(false)

  if (!inv) return (
    <div style={styles.wrap}>
      <Logo />
      <p style={{ marginTop: 32, color: '#c00', fontWeight: 700 }}>
        Link inválido. Pídele a Javier que te mande el link correcto.
      </p>
    </div>
  )

  if (listo) return <PantallaListo nav={nav} />



  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim() || !apellido.trim()) return setError('Escribe tu nombre y apellido.')
    if (clave.length < 6)   return setError('La contraseña debe tener al menos 6 caracteres.')
    if (clave !== clave2)   return setError('Las contraseñas no coinciden.')

    setCargando(true)
    try {
      const nombreCompleto = `${nombre.trim()} ${apellido.trim()}`
      const { user } = await createUserWithEmailAndPassword(auth, inv.email, clave)

      await updateProfile(user, { displayName: nombreCompleto })

      await setDoc(doc(db, 'users', user.uid), {
        name:  nombreCompleto,
        email: inv.email,
        role:  inv.role,
        clave, // visible para el supervisor en el panel
      })

      setListo(true)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Esta cuenta ya fue activada. Entra desde el login, o pídele a Javier que la reinicie.')
      } else {
        setError('Error: ' + err.message)
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <Logo />
      <div style={styles.card}>
        <h2 style={{ color: 'var(--marca-azul)', marginBottom: 4 }}>
          Bienvenida a FreshCo 👋
        </h2>
        <p style={{ color: '#555', marginBottom: 24, fontSize: 14 }}>
          Crea tu contraseña para entrar a la app.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={styles.label}>
            Nombre
            <input style={styles.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Darkiris" />
          </label>

          <label style={styles.label}>
            Apellido
            <input style={styles.input} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Ej: González" required />
          </label>

          <label style={styles.label}>
            Contraseña
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...styles.input, paddingRight: 40 }}
                type={verClave ? 'text' : 'password'}
                value={clave}
                onChange={e => setClave(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <button type="button" onClick={() => setVerClave(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                {verClave ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <label style={styles.label}>
            Confirmar contraseña
            <input
              style={styles.input}
              type={verClave ? 'text' : 'password'}
              value={clave2}
              onChange={e => setClave2(e.target.value)}
              placeholder="Repite tu contraseña"
              required
            />
          </label>

          {error && <p style={{ color: '#c00', fontSize: 13, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            style={{
              display: 'block', width: '100%', marginTop: 8,
              background: '#27ae60', color: '#fff', border: '3px solid #1e8449',
              borderRadius: 12, padding: '16px 0', fontSize: 18, fontWeight: 900,
              cursor: 'pointer', opacity: cargando ? 0.6 : 1,
            }}>
            {cargando ? 'Creando cuenta…' : '✅ Crear mi cuenta'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12, color: '#aaa', textAlign: 'center' }}>
          Tu email de acceso será: <strong>{inv.email}</strong>
        </p>
      </div>
    </div>
  )
}

function PantallaListo({ nav }) {
  const [seg, setSeg] = useState(4)
  useEffect(() => {
    const t = setInterval(() => setSeg(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { if (seg <= 0) nav('/login') }, [seg])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0096DB', padding: 16 }}>
      <Logo />
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 380, marginTop: 24, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>✅</div>
        <h2 style={{ color: '#0096DB', margin: '0 0 8px' }}>¡Cuenta creada!</h2>
        <p style={{ color: '#555', marginBottom: 24 }}>Ya puedes entrar a la app con tu email y contraseña.</p>
        <a
          href="/login"
          style={{ display: 'block', background: '#0096DB', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '14px 0', fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Ir al login →
        </a>
        <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>Redirigiendo en {seg}s…</p>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--marca-azul) 0%, var(--azul-osc) 100%)',
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 380,
    marginTop: 24,
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    background: '#0096DB',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 0',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    width: '100%',
  },
}
