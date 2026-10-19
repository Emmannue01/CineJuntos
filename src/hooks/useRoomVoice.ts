import { useEffect, useRef, useState } from 'react'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

/**
 * useRoomVoice - Chat de voz tipo Discord usando Daily.co
 *
 * Funciona con salas (rooms) de Daily.co, soporta muchas personas simultáneamente.
 * No requiere servidor propio ni Cloud Functions.
 */
export function useRoomVoice(roomId: string, uid: string) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState('')
  const dailyCallRef = useRef<any>(null)
  const initRef = useRef(false)

  const dailyApiKey = import.meta.env.VITE_DAILY_API_KEY

  async function start() {
    if (!dailyApiKey) {
      setError('Daily.co no configurado. Agrega VITE_DAILY_API_KEY en Vercel.')
      setStatus('error')
      return
    }

    if (dailyCallRef.current) return
    initRef.current = true
    setStatus('connecting')

    try {
      // Cargar el SDK de Daily.co dinámicamente
      await loadDailyScript()

      const DailyCall = (window as any).DailyCall
      if (!DailyCall) {
        throw new Error('Daily.co SDK no se cargó correctamente')
      }

      // Crear una sala única por roomId de CineJuntos
      const roomName = `cinejuntos-${roomId}`

      const call = DailyCall.createCallObject()
      dailyCallRef.current = call

      // Eventos de Daily.co
      call.on('call-joined', () => {
        setStatus('connected')
        setError('')
      })

      call.on('call-left', () => {
        setStatus('idle')
        dailyCallRef.current = null
      })

      call.on('error', (err: any) => {
        setError(err.message || 'Error en Daily.co')
        setStatus('error')
      })

      // Unirse a la sala con micrófono iniciado en mute (como Discord)
      await call.join({
        url: `https://${dailyApiKey}.daily.co/${roomName}`,
        config: {
          startAudioOff: true, // Iniciar en mute
          startVideoOff: true, // Sin video
        },
      })

      setStatus('connected')
    } catch (cause) {
      closeConnection()
      const errorName = cause instanceof Error ? cause.message : 'Error desconocido'
      setError(errorName)
      setStatus('error')
    }
  }

  async function stop() {
    closeConnection()
  }

  function toggleMute() {
    const call = dailyCallRef.current
    if (!call) return
    try {
      call.leave()
      void start()
    } catch { /* ignorar */ }
  }

  function closeConnection() {
    if (dailyCallRef.current) {
      try { dailyCallRef.current.leave() } catch { /* ignorar */ }
      dailyCallRef.current = null
    }
    initRef.current = false
    setStatus('idle')
    setError('')
  }

  async function retry() {
    closeConnection()
    setStatus('connecting')
    void start()
  }

  // Cargar script de Daily.co con timeout
  async function loadDailyScript(): Promise<void> {
    if ((window as any).DailyCall) return

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/@daily-co/daily-js@0.28.0/dist/daily-js.min.js'
      script.async = true
      script.defer = true

      const timeout = setTimeout(() => {
        script.remove()
        reject(new Error('Tiempo de espera agotado cargando Daily.co SDK'))
      }, 15000)

      script.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      script.onerror = () => {
        clearTimeout(timeout)
        script.remove()
        reject(new Error('No se pudo cargar Daily.co SDK'))
      }
      document.head.appendChild(script)
    })
  }

  // Auto-conectar al entrar a la sala
  useEffect(() => {
    if (!uid) {
      setStatus('idle')
      return
    }
    if (!initRef.current) {
      void start()
    }
    return () => {
      // No cerrar en re-render, solo al desmontar
    }
  }, [uid, roomId])

  // Limpiar al salir completamente de la sala
  useEffect(() => () => {
    closeConnection()
  }, [])

  return { status, muted: true, error, stream: null, start, stop, toggleMute, retry }
}
