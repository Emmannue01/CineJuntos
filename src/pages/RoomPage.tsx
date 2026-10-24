import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, Clock3, Copy, Expand, ExternalLink, Film, LoaderCircle, MessageCircle, Mic, MicOff, Pause, PhoneOff, Play, Send, Settings2, Users, Volume2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/AppShell'
import StatusAvatar from '../components/StatusAvatar'
import { readableError } from '../lib/errors'
import { usePresence } from '../hooks/usePresence'
import { useSynchronizedPlayer } from '../hooks/useSynchronizedPlayer'
import { useSynchronizedMedia } from '../hooks/useSynchronizedMedia'
import { useRoomVoice } from '../hooks/useRoomVoice'
import { advanceRoom, inviteToRoom, joinRoom, leaveRoom, markRoomEnded, sendChatMessage, subscribeChat, subscribeFriends, subscribeRoom, subscribeRoomState, subscribeVideos, updateRoomVideo } from '../services/appService'
import type { ChatMessage, Room, RoomState, UserProfile, VideoItem } from '../types'
import { mediaEmbedUrl } from '../lib/media'

const reactions = ['❤️', '😂', '😮', '👏', '🍿']

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [joined, setJoined] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [state, setState] = useState<RoomState | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user || !roomId) return
    let active = true
    setError('')
    void joinRoom(roomId, user.uid).then(() => { if (active) setJoined(true) }).catch((cause) => { if (active) setError(readableError(cause)) })
    return () => { active = false }
  }, [user, roomId])

  useEffect(() => {
    if (!joined || !user || !roomId) return
    const stops = [
      subscribeRoom(roomId, setRoom),
      subscribeChat(roomId, setMessages),
      subscribeRoomState(roomId, (value) => setState(value as RoomState | null)),
      subscribeFriends(user.uid, setFriends),
    ]
    return () => stops.forEach((stop) => stop())
  }, [joined, user, roomId])



  if (!joined) return <div className="room-loading"><LoaderCircle size={23} className="spin" /><span>{error || 'Preparando la sala…'}</span>{error && <button className="small-outline-button" onClick={() => navigate('/')}>Volver al inicio</button>}</div>
  if (!room || !user) return <div className="room-loading"><LoaderCircle size={23} className="spin" /><span>Cargando la función…</span></div>
  return <RoomExperience key={room.id} room={room} uid={user.uid} username={profile?.displayName || user.displayName || 'Tú'} avatar={profile?.avatar || user.photoURL || ''} state={state} messages={messages} friends={friends} error={error} setError={setError} busy={busy} setBusy={setBusy} message={message} setMessage={setMessage} copied={copied} setCopied={setCopied} />
}

