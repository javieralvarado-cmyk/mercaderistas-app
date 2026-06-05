# 📦 FreshCo — Sistema de Mercaderistas · Handoff para continuar

> Pega este archivo (o su contenido) al iniciar un chat nuevo para seguir sin perder contexto.

## 🏢 Qué es
App web (PWA) para **FreshCo** (empresa de bebidas y salsas en Panamá) que controla:
- **Mercaderistas** que visitan supermercados (inventario, fotos, precios, vencimientos, degustación)
- **Transportistas** que entregan órdenes de compra (ruta del día, foto de entrega + GPS)
- **Supervisor** (el dueño, Javier) que ve todo: dashboard, mapa, alertas, órdenes, tiempos, pedido sugerido

## 📍 Ubicación y cómo correr
- Proyecto: `/Users/javiereduardoalvarado/Downloads/mercaderistas-app`
- App: `npm run dev` → http://localhost:5173
- Servidor lector de órdenes (IA): `npm run proxy` → http://localhost:3001  (DEBE estar encendido para leer órdenes)
- Build de verificación: `npx vite build`
- Node v24, npm 11

## 🔑 Credenciales y servicios
- **Firebase** (proyecto `mercaderistas-d83a2`): config en `src/services/firebase.js`. Consola: https://console.firebase.google.com/project/mercaderistas-d83a2
  - Servicios activos: Authentication (email/clave), Firestore. (Storage NO se usa → se usa Cloudinary)
  - Reglas Firestore: colecciones `users, visits, supermarkets, routes, purchaseOrders` → `allow read, write: if request.auth != null`
- **Cloudinary** (fotos): cloud name `dybffw2rm`, upload preset `mercaderistas` (unsigned). Config en `src/services/cloudinary.js`
- **Anthropic** (IA lector): la clave está en `server/.env` (ANTHROPIC_API_KEY). Modelo `claude-sonnet-4-6`. ⚠️ Conviene rotar la clave (se compartió en chat).
- **Cuenta supervisor**: `javieralvarado@freshcopty.com` · role `supervisor` · UID `ti5lXoy9o6OtptbJ37WVSwco2Ax2`

## 🎨 Marca FreshCo (ya aplicada)
- Azul principal `#0096DB` · Azul marino `#0A3D7A` · Amarillo `#FFD400` · Naranja `#F7941E` · Verde hoja `#8CC63F` (éxito `#5FA516`)
- Fuente **Nunito** · Logo: `src/components/Logo.jsx`
- Variables CSS en `src/styles/global.css`

## 🥤 Productos reales (src/services/datos.js) — todo se maneja en UNIDADES
| Producto | Caja | Código barras |
|---|---|---|
| FreshCo Bebida Pitahaya 345ml | 25 u | 7481111100081 |
| FreshCo Bebida Limonada Rosa 345ml | 25 u | 7481111200050 |
| Hot Chombo Salsa Picante Habanero 150ml | 24 u | 7481106400060 |
| Hot Chombo Salsa Picante Roja 150ml | 24 u | 7481106400059 |
> Palmira Estates y Tabira = 12 u/caja (agregar cuando los den).

## 👥 Personas y zonas
- Mercaderistas: **Darkiris** (Panamá ciudad + Oeste + provincias centrales) · **Digna** (Chiriquí)
- Transportistas: lista fija `['Transportista 1','Transportista 2']` (cambiar por nombres reales)
- Almacén / punto de partida del transportista: **Panamá Viejo Business Center** (lat 9.0080, lng -79.4870)
- Roles (campo `role` en /users): `supervisor` | `mercaderista` | `transportista`

## 🗂️ Modelo de datos (Firestore)
- `/users/{uid}`: `name, email, role`
- `/supermarkets/{id}`: `name, chain, ciudad, provincia, dia, mercaderista, gps{lat,lng}, gpsAprox, mapsUrl`  (65 tiendas; master en `src/data/tiendasPanama.js`)
- `/visits/{id}`: `mercaderistaId, mercaderistaName, supermercadoId, supermercadoName, fecha, horaEntrada, horaSalida, tiempoEnLocal, gpsEntrada, gpsSalida, estado, productos[], degustacion{}, notasGenerales, firmaUrl`
  - `productos[]`: `id, marca, nombre, stockGondola, stockBodega, reposicion, vendidos(auto), stockAnterior, precioAnaquel, precioAnterior, promoActiva, promoPct, precioPromo, posicionGondola, nFrentes, fechaVencimiento, estadoAnaquel, observaciones, fotoAnaquel, fotoExtra`
- `/purchaseOrders/{id}`: `numeroOrden, supermercadoId, supermercadoName, transportistaName, proveedor, items[], facturaUrl, estado(pendiente|entregado|no_entregada|faltante), entregadoItems[], comprobanteUrl, fotoEntregaUrl, gpsEntrega, motivoNoEntrega, notasEntrega, fechaEntrega, fecha, origen, createdAt`

