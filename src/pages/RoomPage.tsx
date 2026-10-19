import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3, Copy, Expand, ExternalLink, Film, LoaderCircle, MessageCircle, Mic, MicOff, Pause, PhoneOff, Play, Send, Settings2, Users, Volume2, X } from 'lucide-react'
import { onValue, ref } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/AppShell'
import StatusAvatar from '../components/StatusAvatar'
import { rtdb } from '../firebase/database'
import { readableError } from '../lib/errors'
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
  const voice = useRoomVoice(room.id, uid)
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
            {voice.error ? voice.error : voice.status === 'connected' ? 'Voz conectada (micrófono apagado)' : voice.status === 'connecting' ? 'Conectando voz…' : voice.status === 'waiting' ? 'Conectando voz (reintentando automáticamente…)': 'Chat de voz'}
          </div>
          {partnerUid && voice.status === 'connected' && (
            <div className="voice-actions">
              <button className="voice-action" onClick={() => voice.toggleMute()} title={voice.muted ? 'Activar micrófono' : 'Silenciar micrófono'}>
                {voice.muted ? <MicOff size={16} /> : <Mic size={16} />}
                <span>{voice.muted ? 'Activar micrófono' : 'Silenciar micrófono'}</span>
              </button>
              <button className="voice-hangup" onClick={() => void voice.stop()} title="Salir del chat de voz" aria-label="Salir del chat de voz">
                <PhoneOff size={16} />
                <span>Colgar</span>
              </button>
            </div>
          )}
          {partnerUid && voice.status === 'error' && (
            <button className="voice-action" onClick={() => voice.retry()} title="Reintentar conexión de voz">
              <Mic size={16} />
              <span>Reintentar</span>
            </button>
          )}
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
    {changeVideoOpen && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChangeVideoOpen(false) }}>
        <form className="modal-card" onSubmit={(event) => { event.preventDefault() }}>
          <button type="button" className="modal-close" onClick={() => setChangeVideoOpen(false)}>×</button>
          <span className="section-kicker">CAMBIAR VIDEO</span>
          <h2>Elige de tu lista</h2>
          {listVideos.length === 0 ? (
            <div className="empty-inline" style={{ justifyContent: 'center', textAlign: 'center', padding: '20px 0' }}>
              <div><strong>No hay videos en la lista</strong><small>Añade videos desde "Mi lista" para cambiarlos aquí.</small></div>
            </div>
          ) : (
            <div className="video-list" style={{ maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
              {listVideos.map((video) => (
                <article key={video.id} className="video-item" style={{ padding: '8px 3px', cursor: 'pointer', borderBottom: '1px solid var(--line)' }} onClick={() => void selectListVideo(video)}>
                  <div className="video-thumb" style={{ width: '70px', height: '42px', flexShrink: 0 }}>
                    {video.thumbnail ? <img src={video.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }} /> : <span className="video-thumb-placeholder"><Film size={15} /></span>}
                  </div>
                  <div className="video-info" style={{ flex: 1, minWidth: 0 }}>
                    <strong className="video-title-clamp" style={{ fontSize: '10px', lineHeight: '1.3' }}>{video.title}</strong>
                    <small style={{ fontSize: '8px' }}>{video.provider === 'youtube' ? 'YouTube' : video.provider || 'Video'}</small>
                  </div>
                  <button className="watch-button" style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: '9px' }} onClick={(event) => { event.stopPropagation(); void selectListVideo(video) }}>Seleccionar</button>
                </article>
              ))}
            </div>
          )}
          <button type="button" className="primary-button" style={{ width: '100%', marginTop: '10px' }} onClick={() => setChangeVideoOpen(false)}>Cerrar</button>
        </form>
      </div>
    )}
    {exitOpen && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExitOpen(false) }}>
        <form className="modal-card" onSubmit={(event) => { event.preventDefault() }}>
          <button type="button" className="modal-close" onClick={() => setExitOpen(false)}>×</button>
          <span className="section-kicker">SALIR DE LA SALA</span>
          <h2>¿Qué deseas hacer?</h2>
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
          <button type="button" className="primary-button" style={{ width: '100%', marginTop: '10px' }} onClick={() => setExitOpen(false)}>Cancelar</button>
        </form>
      </div>
    )}
  </div>
}

function partnerOnlineLabel(uid: string) {
  return <PartnerPresence uid={uid} />
}

function PartnerPresence({ uid }: { uid: string }) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    return onValue(ref(rtdb, `presence/${uid}`), (snapshot) => setOnline(snapshot.val()?.online === true))
  }, [uid])
  return <>{online ? 'está conectado' : 'se desconectó'}</>
}

function ChatBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  if (message.kind === 'reaction') return <div className={`reaction-message ${mine ? 'mine' : ''}`}><span>{message.text}</span><small>{mine ? 'Tú' : message.username}</small></div>
  return <article className={`chat-message ${mine ? 'mine' : ''}`}><Avatar name={message.username} url={message.avatar} size="small" /><div><strong>{mine ? 'Tú' : message.username}</strong><p>{message.text}</p><small>{new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(message.createdAt)}</small></div></article>
}

function UsersIcon() { return <Users size={16} /> }