function RoomExperience(props: {
  room: Room; uid: string; username: string; avatar: string; state: RoomState | null; messages: ChatMessage[]; friends: UserProfile[]; error: string; setError: (value: string) => void; busy: boolean; setBusy: (value: boolean) => void; message: string; setMessage: (value: string) => void; copied: boolean; setCopied: (value: boolean) => void
}) {
  const { room, uid, username, avatar, state, messages, friends, error, setError, busy, setBusy, message, setMessage, copied, setCopied } = props
  const partnerUid = room.memberUids.find((member) => member !== uid) || ''
  const voice = useRoomVoice(room.id, uid, partnerUid)
  const [playError, setPlayError] = useState('')
  const [speed, setSpeed] = useState('1')
  const messageEndRef = useRef<HTMLDivElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const ended = room.status === 'ended'
  const activeVideoId = state?.videoId || room.videoId
  const activeProvider = state?.provider || room.provider || 'youtube'
  const activeMediaUrl = state?.mediaUrl || room.mediaUrl || ''
  const advanceVideo = () => {
    if (ended) return
    void advanceRoom(room.id, room.currentItemId).catch((cause) => setPlayError(readableError(cause)))
  }
  const youtubePlayer = useSynchronizedPlayer({
    roomId: room.id,
    uid,
    videoId: activeVideoId,
    enabled: activeProvider === 'youtube',
    onVideoEnded: advanceVideo,
  })
  const mediaPlayer = useSynchronizedMedia({ roomId: room.id, uid, mediaUrl: activeMediaUrl, enabled: activeProvider === 'direct', onVideoEnded: advanceVideo })
  const player = activeProvider === 'direct' ? mediaPlayer : youtubePlayer
  const partner = friends.find((friend) => friend.uid === partnerUid)
  const pendingInviteUid = room.invitedUids.find((invitee) => invitee !== uid)
  const inviteOptions = friends.filter((friend) => friend.uid !== partnerUid)
  const [listVideos, setListVideos] = useState<VideoItem[]>([])
  const [changeVideoOpen, setChangeVideoOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!room.watchlistId) { setListVideos([]); return }
    return subscribeVideos(room.watchlistId, setListVideos)
  }, [room.watchlistId])

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    const audio = remoteAudioRef.current
    if (!audio) return
    audio.srcObject = voice.stream
    if (voice.stream) void audio.play().catch(() => undefined)
  }, [voice.stream])
  useEffect(() => {
    if (state?.playbackRate) setSpeed(String(state.playbackRate))
  }, [state?.playbackRate])

  async function sendText(kind: 'message' | 'reaction', text: string) {
    const clean = text.trim()
    if (!clean || clean.length > 500) return
    setPlayError('')
    try {
      await sendChatMessage(room.id, { uid, username, avatar, text: clean, createdAt: Date.now(), kind })
      setMessage('')
    } catch (cause) { setPlayError(readableError(cause)) }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    await sendText('message', message)
  }

  async function inviteFriend(targetUid: string) {
    setInviteOpen(false)
    setBusy(true); setPlayError('')
    try { await inviteToRoom(room.id, targetUid) }
    catch (cause) { setPlayError(readableError(cause)) }
    finally { setBusy(false) }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setPlayError('No se pudo copiar el enlace. Puedes copiarlo desde la barra del navegador.') }
  }

  async function changeVideo() {
    setChangeVideoOpen(true)
  }

  async function selectListVideo(video: VideoItem) {
    setChangeVideoOpen(false)
    setBusy(true)
    try {
      await updateRoomVideo(room.id, uid, {
        videoId: video.videoId,
        mediaUrl: video.mediaUrl || `https://www.youtube.com/watch?v=${video.videoId}`,
        provider: video.provider || 'youtube',
        title: video.title,
        thumbnail: video.thumbnail || '',
      })
      setPlayError('')
    } catch (cause) { setPlayError(readableError(cause)) }
    finally { setBusy(false) }
  }

  async function exitRoom() {
    setExitOpen(true)
  }

  async function leaveOnly() {
    setExitOpen(false)
    setBusy(true)
    try { await leaveRoom(room.id, uid) } catch (cause) { setError(readableError(cause)) }
    setBusy(false)
    navigate('/')
  }

  async function endRoom() {
    setExitOpen(false)
    setBusy(true)
    try { await markRoomEnded(room.id) } catch (cause) { setError(readableError(cause)) }
    setBusy(false)
    navigate('/')
  }

  const play = () => { setPlayError(''); player.play() }
  const pause = () => player.pause()
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  const currentQueue = room.queue || []

  return <div className="room-page page-enter">
    <div className="room-topline"><button className="back-link" onClick={() => void exitRoom()}><ArrowLeft size={16} /> Salir de la sala</button><span className="room-session-label"><span className={ended ? 'status-dot ended' : 'status-dot'} /> {ended ? 'FUNCIÓN TERMINADA' : 'SALA EN VIVO'} <span className="room-code">#{room.id.slice(0, 6).toUpperCase()}</span></span><div className="room-topline-actions"><button className="share-room-button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Compartir enlace'}</button><button className="share-room-button" onClick={changeVideo}><Settings2 size={15} /> Cambiar video</button></div></div>
    <div className="room-title"><div><span className="section-kicker">ESTÁN VIENDO</span><h1>{room.title}</h1></div><div className="room-watchers">{partner ? <><StatusAvatar uid={partner.uid} name={partner.displayName} photoURL={partner.avatar} size="small" /><span><strong>{partner.displayName}</strong><small>está en la sala</small></span></> : pendingInviteUid ? <><span className="waiting-avatar"><Clock3 size={15} /></span><span><strong>Esperando a tu amigo</strong><small>La invitación está en camino</small></span></> : <><span className="waiting-avatar"><UsersIcon /></span><span><strong>Solo por ahora</strong><small>Invita a alguien para compartir</small></span></>}</div></div>
    {error && <div className="inline-alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{playError && <div className="inline-alert" role="alert">{playError}<button onClick={() => setPlayError('')}>Cerrar</button></div>}
    <div className="room-layout">
      <section className="player-column"><div className="player-frame">{activeProvider === 'youtube' ? <div ref={youtubePlayer.mountRef} className="youtube-mount" /> : activeProvider === 'direct' ? <video className="native-player" ref={mediaPlayer.mountRef} src={activeMediaUrl} playsInline /> : <iframe className="external-player" src={mediaEmbedUrl(activeMediaUrl, 'embed')} title={room.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}<div className={`player-loading ${player.ready || activeProvider === 'embed' ? 'is-ready' : ''}`}>{activeProvider === 'embed' ? <span>Este reproductor puede no sincronizarse con la sala.</span> : <><LoaderCircle className="spin" size={22} /><span>Preparando la pantalla…</span></>}</div>{ended && <div className="player-ended"><div className="ended-mark"><Check size={26} /></div><span className="section-kicker">FIN DE LA FUNCIÓN</span><h2>Qué buen plan.</h2><p>Ya vieron todo lo que había en la cola.</p><button className="primary-button" onClick={() => void exitRoom()}>Volver al inicio <ArrowLeft size={16} /></button></div>}</div>
        <div className="player-controls"><button className="player-play" onClick={state?.playing ? pause : play} aria-label={state?.playing ? 'Pausar' : 'Reproducir'} disabled={!player.ready || ended}>{state?.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><span className="time-readout">{formatTime(player.currentTime)} <span>/</span> {formatTime(player.duration)}</span><input aria-label="Posición del video" className="progress-range" type="range" min={0} max={Math.max(player.duration, 1)} value={Math.min(player.currentTime, Math.max(player.duration, 1))} onChange={(event) => player.seek(Number(event.target.value))} disabled={!player.ready || ended} /><label className="speed-select"><Settings2 size={15} /><select value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(event.target.value); player.setRate(value) }} aria-label="Velocidad de reproducción"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><button className="bare-icon fullscreen-control" title="Pantalla completa" onClick={player.fullscreen}><Expand size={17} /></button></div>
        <div className="player-underbar"><span><span className={partner ? 'live-dot' : 'live-dot offline'} /> {partner ? `${partner.displayName} ${partnerOnlineLabel(partner.uid)}` : pendingInviteUid ? 'Esperando confirmación' : 'Comparte el enlace para invitar'}</span>{activeProvider === 'embed' ? <span><ExternalLink size={14} /><a href={activeMediaUrl} target="_blank" rel="noreferrer">Abrir contenido en su sitio</a><small>No todos los reproductores permiten sincronización.</small></span> : <span><Volume2 size={14} /> Desfase corregido automáticamente</span>}</div>
        <div className="room-queue-bar"><div><span className="section-kicker">EN LA COLA</span><strong>{currentQueue.length ? `${currentQueue.length} video${currentQueue.length === 1 ? '' : 's'} más` : 'Este es el último video'}</strong></div>{currentQueue[0] && <div className="queue-next">{currentQueue[0].thumbnail && <img src={currentQueue[0].thumbnail} alt="" />}<span><small>DESPUÉS</small><strong>{currentQueue[0].title}</strong></span></div>}</div>
      </section>
      <aside className={`chat-panel chat-open`}><div className="chat-header"><div><span className="section-kicker">COMENTARIOS EN VIVO</span><h2><MessageCircle size={17} /> Sala de chat</h2></div><span className="chat-online"><span className="live-dot" /> {partner ? '2 aquí' : '1 aquí'}</span></div>
        <div className="voice-controls">
          <div className={`voice-status voice-${voice.status}`}>
            <span className="live-dot" />
            {voice.error ? voice.error : voice.status === 'connected' ? 'Voz conectada (micrófono apagado)' : voice.status === 'connecting' ? 'Conectando a la sala de voz…' : voice.status === 'waiting' ? 'Conectando voz (reintentando automáticamente…)' : 'Chat de voz'}
          </div>
          {voice.status === 'connected' && (
            <div className="voice-actions">
              <button className="voice-action" onClick={() => voice.toggleMute()} title={voice.muted ? 'Activar micrófono' : 'Silenciar micrófono'}>
                {voice.muted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button className="voice-hangup" onClick={() => void voice.stop()} title="Salir del chat de voz" aria-label="Salir del chat de voz">
                <PhoneOff size={18} />
              </button>
            </div>
          )}
          {(voice.status === 'idle' || voice.status === 'error') && (
            <button className="voice-action" onClick={() => voice.start()} title={voice.status === 'error' ? 'Reintentar conexión de voz' : 'Iniciar chat de voz'}>
              {voice.status === 'error' ? <Mic size={18} /> : <Mic size={18} />}
            </button>
          )}
          <div className="voice-hint" style={{ fontSize: '8px', color: 'var(--muted)', marginTop: '4px' }}>
            {voice.status === 'connecting' ? 'Conectando a la sala de voz…' : voice.status === 'connected' ? '' : voice.status === 'error' ? 'Haz clic en el micrófono para iniciar' : ''}
          </div>
          <audio ref={remoteAudioRef} autoPlay />
        </div>
        <div className="chat-messages">{messages.length ? messages.map((item) => <ChatBubble message={item} mine={item.uid === uid} key={item.id} />) : <div className="chat-empty"><div className="chat-empty-icon"><MessageCircle size={19} /></div><strong>La sala está en silencio</strong><small>Di hola o manda una reacción.</small></div>}<div ref={messageEndRef} /></div>
        <div className="reaction-row">{reactions.map((emoji) => <button key={emoji} onClick={() => void sendText('reaction', emoji)} aria-label={`Enviar reacción ${emoji}`}>{emoji}</button>)}</div>
        <form className="chat-compose" onSubmit={(event) => void send(event)}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe algo..." maxLength={500} disabled={ended} /><button aria-label="Enviar mensaje" disabled={!message.trim() || ended}><Send size={16} /></button></form>
      </aside>
    </div>
    <div className="room-bottom-actions">
      <div className="invite-section">
        {pendingInviteUid ? (
          <div className="invite-pending"><span className="live-dot" /><span>Esperando a <strong>{friends.find((f) => f.uid === pendingInviteUid)?.displayName || 'tu amigo'}</strong>…</span></div>
        ) : (
          <div className="invite-actions">
            <button className="invite-button" onClick={() => setInviteOpen(true)} disabled={busy || room.memberUids.length + room.invitedUids.length >= 2}><Users size={15} /> Invitar amigo</button>
            {inviteOptions.length === 0 && <span className="invite-empty">Sin amigos para invitar</span>}
          </div>
        )}
        {inviteOpen && (
          <div className="invite-dropdown">
            <div className="invite-dropdown-header"><span className="section-kicker">INVITAR A UN AMIGO</span><button className="invite-dropdown-close" onClick={() => setInviteOpen(false)}><X size={18} /></button></div>
            {inviteOptions.length === 0 ? (
              <div className="invite-empty-state"><span className="empty-icon"><Users size={20} /></span><div><strong>No tienes amigos</strong><small>Agrega amigos desde la sección "Amigos" para invitarlos a una sala.</small></div></div>
            ) : (
              <div className="invite-list">{inviteOptions.map((friend) => (
                <button key={friend.uid} className="invite-item" onClick={(event) => { event.stopPropagation(); void inviteFriend(friend.uid) }}><div className="invite-item-avatar"><StatusAvatar uid={friend.uid} name={friend.displayName} photoURL={friend.avatar} /></div><div className="invite-item-info"><strong>{friend.displayName}</strong><small>@{friend.username}</small></div><span className="invite-item-action">Invitar</span></button>
              ))}</div>
            )}
          </div>
        )}
      </div>
      <button className="leave-room-bottom" onClick={() => void exitRoom()} disabled={busy}>Salir de la sala</button>
    </div>
    {changeVideoOpen && createPortal(
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChangeVideoOpen(false) }}>
        <section className="modal-card change-video-modal" role="dialog" aria-modal="true" aria-labelledby="change-video-title">
          <button type="button" className="modal-close" onClick={() => setChangeVideoOpen(false)} aria-label="Cerrar">×</button>
          <header className="modal-header">
            <div>
              <span className="modal-kicker"><Settings2 size={13} /> CAMBIAR VIDEO</span>
              <h2 id="change-video-title">Elige de tu lista</h2>
            </div>
          </header>
          <div className="modal-body change-video-body">
            {listVideos.length === 0 ? (
              <div className="change-video-empty">
                <span className="empty-icon"><Film size={18} /></span>
                <div><strong>No hay videos en la lista</strong><small>Añade videos desde "Mi lista" para cambiarlos aquí.</small></div>
              </div>
            ) : (
              <div className="change-video-list">
                {listVideos.map((video) => (
                  <button type="button" className="change-video-item" key={video.id} onClick={() => void selectListVideo(video)} disabled={busy}>
                    <span className="change-video-thumb">
                      {video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="video-thumb-placeholder"><Film size={17} /></span>}
                    </span>
                    <span className="change-video-copy">
                      <strong>{video.title}</strong>
                      <small>{providerLabel(video.provider)}</small>
                    </span>
                    <span className="change-video-action">
                      {busy ? <LoaderCircle size={12} className="spin" /> : <Play size={12} fill="currentColor" />}
                      <span>{busy ? 'Cambiando' : 'Poner'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <footer className="modal-actions">
            <button type="button" className="primary-button" onClick={() => setChangeVideoOpen(false)}>Cerrar</button>
          </footer>
        </section>
      </div>,
      document.body
    )}
    {exitOpen && createPortal(
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExitOpen(false) }}>
        <section className="modal-card exit-modal" role="dialog" aria-modal="true" aria-labelledby="exit-room-title">
          <button type="button" className="modal-close" onClick={() => setExitOpen(false)} aria-label="Cerrar">×</button>
          <header className="modal-header">
            <div>
              <span className="modal-kicker"><ArrowLeft size={13} /> SALIR DE LA SALA</span>
              <h2 id="exit-room-title">¿Qué deseas hacer?</h2>
            </div>
          </header>
          <div className="modal-body exit-body">
            <div className="exit-options">
              <button type="button" className="exit-option" onClick={() => void leaveOnly()}>
                <span>Solo salir</span>
                <small>La sala sigue activa para tu amigo</small>
              </button>
              <button type="button" className="exit-option exit-end" onClick={() => void endRoom()}>
                <span>Terminar sala</span>
                <small>La función se acaba para todos</small>
              </button>
            </div>
          </div>
          <footer className="modal-actions">
            <button type="button" className="text-link" onClick={() => setExitOpen(false)}>Cancelar</button>
          </footer>
        </section>
      </div>,
      document.body
    )}
  </div>
}

function providerLabel(provider?: VideoItem['provider']) {
  if (provider === 'direct') return 'Video/audio directo'
  if (provider === 'youtube') return 'YouTube'
  if (provider === 'embed') return 'Reproductor externo'
  return 'Contenido multimedia'
}

function partnerOnlineLabel(uid: string) {
  return <PartnerPresence uid={uid} />
}

function PartnerPresence({ uid }: { uid: string }) {
  const online = usePresence(uid)
  return <>{online ? 'está conectado' : 'se desconectó'}</>
}

function ChatBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (message.kind === 'reaction') return <div className={`reaction-message ${mine ? 'mine' : ''}`}><span>{message.text}</span><small>{mine ? 'Tú' : message.username}</small></div>
  return <article className={`chat-message ${mine ? 'mine' : ''}`}><Avatar name={message.username} url={message.avatar} size="small" /><div><strong>{mine ? 'Tú' : message.username}</strong><p>{message.text}</p><small>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(message.createdAt)}</small></div></article>
}

function UsersIcon() { return <Users size={16} /> }