## 🧩 Archivos clave (src/)
- `App.jsx` (rutas + roles) · `hooks/useAuth.jsx`
- `pages/`: Login, MercaderistaHome, VisitaForm, SupervisorPanel, VisitaDetalle, CatalogoAdmin, OrdenesAdmin, TransportistaHome, TiemposEntrega, PedidoSugerido
- `services/`: firebase, cloudinary, datos, lectorOrden (llama al proxy), exportExcel, gps
- `components/`: Logo, FotoConGPS
- `data/tiendasPanama.js` (65 tiendas) · `server/proxy.mjs` (lector IA)
- Vista previa: el supervisor puede ver la app de mercaderista/transportista con botones en el Dashboard (rutas `/vista-mercaderista`, `/vista-transportista`, `/vista-visita/:id`).

## ✅ HECHO
- Login + 3 roles · App mercaderista (home rutas del día + formulario 4 pasos)
- Vendidos automático (stock anterior + reposición − actual) · Precio con memoria + promo % · Autoguardado del formulario en el celular
- Fotos con GPS · Firma digital
- **GPS OBLIGATORIO**: la mercaderista no puede iniciar la visita sin ubicación (pantalla de bloqueo + reintentar); el transportista no puede confirmar entrega sin GPS
- Panel supervisor con pestañas: Dashboard, Visitas, **Mapa (pines 🔴/🟢 visitado en la semana)**, Alertas (incluye validación GPS: foto/visita lejos del super solo en tiendas con GPS exacto), Catálogo, Órdenes, **Tiempos entre supers (promedio + alerta)**, Degustaciones, **Pedido sugerido**
- Catálogo: 65 tiendas (Super 99 / Machetazo / Fuerte), agrupado por provincia, asignar a mercaderista+día (selector), liberar tiendas si renuncia, filtro "solo aproximadas"
- **Órdenes de compra**: lector con IA (foto o PDF → crea órdenes solas, agrupadas por súper → productos), adjunta el documento como factura, comprobante fiscal en no-entrega
- **App transportista**: 2 fases (1 Carga del día → 2 Ruta), ruta optimizada **lejos→cerca del almacén**, cantidades en cajas, **foto de entrega OBLIGATORIA con GPS silencioso**, entregada/no entregada, navegación Google Maps (universal iPhone/Android)
- Diseño base con marca FreshCo (paleta + fuente + logo + login)

## ⏳ FALTA (en orden)
1. **#4 Revisar exportación a Excel** — `src/services/exportExcel.js` (incluir promo %, precio promo, formato nuevo)
2. **#9 Reporte diario automático** — resumen del día al supervisor. DECISIÓN pendiente: canal (WhatsApp / email / solo en la app)
3. **Diseño de pantallas interiores** — pulir mercaderista, transportista y tabs con la marca (login ya está)
4. **Afinar 27 tiendas con GPS aproximado** — manual: Catálogo → filtro "solo aproximadas" → pegar link de Google Maps
   - Super 99 (13): Megamall, Bethania, Los Andes Mall, El Faro, Pedregal, Balboa, Vista Hermosa, Calidonia, Transístmica, Montemadero, Santiago, Coronado, Colón 2000
   - Machetazo (10): todas · El Fuerte (4): todas
5. 🔴 **Cuentas reales** — crear Darkiris, Digna y transportistas en Firebase Auth + doc `/users/{uid}` con `{name, email, role}`
6. 🔴 **Publicar en internet** — Firebase Hosting para la app + hostear `server/proxy.mjs` (la clave debe quedar en el servidor; Spark no tiene Functions → usar Render/Vercel/Cloudflare gratis). Luego cambiar `PROXY_URL` en `src/services/lectorOrden.js` a la URL pública.

## 💡 SUGERIDAS (extras de valor para FreshCo)
- ✅ Pedido sugerido (ya hecho)
- **Comparación de precios** del producto entre tiendas (monitoreo de precio en góndola)
- **Reporte diario/semanal automático** (resumen al supervisor)
- **Histórico/tendencia de ventas** por producto y tienda (mejor/peor)
- **Ranking de mercaderistas** (cumplimiento de ruta, tiempo promedio)
- **Notificaciones push** de alertas (vencimientos, no visitados, faltantes)
- **Control de devoluciones / merma** (producto vencido o dañado)

## ⚠️ Notas / pendientes técnicos
- El **proxy** (`npm run proxy`) debe correr para el lector de órdenes; al publicar hay que hostearlo.
- El emparejamiento de tienda en el lector: "VILLA ZAITA MALL" empató con "El Fuerte Villa Zaíta" en vez de "99 Villa Zaita" (dos tiendas con el mismo nombre). Se puede afinar el matcher o corregir manual.
- Números en formato latino "1.000" = 1 (ya manejado en el prompt del proxy).
