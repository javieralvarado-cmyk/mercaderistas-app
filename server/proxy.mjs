// ════════════════════════════════════════════════════════════
// Mini-servidor que lee órdenes de compra con Claude (IA de visión)
// La clave ANTHROPIC_API_KEY vive aquí (servidor), NUNCA en el navegador.
// Arranca con:  npm run proxy
// ════════════════════════════════════════════════════════════
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
// Carga server/.env sin importar desde dónde se ejecute
const envCargado = dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)), override: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '30mb' }))

const API_KEY = process.env.ANTHROPIC_API_KEY || envCargado.parsed?.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'

const PROMPT = `Eres un extractor de datos de órdenes de compra (Pedidos) de Panamá.
El documento puede tener varias páginas; cada página o cada "Proveedor/Vendor" distinto es una ORDEN separada.

Para CADA orden identifica:
- proveedor: el "Nombre del Proveedor/Vendor"
- numeroOrden: el "No. Pedido"
- fecha: la fecha del pedido (formato dd.mm.aaaa tal cual aparece)
- tiendaDestino: la "Dirección de Entrega / Ship to" (el supermercado destino)
- items: lista de productos, cada uno con:
    - descripcion: la Descripción del producto
    - cantidad: el número ENTERO de la columna Cantidad (ver regla de formato abajo)
    - unidad: la unidad de medida (UM), normalmente "UN" o "CJ"
    - precioUnitario: el Precio unitario (número)

⚠️ FORMATO DE NÚMEROS (MUY IMPORTANTE): estos documentos usan formato latino donde el PUNTO es separador DECIMAL, no de miles.
Por lo tanto "1.000" significa 1 (uno), "24.000" significa 24, "12.000" significa 12, "2.500" significa 2.5.
Devuelve "cantidad" como el número entero real (1, 24, 12), NUNCA multiplicado por mil. Jamás devuelvas 1000 cuando el documento dice "1.000".

Devuelve EXCLUSIVAMENTE un JSON válido, sin explicaciones, sin markdown, con esta forma exacta:
{"ordenes":[{"proveedor":"","numeroOrden":"","fecha":"","tiendaDestino":"","items":[{"descripcion":"","cantidad":0,"unidad":"UN","precioUnitario":0}]}]}`

app.post('/leer-orden', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en server/.env' })
    const { fileBase64, mediaType } = req.body
    if (!fileBase64) return res.status(400).json({ error: 'No llegó el archivo' })

    const isPdf = (mediaType || '').includes('pdf')
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: fileBase64 } }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            // prompt cacheable para abaratar llamadas repetidas
            { type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } },
          ],
        }],
      }),
    })

    const data = await r.json()
    if (!r.ok) { console.error('Anthropic error:', data); return res.status(500).json({ error: data }) }

    const texto = (data.content || []).map(c => c.text || '').join('')
    const match = texto.match(/\{[\s\S]*\}/)
    const json = match ? JSON.parse(match[0]) : { ordenes: [] }
    res.json(json)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e) })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`✅ Lector de órdenes (IA) en http://localhost:${PORT}`))
