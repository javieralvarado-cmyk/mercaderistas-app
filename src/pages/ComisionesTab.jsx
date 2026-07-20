import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format, startOfMonth } from 'date-fns'
import { comisionesPorMercaderista } from '../services/inventario'
import { COMISION_POR_CATEGORIA } from '../services/datos'

const money = (n) => '$' + (Number(n) || 0).toFixed(2)

// Comisiones de las mercaderistas: unidades vendidas × tarifa por categoría.
export default function ComisionesTab() {
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [cargando, setCargando] = useState(true)
  const [data, setData] = useState({ filas: [], totalComision: 0, totalUnidades: 0 })

  useEffect(() => { cargar() }, [desde, hasta])

  async function cargar() {
    setCargando(true)
    try {
      const snap = await getDocs(query(
        collection(db, 'visits'),
        where('fecha', '>=', desde),
        where('fecha', '<=', hasta),
      ))
      const visitas = snap.docs.map(d => d.data())
      setData(comisionesPorMercaderista(visitas))
    } catch (err) {
      console.error('Error cargando comisiones:', err)
      setData({ filas: [], totalComision: 0, totalUnidades: 0 })
    }
    setCargando(false)
  }

  function descargarCSV() {
    const filas = [['Mercaderista', 'Jugos (u)', 'Jugos ($)', 'Picante (u)', 'Picante ($)', 'Café (u)', 'Café ($)', 'Total (u)', 'Total ($)']]
    data.filas.forEach(m => filas.push([
      m.mercaderistaName,
      m.cat.jugo.u, m.cat.jugo.c.toFixed(2),
      m.cat.picante.u, m.cat.picante.c.toFixed(2),
      m.cat.cafe.u, m.cat.cafe.c.toFixed(2),
      m.totalU, m.totalC.toFixed(2),
    ]))
    filas.push(['TOTAL', '', '', '', '', '', '', data.totalUnidades, data.totalComision.toFixed(2)])
    const csv = filas.map(f => f.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `comisiones_${desde}_a_${hasta}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="seccion-titulo">💵 Comisiones</div>
      <div className="alerta alerta-info" style={{ fontSize: 12 }}>
        Se calcula con las unidades vendidas de cada visita ×{' '}
        jugos {money(COMISION_POR_CATEGORIA.jugo)}, picante {money(COMISION_POR_CATEGORIA.picante)}, café {money(COMISION_POR_CATEGORIA.cafe)} por unidad.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0' }}>
        <label style={lbl}>Desde
          <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={inp} />
        </label>
        <label style={lbl}>Hasta
          <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} style={inp} />
        </label>
        {data.filas.length > 0 && (
          <button onClick={descargarCSV} style={btnCsv}>⬇️ CSV</button>
        )}
      </div>

      {cargando ? <div className="spinner" /> : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={cardKpi}>
              <div style={kpiNum}>{data.totalUnidades}</div>
              <div style={kpiLbl}>Unidades vendidas</div>
            </div>
            <div style={{ ...cardKpi, background: 'var(--verde, #22c55e)' }}>
              <div style={{ ...kpiNum, color: '#fff' }}>{money(data.totalComision)}</div>
              <div style={{ ...kpiLbl, color: '#fff' }}>Comisiones a pagar</div>
            </div>
          </div>

          {data.filas.length === 0 ? (
            <div className="alerta alerta-info">Sin ventas registradas en este rango.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={th}>Mercaderista</th>
                    <th style={thR}>Jugos</th>
                    <th style={thR}>Picante</th>
                    <th style={thR}>Café</th>
                    <th style={{ ...thR, background: '#f0f9ff' }}>Total u.</th>
                    <th style={{ ...thR, background: '#f0f9ff' }}>Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map(m => (
                    <tr key={m.mercaderistaId || m.mercaderistaName}>
                      <td style={td}><b>{m.mercaderistaName}</b></td>
                      <td style={tdR}>{m.cat.jugo.u}u · {money(m.cat.jugo.c)}</td>
                      <td style={tdR}>{m.cat.picante.u}u · {money(m.cat.picante.c)}</td>
                      <td style={tdR}>{m.cat.cafe.u}u · {money(m.cat.cafe.c)}</td>
                      <td style={{ ...tdR, fontWeight: 700 }}>{m.totalU}</td>
                      <td style={{ ...tdR, fontWeight: 800, color: 'var(--verde, #16a34a)' }}>{money(m.totalC)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...td, fontWeight: 800 }}>TOTAL</td>
                    <td style={tdR}></td><td style={tdR}></td><td style={tdR}></td>
                    <td style={{ ...tdR, fontWeight: 800 }}>{data.totalUnidades}</td>
                    <td style={{ ...tdR, fontWeight: 900, color: 'var(--verde, #16a34a)' }}>{money(data.totalComision)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600, color: '#555' }
const inp = { padding: '8px 10px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14 }
const btnCsv = { padding: '9px 14px', background: 'var(--marca-azul, #0096DB)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }
const cardKpi = { flex: 1, background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '14px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }
const kpiNum = { fontSize: 26, fontWeight: 900, color: 'var(--marca-azul, #0096DB)' }
const kpiLbl = { fontSize: 12, color: '#777', marginTop: 2 }
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden' }
const th = { textAlign: 'left', padding: '10px 12px', background: 'var(--marca-azul, #0096DB)', color: '#fff', fontSize: 12 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f0f0f0' }
const tdR = { ...td, textAlign: 'right' }
