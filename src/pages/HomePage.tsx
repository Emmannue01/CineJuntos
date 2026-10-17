import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bookmark, Check, Clock3, Film, Plus, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/AppShell'
import { respondRoomInvite, subscribeInvites, subscribeMyRooms, subscribeVideos, subscribeWatchlists } from '../services/appService'
import type { Room, RoomInvite, VideoItem, Watchlist } from '../types'
import { readableError } from '../lib/errors'

export default function HomePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [invites, setInvites] = useState<RoomInvite[]>([])
  const [lists, setLists] = useState<Watchlist[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [notice, setNotice] = useState('')
  const [busyInvite, setBusyInvite] = useState('')

  useEffect(() => {
    if (!user) return
    const stops = [
      subscribeMyRooms(user.uid, setRooms),
      subscribeInvites(user.uid, setInvites),
      subscribeWatchlists(user.uid, setLists),
    ]
    return () => stops.forEach((stop) => stop())
  }, [user])

  useEffect(() => {
    const list = lists[0]
    if (!list) { setVideos([]); return }
    return subscribeVideos(list.id, setVideos)
  }, [lists])

  async function reply(invite: RoomInvite, accept: boolean) {
    setBusyInvite(invite.id)
    setNotice('')
    try {
      await respondRoomInvite(invite.id, accept)
      if (accept) navigate(`/sala/${invite.roomId}`)
    } catch (error) { setNotice(readableError(error)) }
    finally { setBusyInvite('') }
  }

  const pendingVideos = videos.filter((video) => video.status === 'pending')
  return (
    <div className="home-page page-enter">
      <div className="home-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> TU SALA DE ESTAR DIGITAL</div><h1>Hola, {profile?.displayName?.split(' ')[0] || 'cinefilo'}<span className="heading-period">.</span></h1><p>¿Qué historia les apetece compartir hoy?</p></div><Link className="round-profile-link" to="/perfil"><Avatar name={profile?.displayName || 'C'} url={profile?.avatar} /></Link></div>
      <section className="feature-banner">
        <div className="feature-copy"><div className="feature-tag"><Sparkles size={13} /> UNA NOCHE PARA DOS</div><h2>La distancia no<br />pone pausa.</h2><p>Elijan algo de su lista y véanlo al mismo tiempo, estén donde estén.</p><Link to="/lista" className="feature-button">Elegir una película <ArrowUpRight size={16} /></Link></div>
        <div className="feature-art" aria-hidden="true"><div className="film-reel reel-one" /><div className="film-reel reel-two" /><div className="feature-frame"><Film size={58} strokeWidth={1.2} /><span>PLAY<br />TOGETHER</span></div><div className="feature-orbit orbit-one" /><div className="feature-orbit orbit-two" /><div className="feature-stamp">CJ<br /><small>EST. 2025</small></div></div>
        <div className="banner-index">01 <span>/</span> 03</div>
      </section>
      {notice && <div className="inline-alert" role="alert">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
      <div className="home-grid">
        <section className="section-block invites-block"><div className="section-heading"><div><span className="section-kicker">EN TU BUZÓN</span><h2>Invitaciones <span className="count-badge">{invites.length}</span></h2></div><span className="section-aside">NO TE LAS PIERDAS</span></div>
          {invites.length ? <div className="invite-list">{invites.slice(0, 3).map((invite, index) => <article className="invite-item" key={invite.id} style={{ animationDelay: `${index * 70}ms` }}><div className="invite-avatar"><Avatar name={invite.fromName} /><span><Users size={11} /></span></div><div className="invite-copy"><strong>{invite.fromName} te espera</strong><small>{invite.roomTitle}</small></div><button className="icon-button accept-invite" title="Aceptar invitación" disabled={busyInvite === invite.id} onClick={() => void reply(invite, true)}><Check size={17} /></button><button className="icon-button quiet-icon" title="Rechazar invitación" disabled={busyInvite === invite.id} onClick={() => void reply(invite, false)}>×</button></article>)}</div> : <div className="empty-inline"><span className="empty-icon"><Check size={17} /></span><div><strong>Todo al día</strong><small>Cuando te inviten a una sala, aparecerá aquí.</small></div></div>}
        </section>
        <section className="section-block rooms-block"><div className="section-heading"><div><span className="section-kicker">SIGUE LA HISTORIA</span><h2>Salas activas <span className="count-badge">{rooms.length}</span></h2></div><Link to="/lista" className="text-link">Nueva sala <Plus size={15} /></Link></div>
          {rooms.length ? <div className="room-list">{rooms.slice(0, 3).map((room) => <Link to={`/sala/${room.id}`} className="room-row" key={room.id}><img src={room.thumbnail} alt="" /><span className="room-row-copy"><strong>{room.title}</strong><small><span className="live-dot" /> Tu sala está lista</small></span><ArrowUpRight size={17} /></Link>)}</div> : <div className="empty-room"><div className="empty-room-graphic"><Film size={25} /><span className="empty-room-spark">✳</span></div><div><strong>La pantalla está esperando</strong><small>Empieza una sala desde un video de tu lista.</small></div><Link to="/lista" className="small-outline-button">Ver mi lista <ArrowUpRight size={14} /></Link></div>}
        </section>
        <section className="section-block watch-summary"><div className="section-heading"><div><span className="section-kicker">PARA LA PRÓXIMA</span><h2>En tu lista</h2></div><Link to="/lista" className="text-link">Ver todo <ArrowUpRight size={15} /></Link></div>
          {pendingVideos.length ? <div className="home-video-row">{pendingVideos.slice(0, 4).map((video) => <Link to="/lista" className="home-video" key={video.id}><div className="home-video-image"><img src={video.thumbnail} alt="" /><span><Clock3 size={12} /> POR VER</span></div><strong>{video.title}</strong></Link>)}</div> : <div className="empty-inline"><span className="empty-icon"><Bookmark size={16} /></span><div><strong>Su próxima favorita aún no está aquí</strong><small>Guarden videos de YouTube para verlos juntos.</small></div><Link to="/lista" className="text-link">Añadir <ArrowUpRight size={14} /></Link></div>}
        </section>
        <aside className="home-note"><div className="note-top"><span>NOTA DE LA CASA</span><span>✳</span></div><blockquote>“La película empieza cuando le das play. La noche, cuando están los dos.”</blockquote><div className="note-foot"><span /> CINEJUNTOS, PARA COMPARTIR</div></aside>
      </div>
    </div>
  )
}
