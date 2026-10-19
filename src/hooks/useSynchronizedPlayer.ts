import { useCallback, useEffect, useRef, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { rtdb } from '../firebase/database'
import { writeRoomState } from '../services/appService'
import type { RoomState } from '../types'

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (videoId: string, startSeconds?: number) => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlaybackRate: () => number
  getPlayerState: () => number
  destroy: () => void
}

let apiPromise: Promise<void> | undefined
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve()
    if (!document.querySelector('script[data-youtube-api]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.youtubeApi = 'true'
      document.head.appendChild(script)
    }
  })
  return apiPromise
}

interface Options {
  roomId: string
  uid: string
  videoId: string
  enabled?: boolean
  onVideoEnded: () => void
}

export function useSynchronizedPlayer({ roomId, uid, videoId, enabled = true, onVideoEnded }: Options) {
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const remoteStateRef = useRef<RoomState | null>(null)
  const latestVideoRef = useRef(videoId)
  const lastAppliedRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const onEndedRef = useRef(onVideoEnded)
  onEndedRef.current = onVideoEnded
  latestVideoRef.current = videoId

  const applyRemoteState = useCallback((state: RoomState) => {
    if (state.provider && state.provider !== 'youtube') return
    const player = playerRef.current
    if (!player) return
    // Ignorar estados que escribimos nosotros para evitar bucles entre dispositivos.
    if (state.updatedBy === uid) return
    // Ignorar estados antiguos o desordenados.
    if (state.updatedAt && state.updatedAt <= lastAppliedRef.current) return
    lastAppliedRef.current = state.updatedAt || Date.now()
    if (state.videoId && state.videoId !== latestVideoRef.current) {
      latestVideoRef.current = state.videoId
      player.loadVideoById(state.videoId, Math.max(state.currentTime || 0, 0))
    } else {
      const drift = Math.abs(player.getCurrentTime() - (state.currentTime || 0))
      if (drift > 1.5) player.seekTo(state.currentTime || 0, true)
      if (state.playbackRate && player.getPlaybackRate() !== state.playbackRate) player.setPlaybackRate(state.playbackRate)
      if (state.playing && player.getPlayerState() !== window.YT?.PlayerState.PLAYING) player.playVideo()
      if (!state.playing && player.getPlayerState() === window.YT?.PlayerState.PLAYING) player.pauseVideo()
    }
  }, [uid])

  useEffect(() => {
    let cancelled = false
    if (!enabled) return
    void loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return
      playerRef.current = new window.YT.Player(mountRef.current, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
        events: {
          onReady: () => {
            if (cancelled) return
            setReady(true)
            if (remoteStateRef.current) applyRemoteState(remoteStateRef.current)
          },
          onStateChange: (event: { data: number }) => {
            const player = playerRef.current
            if (!player || !window.YT) return
            if (event.data === window.YT.PlayerState.ENDED) {
              if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current)
              heartbeatRef.current = null
              onEndedRef.current()
              return
            }
            if (event.data === window.YT.PlayerState.PLAYING || event.data === window.YT.PlayerState.PAUSED) {
              if (event.data === window.YT.PlayerState.PAUSED && heartbeatRef.current !== null) {
                window.clearInterval(heartbeatRef.current)
                heartbeatRef.current = null
              }
              void writeRoomState(roomId, uid, {
                videoId: latestVideoRef.current,
                provider: 'youtube',
                playing: event.data === window.YT.PlayerState.PLAYING,
                currentTime: player.getCurrentTime(),
                playbackRate: player.getPlaybackRate(),
              }).catch(console.error)
              if (event.data === window.YT.PlayerState.PLAYING && heartbeatRef.current === null) {
                heartbeatRef.current = window.setInterval(() => {
                  const activePlayer = playerRef.current
                  if (!activePlayer || !window.YT || activePlayer.getPlayerState() !== window.YT.PlayerState.PLAYING) return
                  void writeRoomState(roomId, uid, {
                    videoId: latestVideoRef.current,
                    provider: 'youtube',
                    playing: true,
                    currentTime: activePlayer.getCurrentTime(),
                    playbackRate: activePlayer.getPlaybackRate(),
                  }).catch(console.error)
                }, 4000)
              }
            }
          },
          onPlaybackRateChange: (event: { data: number }) => {
            const isPlaying = playerRef.current?.getPlayerState() === window.YT?.PlayerState.PLAYING
            void writeRoomState(roomId, uid, { videoId: latestVideoRef.current, playing: isPlaying, currentTime: playerRef.current?.getCurrentTime() || 0, playbackRate: event.data }).catch(console.error)
          },
        },
      })
    })
    return () => {
      cancelled = true
      if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [roomId, uid, videoId, enabled, applyRemoteState])

  useEffect(() => {
    if (!enabled) return
    return onValue(ref(rtdb, `rooms/${roomId}/state`), (snapshot) => {
      const state = snapshot.val() as RoomState | null
      if (!state) return
      remoteStateRef.current = state
      applyRemoteState(state)
    })
  }, [roomId, enabled, applyRemoteState])

  useEffect(() => {
    if (!ready) return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return
      setCurrentTime(player.getCurrentTime() || 0)
      setDuration(player.getDuration() || 0)
    }, 700)
    return () => window.clearInterval(timer)
  }, [ready])

  const play = () => playerRef.current?.playVideo()
  const pause = () => playerRef.current?.pauseVideo()
  const setRate = (rate: number) => playerRef.current?.setPlaybackRate(rate)
  const seek = (seconds: number) => {
    playerRef.current?.seekTo(seconds, true)
    const isPlaying = playerRef.current?.getPlayerState() === window.YT?.PlayerState.PLAYING
    void writeRoomState(roomId, uid, { videoId: latestVideoRef.current, provider: 'youtube', playing: isPlaying, currentTime: seconds, playbackRate: playerRef.current?.getPlaybackRate() || 1 }).catch(console.error)
  }
  const fullscreen = () => {
    const frame = mountRef.current?.querySelector('iframe')
    if (frame?.requestFullscreen) void frame.requestFullscreen()
  }

  return { mountRef, ready, currentTime, duration, play, pause, setRate, seek, fullscreen }
}
