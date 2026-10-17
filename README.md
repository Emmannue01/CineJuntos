# CineJuntos

Aplicación React + Vite para mantener una lista de videos, conectar con amigos y ver YouTube sincronizado en salas privadas de dos personas.

## Requisitos

- Node.js 22 o superior
- Proyecto Firebase con Authentication, Cloud Firestore, Realtime Database y Cloud Functions habilitados
- Firebase CLI (`npm install -g firebase-tools`)

## Configuración local

1. En Firebase Console, crea un proyecto y una aplicación web. Habilita Email/Password y Google en Authentication; crea Firestore y Realtime Database.
2. Copia `.env.example` a `.env` y completa las credenciales de la aplicación web. La URL de RTDB debe corresponder a la instancia creada.
3. En la carpeta del proyecto, instala y ejecuta:

   ```bash
   npm install
   npm install --prefix functions
   npm run dev
   ```

4. Para publicar reglas, índices y funciones, inicia sesión y selecciona el proyecto:

   ```bash
   firebase login
   firebase use --add
   firebase deploy
   ```

   Cloud Functions requieren el plan Blaze de Firebase. Añade el dominio de producción a Authentication > Settings > Authorized domains.

## Compilar y desplegar

```bash
npm run build
npm run deploy:hosting
```

`firebase.json` publica `dist` y reescribe las rutas a `index.html`. Para Vercel, importa el repositorio con `npm run build` como comando de build y `dist` como directorio de salida; configura allí las mismas variables `VITE_*`. `vercel.json` contiene la reescritura de React Router.

Las variables `VITE_*` se incorporan al bundle del navegador y no son secretos. La seguridad depende de Authentication, las reglas incluidas y las funciones callable; nunca pongas claves privadas de Admin en este archivo.
