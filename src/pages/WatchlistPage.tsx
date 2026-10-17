import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Bookmark, Check, Clapperboard, Clock3, Film, Link2, LoaderCircle, Play, Plus, Share2, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { extractYouTubeId, getYouTubeMetadata } from '../lib/youtube'
import { addVideo, createRoom, createWatchlist, deleteVideo, reorderVideos, subscribeFriends, subscribeVideos, subscribeWatchlists, updateVideo } from '../services/appService'
import type { UserProfile, VideoItem, Watchlist } from '../types'

export default function WatchlistPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState<Watchlist[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [link, setLink] = useState('')
  const [shareWith, setShareWith] = useState('')
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListFriend, setNewListFriend] = useState('')

  useEffect(() => {
    if (!user) return
    const stopLists = subscribeWatchlists(user.uid, (next) => {
      setLists(next)
      setSelectedId((current) => current && next.some((list) => list.id === current) ? current : next[0]?.id || '')
    })
    const stopFriends = subscribeFriends(user.uid, setFriends)
    return () => { stopLists(); stopFriends() }
  }, [user])
  useEffect(() => {
    if (!selectedId) { setVideos([]); return }
    return subscribeVideos(selectedId, setVideos)
  }, [selectedId])

  const selected = lists.find((list) => list.id === selectedId)
  const pending = useMemo(() => videos.filter((video) => video.status === 'pending'), [videos])
  const watched = useMemo(() => videos.filter((video) => video.status === 'watched'), [videos])

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedId) { setError('Crea o selecciona una lista primero.'); return }
    const videoId = extractYouTubeId(link)
    if (!videoId) { setError('Pega un enlace válido de YouTube.'); return }
    setLoadingVideo(true); setError(''); setNotice('')
    try {
      const metadata = await getYouTubeMetadata(videoId)
      await addVideo(selectedId, { videoId, ...metadata, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: videos.length })
      setLink(''); setNotice('Video añadido a la lista.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setLoadingVideo(false) }
  }

  async function newList(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    setBusy('list'); setError('')
    try {
      const id = await createWatchlist(user.uid, newListName, newListFriend || undefined)
      setSelectedId(id); setShowNewList(false); setNewListName(''); setNewListFriend('')
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function launch(video: VideoItem) {
    if (!user) return
    setBusy(video.id); setError('')
    try {
      const queue = pending.slice(pending.findIndex((item) => item.id === video.id) + 1).map((item) => ({ videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, itemId: item.id, listId: selectedId }))
      const roomId = await createRoom({ videoId: video.videoId, title: video.title, thumbnail: video.thumbnail }, shareWith || undefined, queue, selectedId, video.id)
      navigate(`/sala/${roomId}`)
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...pending]
    const target = index + direction
    if (target < 0 || target >= next.length || !selectedId) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setBusy('reorder')
    try { await reorderVideos(selectedId, [...next, ...watched]) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  return <div className="page-enter">
    <div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> SU PRÓXIMA HISTORIA</div><h1>Para ver juntos<span className="heading-period">.</span></h1><p>Guarden ese video que los dos tienen pendiente.</p></div><div className="title-illustration list-art"><Bookmark size={27} /><span>PLAYLIST</span></div></div>
    {error && <div className="inline-alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{notice && <div className="inline-success" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    <section className="add-video-panel"><div className="add-video-copy"><span className="section-kicker">AÑADE UN VIDEO</span><strong>¿Qué vemos después?</strong><small>Pega cualquier enlace de YouTube.</small></div><form onSubmit={add} className="add-video-form"><div className="url-input"><Link2 size={17} /><input type="url" required value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://youtube.com/watch?v=..." /><button disabled={loadingVideo || !selectedId} aria-label="Añadir a la lista">{loadingVideo ? <LoaderCircle className="spin" size={17} /> : <Plus size={19} />}</button></div><div className="add-video-options"><label><Users size={14} /><span>Lista compartida</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lists.length}><option value="" disabled>Selecciona una lista</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}{list.shared ? ' · compartida' : ''}</option>)}</select></label><button type="button" className="text-link" onClick={() => setShowNewList(true)}><Plus size={14} /> Crear lista</button></div></form></section>
    {showNewList && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewList(false) }}><form className="modal-card" onSubmit={newList}><button type="button" className="modal-close" onClick={() => setShowNewList(false)}>×</button><span className="section-kicker">UNA LISTA NUEVA</span><h2>¿Qué guardamos?</h2><label>Nombre<input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Nuestras pelis" maxLength={40} /></label><label>Compartir con<select value={newListFriend} onChange={(event) => setNewListFriend(event.target.value)}><option value="">Solo para mí</option>{friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName} · @{friend.username}</option>)}</select></label><button className="primary-button" disabled={busy === 'list'}>Crear lista <ArrowUp size={15} /></button></form></div>}
    {lists.length === 0 ? <div className="first-list"><div className="first-list-icon"><Clapperboard size={25} /></div><h2>Todavía no hay lista.</h2><p>Crea una lista personal o compártela con alguien para empezar.</p><button className="primary-button" onClick={() => setShowNewList(true)}><Plus size={17} /> Crear mi primera lista</button></div> : <div className="watchlist-content"><div className="list-meta-row"><div><span className="section-kicker">{selected?.shared ? 'A DOS VOCES' : 'TU COLECCIÓN'}</span><h2>{selected?.name || 'Mi lista'} <span className="count-badge">{pending.length}</span></h2></div><div className="list-stats"><span><Clock3 size={14} /> {pending.length} por ver</span><span><Check size={14} /> {watched.length} vistos</span></div></div>
      {pending.length ? <div className="video-list">{pending.map((video, index) => <article className="video-item" key={video.id}><span className="video-index">{String(index + 1).padStart(2, '0')}</span><div className="video-thumb"><img src={video.thumbnail} alt="" /><span className="thumb-play"><Play size={15} fill="currentColor" /></span></div><div className="video-info"><strong>{video.title}</strong><small>{selected?.shared ? <><Users size={12} /> Lista compartida</> : 'Añadido a la lista'} · YouTube</small></div><div className="video-actions"><button className="icon-button watch-button" title="Ver juntos" disabled={busy === video.id} onClick={() => void launch(video)}>{busy === video.id ? <LoaderCircle size={16} className="spin" /> : <Play size={16} fill="currentColor" />}</button><div className="reorder-actions"><button className="bare-icon" title="Subir" disabled={index === 0 || busy === 'reorder'} onClick={() => void move(index, -1)}><ArrowUp size={14} /></button><button className="bare-icon" title="Bajar" disabled={index === pending.length - 1 || busy === 'reorder'} onClick={() => void move(index, 1)}><ArrowDown size={14} /></button></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar como visto" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'watched' })}><Check size={15} /></button></div></article>)}</div> : <div className="empty-inline list-empty"><span className="empty-icon"><Film size={17} /></span><div><strong>No hay videos pendientes</strong><small>Añade un enlace de YouTube para tu siguiente función.</small></div></div>}
      {watched.length > 0 && <details className="watched-details"><summary><Check size={15} /> Ya vimos ({watched.length})</summary><div className="video-list watched-list">{watched.map((video) => <article className="video-item" key={video.id}><span className="video-index">✓</span><div className="video-thumb"><img src={video.thumbnail} alt="" /></div><div className="video-info"><strong>{video.title}</strong><small>Vista juntos</small></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar pendiente" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'pending' })}><Clock3 size={15} /></button></article>)}</div></details>}
    </div>}
    {friends.length > 0 && <div className="invite-choice"><Share2 size={15} /><span>Invitar a una función:</span><select value={shareWith} onChange={(event) => setShareWith(event.target.value)}><option value="">Nadie por ahora</option>{friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName}</option>)}</select><small>La invitación se envía al crear la sala.</small></div>}
  </div>
}
