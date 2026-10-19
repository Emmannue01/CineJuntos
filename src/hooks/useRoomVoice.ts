import { useEffect, useRef, useState } from 'react'
import { onChildAdded, onDisconnect, onValue, push, ref, remove, set, type DataSnapshot } from 'firebase/database'
import { rtdb } from '../firebase/database'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'waiting' | 'error'

export function useRoomVoice(roomId: string, uid: string, peerUid: string) {
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

  const callerUid = uid.localeCompare(peerUid) < 0 ? uid : peerUid
  const signalPath = `rooms/${roomId}/voice/${callerUid}`

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
  }

  async function start() {
    if (!peerUid || connectionRef.current || initRef.current || hasConnectedRef.current) return
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

      const remoteUid = uid === callerUid ? peerUid : callerUid
      const closedRef = ref(rtdb, `${signalPath}/closed/${uid}`)
      const peerClosedRef = ref(rtdb, `${signalPath}/closed/${peerUid}`)
      await remove(closedRef)
      await onDisconnect(closedRef).set(true)
      stopsRef.current.push(onValue(peerClosedRef, (snapshot) => {
        if (snapshot.val() === true) closeConnection()
      }))

      const addCandidate = async (snapshot: DataSnapshot) => {
        const candidate = snapshot.val() as RTCIceCandidateInit | null
        if (!candidate) return
        if (remoteDescriptionReadyRef.current) await connection.addIceCandidate(candidate)
        else pendingCandidatesRef.current.push(candidate)
      }
      stopsRef.current.push(onChildAdded(ref(rtdb, `${signalPath}/candidates/${remoteUid}`), (snapshot) => {
        void addCandidate(snapshot).catch(() => setStatus('waiting'))
      }))

      if (uid === callerUid) {
        await remove(ref(rtdb, signalPath))
        stopsRef.current.push(onValue(ref(rtdb, `${signalPath}/answer`), async (snapshot) => {
          if (!snapshot.exists() || connection.remoteDescription) return
          await connection.setRemoteDescription(snapshot.val() as RTCSessionDescriptionInit)
          remoteDescriptionReadyRef.current = true
          await Promise.all(pendingCandidatesRef.current.splice(0).map((candidate) => connection.addIceCandidate(candidate)))
        }))
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await set(ref(rtdb, `${signalPath}/offer`), offer)
      } else {
        stopsRef.current.push(onValue(ref(rtdb, `${signalPath}/offer`), async (snapshot) => {
          if (!snapshot.exists() || connection.remoteDescription) return
          await connection.setRemoteDescription(snapshot.val() as RTCSessionDescriptionInit)
          remoteDescriptionReadyRef.current = true
          await Promise.all(pendingCandidatesRef.current.splice(0).map((candidate) => connection.addIceCandidate(candidate)))
          const answer = await connection.createAnswer()
          await connection.setLocalDescription(answer)
          await set(ref(rtdb, `${signalPath}/answer`), answer)
        }))
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
      await remove(ref(rtdb, `${signalPath}/offer`))
      await remove(ref(rtdb, `${signalPath}/answer`))
      await remove(ref(rtdb, `${signalPath}/candidates/${uid}`))
      await remove(ref(rtdb, `${signalPath}/candidates/${peerUid}`))
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
  useEffect(() => {
    if (!peerUid) {
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
  }, [peerUid, roomId, uid])

  // Limpiar solo cuando el componente se desmonta completamente (salir de la sala)
  useEffect(() => () => {
    stopsRef.current.forEach((stopListener) => stopListener())
    connectionRef.current?.close()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  return { status, muted, error, stream: remoteStream, start, stop, toggleMute, retry }
}
