import { useEffect, useState } from 'react'
import type { DatabaseReference } from 'firebase/database'

/**
 * Observa (solo lectura) si un usuario está en línea.
 * No escribe nada en Realtime Database.
 */
export function usePresence(uid?: string) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    setOnline(false)
    if (!uid) return
    let active = true
    let stop: (() => void) | undefined
    void Promise.all([import('firebase/database'), import('../firebase/database')]).then(([sdk, firebase]) => {
      if (!active) return
      stop = sdk.onValue(sdk.ref(firebase.rtdb, `presence/${uid}`), (snapshot) => {
        const value = snapshot.val() as { online?: boolean; lastSeen?: number } | null
        if (!active) return
        // `lastSeen` protege contra registros "en línea" que quedaron huérfanos.
        const lastSeen = typeof value?.lastSeen === 'number' ? value.lastSeen : 0
        const fresh = !lastSeen || Date.now() - lastSeen < 150000
        setOnline(value?.online === true && fresh)
      })
    })
    return () => { active = false; stop?.() }
  }, [uid])
  return online
}

/**
 * Publica el estado del usuario actual en `presence/<uid>`.
 *
 * - Se marca en línea cuando hay conexión.
 * - `onDisconnect` marca `online: false` cuando se cierra la pestaña,
 *   se cierra el navegador, se pierde la red o la app se cae.
 * - Al desmontar (por ejemplo al cerrar sesión) también se marca fuera de línea.
 */
export function usePublishPresence(uid?: string) {
  useEffect(() => {
    if (!uid) return
    let active = true
    let sdk: typeof import('firebase/database') | undefined
    let statusRef: DatabaseReference | undefined
    let stopConnected: (() => void) | undefined
    let heartbeat: number | undefined
    let connected = false

    const clearHeartbeat = () => {
      if (heartbeat !== undefined) {
        window.clearInterval(heartbeat)
        heartbeat = undefined
      }
    }

    const setOnline = (online: boolean) => {
      if (!sdk || !statusRef) return
      void sdk.set(statusRef, { online, lastSeen: sdk.serverTimestamp() }).catch((error) => {
        console.error('No se pudo actualizar la presencia', error)
      })
    }

    void Promise.all([import('firebase/database'), import('../firebase/database')]).then(([sdkModule, firebase]) => {
      if (!active) return
      sdk = sdkModule
      statusRef = sdk.ref(firebase.rtdb, `presence/${uid}`)
      const connectedRef = sdk.ref(firebase.rtdb, '.info/connected')
      stopConnected = sdk.onValue(connectedRef, async (snapshot) => {
        connected = snapshot.val() === true
        if (!active || !connected) return
        try {
          // Se registra ANTES de marcar en línea para que el servidor tenga
          // el respaldo listo si la conexión se corta de golpe.
          await sdk!.onDisconnect(statusRef!).set({ online: false, lastSeen: sdk!.serverTimestamp() })
          if (!active) return
          await sdk!.set(statusRef!, { online: true, lastSeen: sdk!.serverTimestamp() })
          // Latido periódico: mantiene `lastSeen` fresco para que otros
          // puedan distinguir una sesión viva de un registro huérfano.
          clearHeartbeat()
          heartbeat = window.setInterval(() => {
            if (!active) return
            void sdk!.set(statusRef!, { online: true, lastSeen: sdk!.serverTimestamp() }).catch(() => undefined)
          }, 45000)
        } catch (error) {
          console.error('No se pudo actualizar la presencia', error)
        }
      })
    })

    // Aviso inmediato al salir de la página. Si el aviso no llega a enviarse,
    // onDisconnect se encarga igualmente al cerrarse la conexión.
    const handlePageHide = () => { if (active) setOnline(false) }
    const handlePageShow = () => { if (active && connected) setOnline(true) }
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      active = false
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      clearHeartbeat()
      stopConnected?.()
      if (sdk && statusRef) {
        void sdk.onDisconnect(statusRef).cancel().catch(() => undefined)
        void sdk.set(statusRef, { online: false, lastSeen: sdk.serverTimestamp() }).catch(() => undefined)
      }
    }
  }, [uid])
}
