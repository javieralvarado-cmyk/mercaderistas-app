# 🚀 Guía de instalación — Sistema Mercaderistas

## Paso 1: Instalar Node.js
Ve a https://nodejs.org → descarga e instala la versión LTS.

## Paso 2: Crear proyecto Firebase (gratis)
1. Ve a https://console.firebase.google.com
2. Click "Crear proyecto" → pon un nombre (ej: "mercaderistas-empresa")
3. Desactiva Google Analytics si quieres (opcional)
4. Click "Crear proyecto"

### Activar servicios:
- **Authentication** → Get started → Email/Contraseña → Habilitar → Guardar
- **Firestore Database** → Create database → Start in production mode → elegir región (us-central1) → Done
- **Storage** → Get started → Next → Done

### Obtener configuración:
- Click en el ícono ⚙️ → "Configuración del proyecto"
- Bajar hasta "Tus apps" → Click "Web" (</>)  
- Registrar app → copiar el objeto `firebaseConfig`

## Paso 3: Pegar configuración Firebase
Abrir el archivo: `src/services/firebase.js`
Reemplazar los valores de `firebaseConfig` con los tuyos.

## Paso 4: Reglas de Firestore
En Firebase Console → Firestore → Rules, pegar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
    match /visits/{visitId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /supermarkets/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /routes/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## Paso 5: Reglas de Storage
En Firebase Console → Storage → Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Paso 6: Instalar y arrancar
Abrir Terminal en la carpeta del proyecto y ejecutar:

```bash
npm install
npm run dev
```

La app abre en: http://localhost:5173

## Paso 7: Crear usuarios
En Firebase Console → Authentication → Users → Add user:
- Crear cuenta de supervisor (ej: supervisor@tuempresa.com)
- Crear cuentas para cada mercaderista

Luego en Firestore → users → Add document:
- Document ID: (el UID del usuario de Authentication)
- Campos:
  - nombre: "María García"
  - email: "maria@tuempresa.com"
  - rol: "mercaderista"  (o "supervisor")

## Paso 8: Cargar supermercados
En Firestore → supermarkets → Add document:
- nombre: "Super Éxito Centro"
- ciudad: "Bogotá"
- gps: { lat: 4.6097, lng: -74.0817 }

## Paso 9: Publicar en internet (opcional)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

La app queda disponible en: https://tu-proyecto.web.app
