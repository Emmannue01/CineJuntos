import { useCallback, useEffect, useRef, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { rtdb } from '../firebase/database'
import { writeRoomState } from '../services/appService'
import type { RoomState } from '../types'

interface Options {
  roomId: string
  uid: string
  mediaUrl: string
  enabled: boolean
  onVideoEnded: () => void
}

export function useSynchronizedMedia({ roomId, uid, mediaUrl, enabled, onVideoEnded }: Options) {
  const mountRef = useRef<HTMLVideoElement>(null)
  const onEndedRef = useRef(onVideoEnded)
  const lastAppliedRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  onEndedRef.current = onVideoEnded

  const applyRemoteState = useCallback((state: RoomState) => {
    const video = mountRef.current
    if (!video) return
    // Ignorar estados que escribimos nosotros para evitar bucles y peleas entre dispositivos.
    if (state.updatedBy === uid) return
    // Ignorar estados antiguos o desordenados.
    if (state.updatedAt && state.updatedAt <= lastAppliedRef.current) return
    if (state.mediaUrl && state.mediaUrl !== mediaUrl) return
    lastAppliedRef.current = state.updatedAt || Date.now()
    if (Math.abs(video.currentTime - (state.currentTime || 0)) > 1.5) video.currentTime = state.currentTime || 0
    if (state.playing && video.paused) void video.play().catch(() => undefined)
    if (!state.playing && !video.paused) video.pause()
  }, [mediaUrl, uid])

  useEffect(() => {
    if (!enabled) { setReady(false); return }
    const video = mountRef.current
    if (!video) return
    if (video.readyState >= 1) setReady(true)
    const stopState = onValue(ref(rtdb, `rooms/${roomId}/state`), (snapshot) => {
      const state = snapshot.val() as RoomState | null
      if (state) applyRemoteState(state)
    })
    const onLoaded = () => setReady(true)
    const onPlaying = () => {
      void writeRoomState(roomId, uid, { videoId: '', mediaUrl, provider: 'direct', playing: true, currentTime: video.currentTime, playbackRate: video.playbackRate }).catch(console.error)
    }
    const onPause = () => {
      if (video.ended) return
      void writeRoomState(roomId, uid, { videoId: '', mediaUrl, provider: 'direct', playing: false, currentTime: video.currentTime, playbackRate: video.playbackRate }).catch(console.error)
    }
    const onEnded = () => onEndedRef.current()
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    return () => {
      stopState()
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
  }, [enabled, mediaUrl, roomId, uid, applyRemoteState])

  useEffect(() => {
    if (!ready || !enabled) return
    const timer = window.setInterval(() => {
      const video = mountRef.current
      if (!video) return
      setCurrentTime(video.currentTime || 0)
      setDuration(video.duration || 0)
    }, 500)
    return () => window.clearInterval(timer)
  }, [enabled, ready])

  const play = () => { void mountRef.current?.play().catch(() => undefined) }
  const pause = () => mountRef.current?.pause()
  const setRate = (rate: number) => {
    const video = mountRef.current
    if (!video) return
    video.playbackRate = rate
    void writeRoomState(roomId, uid, { videoId: '', mediaUrl, provider: 'direct', playing: !video.paused, currentTime: video.currentTime, playbackRate: rate }).catch(console.error)
  }
  const seek = (seconds: number) => {
    const video = mountRef.current
    if (!video) return
    video.currentTime = seconds
    void writeRoomState(roomId, uid, { videoId: '', mediaUrl, provider: 'direct', playing: !video.paused, currentTime: seconds, playbackRate: video.playbackRate }).catch(console.error)
  }
  const fullscreen = () => { if (mountRef.current?.requestFullscreen) void mountRef.current.requestFullscreen() }

  return { mountRef, ready, currentTime, duration, play, pause, setRate, seek, fullscreen }
}
