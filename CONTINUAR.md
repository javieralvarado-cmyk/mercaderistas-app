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
- Servidor lector de órdenes (IA): `npm run proxy` → http://localhost:3001
- Build de verificación: `npx vite build`
- Node v24, npm 11

## 🔑 Credenciales y servicios
- **Firebase** (proyecto `mercaderistas-d83a2`): config en `src/services/firebase.js`
  - Consola: https://console.firebase.google.com/project/mercaderistas-d83a2
  - Servicios: Authentication (email/clave), Firestore. Storage NO se usa → Cloudinary
  - Reglas Firestore: `allow read, write: if request.auth != null`
- **Cloudinary**: cloud name `dybffw2rm`, upload preset `mercaderistas` (unsigned)
- **Anthropic**: clave en `server/.env`. Modelo `claude-sonnet-4-6`. ⚠️ ROTAR LA CLAVE — fue expuesta en chat anterior
- **Cuenta supervisor**: `javieralvarado@freshcopty.com` · role `supervisor`
- **GitHub**: https://github.com/javieralvarado-cmyk/mercaderistas-app ✅ código subido
- **Render proxy**: https://freshco-proxy.onrender.com ✅ DESPLEGADO
  - ID: `srv-d8h40qr7uimc73ch6r90`
  - ⚠️ Actualizar ANTHROPIC_API_KEY en Render con la clave nueva

## 🎨 Marca FreshCo (ya aplicada)
- Azul principal `#0096DB` · Azul marino `#0A3D7A` · Amarillo `#FFD400` · Naranja `#F7941E` · Verde `#8CC63F`
- Fuente **Nunito** · Logo: `src/components/Logo.jsx` · Variables CSS en `src/styles/global.css`

## 🥤 Productos reales (src/services/datos.js)
| Producto | Caja | Código barras |
|---|---|---|
| FreshCo Bebida Pitahaya 345ml | 25 u | 7481111100081 |
| FreshCo Bebida Limonada Rosa 345ml | 25 u | 7481111200050 |
| Hot Chombo Salsa Picante Habanero 150ml | 24 u | 7481106400060 |
| Hot Chombo Salsa Picante Roja 150ml | 24 u | 7481106400059 |

## 👥 Personas y zonas
- **Darkiris**: interior del país + ciudad de Panamá + Panamá Oeste
- **Digna**: Chiriquí
- Transportistas: cambiar `['Transportista 1','Transportista 2']` por nombres reales
- Almacén: Panamá Viejo Business Center (lat 9.0080, lng -79.4870)
- Degustaciones: días **15 y último del mes**, de **3:00 PM a 8:00 PM**

## 🗂️ Modelo de datos (Firestore)
- `/users/{uid}`: `name, email, role`
- `/supermarkets/{id}`: `name, chain, ciudad, provincia, dia, mercaderista, gps{lat,lng}, gpsAprox, mapsUrl`
- `/visits/{id}`: `mercaderistaId, mercaderistaName, supermercadoId, fecha, horaEntrada, horaSalida, tiempoEnLocal, gpsEntrada, estado, productos[], degustacion{}, notasGenerales, firmaUrl`
  - `productos[]`: `stockGondola, stockBodega, reposicion, vendidos, precioAnaquel, precioAnterior, promoActiva, promoPct, precioPromo, posicionGondola, nFrentes, fechaVencimiento, estadoAnaquel, fotoAnaquel, fotoExtra`
- `/purchaseOrders/{id}`: `estado(pendiente|entregado|no_entregada|faltante), items[], fotoEntregaUrl, gpsEntrega, motivoNoEntrega`

## 🧩 Archivos clave
- `scripts/createUsers.mjs` — crea cuentas reales (requiere `scripts/serviceAccount.json`)
- `scripts/clearTestData.mjs` — borra datos de prueba (visitas + órdenes)
- `server/proxy.mjs` — lector IA de órdenes (Express + Anthropic)
- `.env.production` — `VITE_PROXY_URL=https://freshco-proxy.onrender.com/leer-orden` ✅ ya configurado

## ✅ HECHO EN ESTA SESIÓN
- Excel: 11 columnas, promo %, precio promo, colores FreshCo
- Reporte diario: pestaña en supervisor, auto-abre 6pm, imprimible
- Diseño: Logo en todos los headers, franja amarilla, tab activo amarillo, botón Navegar en tiendas
- 8 alertas nuevas: sin actividad 11am, visita corta/larga, quincena sin degustación, sin foto, precio bajó >15%, tienda sin visita 14 días, orden no entregada
- Bug fix: `m.nombre` → `m.name` en dropdown de mercaderistas
- Quincena: aviso en el formulario de degustación
- Scripts: `npm run crear-usuarios`, `npm run borrar-datos`, `npm run deploy`
- Render proxy: ✅ desplegado y corriendo
- GitHub: ✅ código subido
- `.env.production`: ✅ URL de Render configurada
- `firebase.json` + `.firebaserc`: ✅ listos para deploy

## 🔴 PRÓXIMO PASO — Publicar app en Firebase Hosting
El build está listo en `dist/`. Solo falta hacer el deploy.

**Problema**: `npm install -g firebase-tools` falla por permisos en Node v24.
**Solución**: instalar localmente:
```bash
cd ~/Downloads/mercaderistas-app
npm install firebase-tools
./node_modules/.bin/firebase login
./node_modules/.bin/firebase deploy --only hosting
```
Al terminar aparece: `Hosting URL: https://mercaderistas-d83a2.web.app`

## ⚠️ PENDIENTES URGENTES
1. **Rotar clave Anthropic** — ir a console.anthropic.com → revocar la actual → crear nueva → actualizar en Render (Environment → ANTHROPIC_API_KEY)
2. **Revocar token GitHub** — ir a GitHub → Settings → Developer settings → Personal access tokens → revocar el token usado en esta sesión
3. **Crear cuentas reales** — descargar `scripts/serviceAccount.json` (Firebase Console → Project Settings → Service Accounts) → `npm run crear-usuarios`
4. **Afinar 27 tiendas con GPS aproximado** — Catálogo → filtro "solo aproximadas" → pegar link Google Maps

## 💡 SUGERIDOS (próxima sesión)
- Comparación de precios entre tiendas
- Ranking de mercaderistas
- Histórico/tendencia de ventas (recharts)
- Control de merma/devoluciones
- Exportar reporte diario como Excel
