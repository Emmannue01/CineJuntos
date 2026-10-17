import { useEffect, useState } from 'react'

export function usePresence(uid?: string) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    if (!uid) return
    let active = true
    let unsubscribe: (() => void) | undefined
    let statusListener: (() => void) | undefined
    void Promise.all([import('firebase/database'), import('../firebase/database')]).then(([sdk, firebase]) => {
      if (!active) return
      const statusRef = sdk.ref(firebase.rtdb, `presence/${uid}`)
      const connectedRef = sdk.ref(firebase.rtdb, '.info/connected')
      unsubscribe = sdk.onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() !== true || !active) return
        try {
          await sdk.onDisconnect(statusRef).set({ online: false, lastSeen: sdk.serverTimestamp() })
          await sdk.set(statusRef, { online: true, lastSeen: sdk.serverTimestamp() })
        } catch (error) { console.error('No se pudo actualizar la presencia', error) }
      })
      statusListener = sdk.onValue(statusRef, (snapshot) => setOnline(snapshot.val()?.online === true))
    })
    return () => {
      active = false
      unsubscribe?.()
      statusListener?.()
    }
  }, [uid])
  return online
}
