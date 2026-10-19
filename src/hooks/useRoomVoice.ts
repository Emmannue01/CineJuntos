import { useEffect, useRef, useState } from 'react'
import { onChildAdded, onDisconnect, onValue, push, ref, remove, set, get } from 'firebase/database'
import { rtdb } from '../firebase/database'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'waiting' | 'error'

/**
 * useRoomVoice - Canal de voz tipo Discord para salas
 *
 * Modelo:
 * - Un canal de voz por sala (signalPath = rooms/${roomId}/voice)
 * - Cualquier miembro de la sala se conecta automáticamente al entrar
 * - No depende de un peerUid específico
 * - WebRTC punto a punto entre los miembros de la sala
 * - Micrófono inicia en mute (como Discord)
 */
export function useRoomVoice(roomId: string, uid: string) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [muted, setMuted] = useState(true)
  const [error, setError] = useState('')
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const connectionRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stopsRef = useRef<Array<() => void>>([])
  const remoteDescriptionReadyRef = useRef(false)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const initRef = useRef(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const hasConnectedRef = useRef(false)
  const myOfferRef = useRef<boolean>(false)

  // Canal de voz por sala (no por par de usuarios)
  const signalPath = `rooms/${roomId}/voice`

  function closeConnection() {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    stopsRef.current.forEach((stop) => stop())
    stopsRef.current = []
    connectionRef.current?.close()
    connectionRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    remoteDescriptionReadyRef.current = false
    pendingCandidatesRef.current = []
    setRemoteStream(null)
    setMuted(true)
    setStatus('idle')
    initRef.current = false
    retryCountRef.current = 0
    hasConnectedRef.current = false
    myOfferRef.current = false
  }

  async function start() {
    if (!uid || connectionRef.current || initRef.current || hasConnectedRef.current) return
    initRef.current = true
    setError('')
    setStatus('connecting')
    retryCountRef.current = 0

    try {
      await cleanupSignalization()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      // Empezar SIEMPRE en mute (como Discord)
      stream.getAudioTracks().forEach((track) => { track.enabled = false })

      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      })
      connectionRef.current = connection

      connection.ontrack = (event) => setRemoteStream(event.streams[0] || null)
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connected') {
          setStatus('connected')
          hasConnectedRef.current = true
          if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        } else if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
          setStatus('waiting')
          scheduleRetry()
        }
      }
      connection.onicecandidate = (event) => {
        if (event.candidate) void push(ref(rtdb, `${signalPath}/candidates/${uid}`), event.candidate.toJSON())
      }
      stream.getTracks().forEach((track) => connection.addTrack(track, stream))

      const closedRef = ref(rtdb, `${signalPath}/closed/${uid}`)
      const peerClosedRef = ref(rtdb, `${signalPath}/closed/all`)
      await remove(closedRef)
      await onDisconnect(closedRef).set(true)

      // Escuchar cuando alguien se desconecta
      stopsRef.current.push(onValue(peerClosedRef, (snapshot) => {
        if (snapshot.val() === true) closeConnection()
      }))

      // Escuchar ofertas de otros usuarios
      stopsRef.current.push(onChildAdded(ref(rtdb, `${signalPath}/offers`), async (snapshot) => {
        const offerData = snapshot.val() as { fromUid: string; offer: RTCSessionDescriptionInit } | null
        if (!offerData || offerData.fromUid === uid) return
        if (connection.remoteDescription) return

        await connection.setRemoteDescription(offerData.offer)
        remoteDescriptionReadyRef.current = true

        // Agregar candidatos pendientes
        await Promise.all(pendingCandidatesRef.current.splice(0).map((candidate) => connection.addIceCandidate(candidate)))

        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        await set(ref(rtdb, `${signalPath}/answers/${uid}`), { toUid: offerData.fromUid, answer })
      }))

      // Escuchar respuestas a mi oferta
      stopsRef.current.push(onValue(ref(rtdb, `${signalPath}/answers/${uid}`), async (snapshot) => {
        const answerData = snapshot.val() as { toUid: string; answer: RTCSessionDescriptionInit } | null
        if (!answerData || answerData.toUid !== uid) return
        if (connection.remoteDescription) return

        await connection.setRemoteDescription(answerData.answer)
        remoteDescriptionReadyRef.current = true

        await Promise.all(pendingCandidatesRef.current.splice(0).map((candidate) => connection.addIceCandidate(candidate)))
      }))

      // Escuchar candidatos de otros
      stopsRef.current.push(onChildAdded(ref(rtdb, `${signalPath}/candidates`), (snapshot) => {
        const candidateData = snapshot.val() as { fromUid: string; candidate: RTCIceCandidateInit } | null
        if (!candidateData || candidateData.fromUid === uid) return

        const candidate = candidateData.candidate
        if (remoteDescriptionReadyRef.current) {
          void connection.addIceCandidate(candidate)
        } else {
          pendingCandidatesRef.current.push(candidate)
        }
      }))

      // Crear oferta si soy el primero en la sala
      const offersSnapshot = await get(ref(rtdb, `${signalPath}/offers`))
      const existingOffers = offersSnapshot.val()

      if (!existingOffers || Object.keys(existingOffers).length === 0) {
        // Soy el primero, creo la oferta
        myOfferRef.current = true
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await set(ref(rtdb, `${signalPath}/offers/${uid}`), { fromUid: uid, offer })
      } else {
        // Hay ofertas existentes, yo respondo a la primera
        const offerKeys = Object.keys(existingOffers)
        const firstOfferKey = offerKeys[0]
        const firstOffer = existingOffers[firstOfferKey] as { fromUid: string; offer: RTCSessionDescriptionInit }

        if (firstOffer.fromUid !== uid) {
          await connection.setRemoteDescription(firstOffer.offer)
          remoteDescriptionReadyRef.current = true

          await Promise.all(pendingCandidatesRef.current.splice(0).map((candidate) => connection.addIceCandidate(candidate)))

          const answer = await connection.createAnswer()
          await connection.setLocalDescription(answer)
          await set(ref(rtdb, `${signalPath}/answers/${firstOffer.fromUid}`), { toUid: firstOffer.fromUid, answer })
        } else {
          // Mi propia oferta ya está, no hacer nada
          myOfferRef.current = true
        }
      }

      setStatus('waiting')
      scheduleRetry()
    } catch (cause) {
      closeConnection()
      const errorName = cause instanceof DOMException ? cause.name : ''
      setError(errorName === 'NotAllowedError' ? 'Permite el acceso al micrófono para hablar.' : '')
      setStatus('error')
    }
  }

  async function cleanupSignalization() {
    try {
      await remove(ref(rtdb, `${signalPath}/offers/${uid}`))
      await remove(ref(rtdb, `${signalPath}/answers/${uid}`))
      await remove(ref(rtdb, `${signalPath}/candidates/${uid}`))
      await remove(ref(rtdb, `${signalPath}/closed/${uid}`))
    } catch { /* ignorar */ }
  }

  function scheduleRetry() {
    if (retryTimeoutRef.current) return
    if (retryCountRef.current >= 5) return
    retryTimeoutRef.current = setTimeout(() => {
      retryTimeoutRef.current = null
      retryCountRef.current += 1
      if (status === 'waiting' || status === 'error') {
        closeConnection()
        void start()
      }
    }, 5000)
  }

  async function retry() {
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
    closeConnection()
    retryCountRef.current = 0
    hasConnectedRef.current = false
    myOfferRef.current = false
    setError('')
    setStatus('connecting')
    void start()
  }

  function toggleMute() {
    const nextMuted = !muted
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted })
    setMuted(nextMuted)
  }

  async function stop() {
    closeConnection()
    try {
      await remove(ref(rtdb, `${signalPath}/candidates/${uid}`))
      await set(ref(rtdb, `${signalPath}/closed/${uid}`), true)
      await onDisconnect(ref(rtdb, `${signalPath}/closed/${uid}`)).cancel()
    } catch { /* ok */ }
  }

  // Auto-conectar al entrar a la sala — como Discord, conecta una sola vez y se mantiene
  // No requiere peerUid, solo necesita estar en la sala
  useEffect(() => {
    if (!uid) {
      setStatus('idle')
      return
    }
    // Solo iniciar una vez, no reiniciar en cada re-render
    if (!initRef.current && !hasConnectedRef.current) {
      void start()
    }
    return () => {
      // No cerrar aquí — solo cerrar cuando el usuario cuelgue o salga de la sala
    }
  }, [uid, roomId])

  // Limpiar solo cuando el componente se desmonta completamente (salir de la sala)
  useEffect(() => () => {
    stopsRef.current.forEach((stopListener) => stopListener())
    connectionRef.current?.close()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  return { status, muted, error, stream: remoteStream, start, stop, toggleMute, retry }
}
