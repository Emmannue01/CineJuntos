import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Bookmark, Check, Clapperboard, Clock3, ExternalLink, Film, Link2, LoaderCircle, Play, Plus, Search, Share2, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { searchYouTubeVideos, type YouTubeSearchResult } from '../lib/youtube'
import { parseMediaLink } from '../lib/media'
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
  const [newListMode, setNewListMode] = useState<'personal' | 'shared'>('personal')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

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
    setLoadingVideo(true); setError(''); setNotice('')
    try {
      const media = await parseMediaLink(link)
      if (!media) throw new Error('Pega un enlace multimedia válido con HTTPS.')
      await addVideo(selectedId, { ...media, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: videos.length })
      setLink(''); setNotice('Video añadido a la lista.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setLoadingVideo(false) }
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    if (!searchTerm.trim()) return
    if (!youtubeApiKey) {
      setSearchError('Para mostrar resultados aquí, configura VITE_YOUTUBE_API_KEY con una clave de YouTube Data API v3.')
      setSearched(true)
      return
    }
    setSearching(true); setSearchError(''); setSearched(true)
    try { setSearchResults(await searchYouTubeVideos(searchTerm.trim(), youtubeApiKey)) }
    catch (cause) { setSearchError(readableError(cause)); setSearchResults([]) }
    finally { setSearching(false) }
  }

  async function addSearchResult(result: YouTubeSearchResult) {
    if (!user || !selectedId) { setError('Crea o selecciona una lista primero.'); return }
    setBusy(result.videoId); setError('')
    try {
      await addVideo(selectedId, { videoId: result.videoId, mediaUrl: `https://www.youtube.com/watch?v=${result.videoId}`, provider: 'youtube', title: result.title, thumbnail: result.thumbnail, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: videos.length })
      setNotice('Video añadido a la lista.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function newList(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    if (newListMode === 'shared' && !newListFriend) { setError('Elige a un amigo para crear una lista conjunta.'); return }
    setBusy('list'); setError('')
    try {
      const id = await createWatchlist(user.uid, newListName, newListMode === 'shared' ? newListFriend : undefined)
      setSelectedId(id); setShowNewList(false); setNewListName(''); setNewListFriend('')
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function launch(video: VideoItem) {
    if (!user) return
    setBusy(video.id); setError('')
    try {
      const queue = pending.slice(pending.findIndex((item) => item.id === video.id) + 1).map((item) => ({ videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, itemId: item.id, listId: selectedId }))
      const roomId = await createRoom({ videoId: video.videoId, mediaUrl: video.mediaUrl, provider: video.provider, title: video.title, thumbnail: video.thumbnail }, shareWith || undefined, queue, selectedId, video.id)
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
    <section className="youtube-search-panel"><div className="section-kicker">EXPLORAR YOUTUBE</div><form className="youtube-search-form" onSubmit={(event) => void search(event)}><Search size={17} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Busca películas, canales o videos" /><button aria-label="Buscar en YouTube" disabled={searching}>{searching ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}</button></form>{searched && searchError && <div className="youtube-search-notice">{searchError}{!youtubeApiKey && <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`} target="_blank" rel="noreferrer">Buscar en YouTube <ExternalLink size={13} /></a>}</div>}{searchResults.length > 0 && <div className="youtube-results">{searchResults.map((result) => <article className="youtube-result" key={result.videoId}><img src={result.thumbnail} alt="" /><strong>{result.title}</strong><button className="icon-button" title="Añadir a la lista" disabled={!selectedId || busy === result.videoId} onClick={() => void addSearchResult(result)}>{busy === result.videoId ? <LoaderCircle size={16} className="spin" /> : <Plus size={17} />}</button></article>)}</div>}{searched && !searchError && searchResults.length === 0 && !searching && <small className="youtube-search-empty">No encontramos videos para esa búsqueda.</small>}</section>
    <section className="add-video-panel"><div className="add-video-copy"><span className="section-kicker">AÑADE UN ENLACE</span><strong>Comparte contenido multimedia</strong><small>YouTube, archivos de video/audio o páginas con reproductor.</small></div><form onSubmit={add} className="add-video-form"><div className="url-input"><Link2 size={17} /><input type="url" required value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." /><button disabled={loadingVideo || !selectedId} aria-label="Añadir a la lista">{loadingVideo ? <LoaderCircle className="spin" size={17} /> : <Plus size={19} />}</button></div><div className="add-video-options"><label><Users size={14} /><span>Guardar en</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lists.length}><option value="" disabled>Selecciona una lista</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}{list.shared ? ' · conjunta' : ''}</option>)}</select></label><button type="button" className="text-link" onClick={() => setShowNewList(true)}><Plus size={14} /> Crear lista</button></div></form></section>
    {showNewList && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewList(false) }}><form className="modal-card" onSubmit={newList}><button type="button" className="modal-close" onClick={() => setShowNewList(false)}>×</button><span className="section-kicker">UNA LISTA NUEVA</span><h2>¿Qué guardamos?</h2><label>Nombre<input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Nuestras pelis" maxLength={40} /></label><div className="list-mode-picker"><button type="button" className={newListMode === 'personal' ? 'selected' : ''} onClick={() => setNewListMode('personal')}><Bookmark size={15} /> Personal</button><button type="button" className={newListMode === 'shared' ? 'selected' : ''} onClick={() => setNewListMode('shared')}><Users size={15} /> Conjunta</button></div>{newListMode === 'shared' && <label>Compartir con<select value={newListFriend} onChange={(event) => setNewListFriend(event.target.value)} required><option value="">Elige un amigo</option>{friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName} · @{friend.username}</option>)}</select></label>}<button className="primary-button" disabled={busy === 'list' || (newListMode === 'shared' && friends.length === 0)}>Crear lista <ArrowUp size={15} /></button>{newListMode === 'shared' && friends.length === 0 && <small>Agrega un amigo antes de crear una lista conjunta.</small>}</form></div>}
    {lists.length === 0 ? <div className="first-list"><div className="first-list-icon"><Clapperboard size={25} /></div><h2>Todavía no hay lista.</h2><p>Crea una lista personal o compártela con alguien para empezar.</p><button className="primary-button" onClick={() => setShowNewList(true)}><Plus size={17} /> Crear mi primera lista</button></div> : <div className="watchlist-content"><div className="list-meta-row"><div><span className="section-kicker">{selected?.shared ? 'A DOS VOCES' : 'TU COLECCIÓN'}</span><h2>{selected?.name || 'Mi lista'} <span className="count-badge">{pending.length}</span></h2></div><div className="list-stats"><span><Clock3 size={14} /> {pending.length} por ver</span><span><Check size={14} /> {watched.length} vistos</span></div></div>
      {pending.length ? <div className="video-list">{pending.map((video, index) => <article className="video-item" key={video.id}><span className="video-index">{String(index + 1).padStart(2, '0')}</span><div className="video-thumb">{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="video-thumb-placeholder"><Film size={19} /></span>}{(video.provider || 'youtube') === 'youtube' && <span className="thumb-play"><Play size={15} fill="currentColor" /></span>}</div><div className="video-info"><strong>{video.title}</strong><small>{selected?.shared ? <><Users size={12} /> Lista conjunta</> : 'Añadido a la lista'} · {mediaLabel(video.provider)}</small></div><div className="video-actions"><button className="icon-button watch-button" title="Ver juntos" disabled={busy === video.id} onClick={() => void launch(video)}>{busy === video.id ? <LoaderCircle size={16} className="spin" /> : <Play size={16} fill="currentColor" />}</button><div className="reorder-actions"><button className="bare-icon" title="Subir" disabled={index === 0 || busy === 'reorder'} onClick={() => void move(index, -1)}><ArrowUp size={14} /></button><button className="bare-icon" title="Bajar" disabled={index === pending.length - 1 || busy === 'reorder'} onClick={() => void move(index, 1)}><ArrowDown size={14} /></button></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar como visto" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'watched' })}><Check size={15} /></button></div></article>)}</div> : <div className="empty-inline list-empty"><span className="empty-icon"><Film size={17} /></span><div><strong>No hay videos pendientes</strong><small>Añade un enlace multimedia para tu siguiente función.</small></div></div>}
      {watched.length > 0 && <details className="watched-details"><summary><Check size={15} /> Ya vimos ({watched.length})</summary><div className="video-list watched-list">{watched.map((video) => <article className="video-item" key={video.id}><span className="video-index">✓</span><div className="video-thumb">{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="video-thumb-placeholder"><Film size={19} /></span>}</div><div className="video-info"><strong>{video.title}</strong><small>Vista juntos · {mediaLabel(video.provider)}</small></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar pendiente" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'pending' })}><Clock3 size={15} /></button></article>)}</div></details>}
    </div>}
    {friends.length > 0 && <div className="invite-choice"><Share2 size={15} /><span>Invitar a una función:</span><select value={shareWith} onChange={(event) => setShareWith(event.target.value)}><option value="">Nadie por ahora</option>{friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName}</option>)}</select><small>La invitación se envía al crear la sala.</small></div>}
  </div>
}

function mediaLabel(provider: VideoItem['provider']) {
  if (!provider || provider === 'youtube') return 'YouTube'
  return provider === 'direct' ? 'Video/audio directo' : 'Reproductor externo'
}
