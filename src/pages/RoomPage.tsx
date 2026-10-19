import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3, Copy, Expand, ExternalLink, LoaderCircle, MessageCircle, Mic, MicOff, Pause, PhoneOff, Play, Send, Settings2, Users, Volume2 } from 'lucide-react'
import { onValue, ref } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/AppShell'
import StatusAvatar from '../components/StatusAvatar'
import { rtdb } from '../firebase/database'
import { readableError } from '../lib/errors'
import { useSynchronizedPlayer } from '../hooks/useSynchronizedPlayer'
import { useSynchronizedMedia } from '../hooks/useSynchronizedMedia'
import { useRoomVoice } from '../hooks/useRoomVoice'
import { advanceRoom, inviteToRoom, joinRoom, leaveRoom, sendChatMessage, subscribeChat, subscribeFriends, subscribeRoom, subscribeRoomState, updateRoomVideo } from '../services/appService'
import type { ChatMessage, Room, RoomState, UserProfile } from '../types'
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
  const [chatOpen, setChatOpen] = useState(false)
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



  async function exit() {
    setBusy(true)
    if (!user) {
      navigate('/')
      return
    }
    try { await leaveRoom(roomId, user.uid) } catch (cause) { setError(readableError(cause)) }
    navigate('/')
  }

  if (!joined) return <div className="room-loading"><LoaderCircle size={23} className="spin" /><span>{error || 'Preparando la sala…'}</span>{error && <button className="small-outline-button" onClick={() => navigate('/')}>Volver al inicio</button>}</div>
  if (!room || !user) return <div className="room-loading"><LoaderCircle size={23} className="spin" /><span>Cargando la función…</span></div>
  return <RoomExperience key={room.id} room={room} uid={user.uid} username={profile?.displayName || user.displayName || 'Tú'} avatar={profile?.avatar || user.photoURL || ''} state={state} messages={messages} friends={friends} error={error} setError={setError} onExit={exit} busy={busy} setBusy={setBusy} chatOpen={chatOpen} setChatOpen={setChatOpen} message={message} setMessage={setMessage} copied={copied} setCopied={setCopied} />
}

function RoomExperience(props: {
  room: Room; uid: string; username: string; avatar: string; state: RoomState | null; messages: ChatMessage[]; friends: UserProfile[]; error: string; setError: (value: string) => void; onExit: () => void; busy: boolean; setBusy: (value: boolean) => void; chatOpen: boolean; setChatOpen: (value: boolean) => void; message: string; setMessage: (value: string) => void; copied: boolean; setCopied: (value: boolean) => void
}) {
  const { room, uid, username, avatar, state, messages, friends, error, setError, onExit, busy, setBusy, chatOpen, setChatOpen, message, setMessage, copied, setCopied } = props
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
  const partnerUid = room.memberUids.find((member) => member !== uid)
  const partner = friends.find((friend) => friend.uid === partnerUid)
  const voice = useRoomVoice(room.id, uid, partnerUid || '')
  const pendingInviteUid = room.invitedUids.find((invitee) => invitee !== uid)
  const inviteOptions = friends.filter((friend) => friend.uid !== partnerUid)

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

  async function invite(event: ChangeEvent<HTMLSelectElement>) {
    const select = event.currentTarget
    const target = select.value
    if (!target) return
    setBusy(true); setPlayError('')
    try { await inviteToRoom(room.id, target) }
    catch (cause) { setPlayError(readableError(cause)) }
    finally { setBusy(false); select.value = '' }
  }

  async function exitRoom() {
    if (voice.active) await voice.stop()
    onExit()
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
    catch { setPlayError('No se pudo copiar el enlace. Puedes copiarlo desde la barra del navegador.') }
  }

  async function changeVideo() {
    const url = prompt('Introduce la URL de YouTube (ej: https://www.youtube.com/watch?v=L2_S8GvIasM)')
    if (!url) return
    const videoId = new URL(url).searchParams.get('v')
    if (!videoId) {
      setPlayError('URL de YouTube no válida')
      return
    }
    setBusy(true)
    try {
      await updateRoomVideo(room.id, uid, {
        videoId,
        mediaUrl: `https://www.youtube.com/watch?v=${videoId}`,
        provider: 'youtube',
        title: 'Video cargado rápidamente',
        thumbnail: '',
      })
      setPlayError('')
    } catch (cause) { setPlayError(readableError(cause)) }
    finally { setBusy(false) }
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
      <aside className={`chat-panel ${chatOpen ? 'chat-open' : ''}`}><div className="chat-header"><div><span className="section-kicker">COMENTARIOS EN VIVO</span><h2><MessageCircle size={17} /> Sala de chat</h2></div><span className="chat-online"><span className="live-dot" /> {partner ? '2 aquí' : '1 aquí'}</span><button className="chat-collapse" onClick={() => setChatOpen(!chatOpen)} aria-label={chatOpen ? 'Cerrar chat' : 'Abrir chat'}><MessageCircle size={17} /></button></div>
        <div className="voice-controls"><div className={`voice-status voice-${voice.status}`}><span className="live-dot" />{voice.error || (voice.status === 'connected' ? 'Voz conectada' : voice.status === 'connecting' ? 'Conectando…' : voice.status === 'waiting' ? 'Esperando conexión' : 'Chat de voz')}</div><button className="voice-action" onClick={() => voice.active ? voice.toggleMute() : void voice.start()} disabled={ended || !partnerUid || voice.status === 'connecting'} title={voice.active ? voice.muted ? 'Activar micrófono' : 'Silenciar micrófono' : 'Iniciar chat de voz'}>{voice.active && voice.muted ? <MicOff size={15} /> : <Mic size={15} />}{voice.active ? voice.muted ? 'Activar' : 'Silenciar' : 'Hablar'}</button>{voice.active && <button className="voice-hangup" onClick={() => void voice.stop()} title="Salir del chat de voz" aria-label="Salir del chat de voz"><PhoneOff size={15} /></button>}<audio ref={remoteAudioRef} autoPlay /></div>
        <div className="chat-messages">{messages.length ? messages.map((item) => <ChatBubble message={item} mine={item.uid === uid} key={item.id} />) : <div className="chat-empty"><div className="chat-empty-icon"><MessageCircle size={19} /></div><strong>La sala está en silencio</strong><small>Di hola o manda una reacción.</small></div>}<div ref={messageEndRef} /></div>
        <div className="reaction-row">{reactions.map((emoji) => <button key={emoji} onClick={() => void sendText('reaction', emoji)} aria-label={`Enviar reacción ${emoji}`}>{emoji}</button>)}</div>
        <form className="chat-compose" onSubmit={(event) => void send(event)}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe algo..." maxLength={500} disabled={ended} /><button aria-label="Enviar mensaje" disabled={!message.trim() || ended}><Send size={16} /></button></form>
      </aside>
    </div>
    <div className="room-bottom-actions"><label className="invite-friend"><Users size={15} /><span>Invitar a un amigo</span><select onChange={(event) => void invite(event)} disabled={busy || room.memberUids.length + room.invitedUids.length >= 2} defaultValue=""><option value="">Elegir amigo…</option>{inviteOptions.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName}</option>)}</select></label><button className="leave-room-bottom" onClick={() => void exitRoom()} disabled={busy}>Terminar mi sesión</button></div>
    <button className="chat-mobile-toggle" onClick={() => setChatOpen(!chatOpen)}><MessageCircle size={17} /> {chatOpen ? 'Ocultar chat' : `Abrir chat · ${messages.length}`}</button>
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
