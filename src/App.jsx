import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import MercaderistaHome from './pages/MercaderistaHome'
import VisitaForm from './pages/VisitaForm'
import SupervisorPanel from './pages/SupervisorPanel'
import VisitaDetalle from './pages/VisitaDetalle'
import TransportistaHome from './pages/TransportistaHome'

function ProtegerRuta({ children, rol }) {
  const { user, perfil, cargando } = useAuth()
  if (cargando) return <div className="spinner" />
  if (!user) return <Navigate to="/login" />
  if (rol && perfil?.role !== rol) return <Navigate to="/" />
  return children
}

export default function App() {
  const { perfil, cargando } = useAuth()

  if (cargando) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#1976D2' }}>
      Cargando…
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtegerRuta>
          {perfil?.role === 'supervisor'
            ? <Navigate to="/supervisor" />
            : perfil?.role === 'transportista'
            ? <Navigate to="/transportista" />
            : <Navigate to="/inicio" />
          }
        </ProtegerRuta>
      } />
      <Route path="/inicio" element={
        <ProtegerRuta rol="mercaderista">
          <MercaderistaHome />
        </ProtegerRuta>
      } />
      {/* Vista previa: el supervisor puede ver la app de la mercaderista */}
      <Route path="/vista-mercaderista" element={
        <ProtegerRuta>
          <MercaderistaHome />
        </ProtegerRuta>
      } />
      <Route path="/vista-visita/:supermercadoId" element={
        <ProtegerRuta>
          <VisitaForm />
        </ProtegerRuta>
      } />
      {/* Transportista */}
      <Route path="/transportista" element={
        <ProtegerRuta rol="transportista">
          <TransportistaHome />
        </ProtegerRuta>
      } />
      <Route path="/vista-transportista" element={
        <ProtegerRuta>
          <TransportistaHome />
        </ProtegerRuta>
      } />
      <Route path="/visita/:supermercadoId" element={
        <ProtegerRuta rol="mercaderista">
          <VisitaForm />
        </ProtegerRuta>
      } />
      <Route path="/supervisor" element={
        <ProtegerRuta rol="supervisor">
          <SupervisorPanel />
        </ProtegerRuta>
      } />
      <Route path="/supervisor/visita/:visitaId" element={
        <ProtegerRuta rol="supervisor">
          <VisitaDetalle />
        </ProtegerRuta>
      } />
    </Routes>
  )
}
