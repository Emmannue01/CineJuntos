import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Bookmark, Check, Clapperboard, Clock3, Eye, Film, Globe, Link2, LoaderCircle, Lock, Play, Plus, Search, Share2, Trash2, TrendingUp, Tv2, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { extractYouTubeId, getYouTubeMetadata, getTrendingVideos, searchYouTubeVideos, type YouTubeVideo } from '../lib/youtube'
import { parseMediaLink } from '../lib/media'
import { addVideo, createRoom, createWatchlist, deleteVideo, reorderVideos, subscribeFriends, subscribeVideos, subscribeWatchlists, toggleWatchlistPublic, updateVideo } from '../services/appService'
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
  const [isListPublic, setIsListPublic] = useState(false)

  // YouTube feed state
  const [searchTerm, setSearchTerm] = useState('')
  const [ytVideos, setYtVideos] = useState<YouTubeVideo[]>([])
  const [ytLoading, setYtLoading] = useState(false)
  const [ytMode, setYtMode] = useState<'trending' | 'search'>('trending')
  const [ytError, setYtError] = useState('')
  const [activePreview, setActivePreview] = useState<YouTubeVideo | null>(null)
  const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

  // Link preview state
  const [previewYtId, setPreviewYtId] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewThumb, setPreviewThumb] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    const stopLists = subscribeWatchlists(user.uid, (next) => {
      setLists(next)
      setSelectedId((current) => current && next.some((list) => list.id === current) ? current : next[0]?.id || '')
      const selected = next.find((list) => list.id === selectedId)
      setIsListPublic(!!selected?.isPublic)
    })
    const stopFriends = subscribeFriends(user.uid, setFriends)
    return () => { stopLists(); stopFriends() }
  }, [user])

  useEffect(() => {
    if (!selectedId) { setVideos([]); return }
    return subscribeVideos(selectedId, setVideos)
  }, [selectedId])

  // Load trending on mount if API key available
  useEffect(() => {
    if (!youtubeApiKey) return
    setYtLoading(true); setYtError('')
    getTrendingVideos(youtubeApiKey).then(setYtVideos).catch((e) => setYtError(readableError(e))).finally(() => setYtLoading(false))
  }, [youtubeApiKey])

  const selected = lists.find((list) => list.id === selectedId)
  const pending = useMemo(() => videos.filter((video) => video.status === 'pending'), [videos])
  const watched = useMemo(() => videos.filter((video) => video.status === 'watched'), [videos])

  // Debounced link preview
  function handleLinkChange(value: string) {
    setLink(value)
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    const trimmed = value.trim()
    if (!trimmed) { setPreviewYtId(''); setPreviewTitle(''); setPreviewThumb(''); return }
    previewDebounceRef.current = setTimeout(async () => {
      const ytId = extractYouTubeId(trimmed)
      if (ytId) {
        setPreviewYtId(ytId)
        setPreviewLoading(true)
        try {
          const meta = await getYouTubeMetadata(ytId)
          setPreviewTitle(meta.title)
          setPreviewThumb(meta.thumbnail)
        } catch { /* ignore */ }
        finally { setPreviewLoading(false) }
      } else {
        setPreviewYtId(''); setPreviewTitle(''); setPreviewThumb('')
      }
    }, 500)
  }

  function clearPreview() {
    setPreviewYtId(''); setPreviewTitle(''); setPreviewThumb(''); setLink('')
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    if (!user || !selectedId) { setError('Crea o selecciona una lista primero.'); return }
    setLoadingVideo(true); setError(''); setNotice('')
    try {
      const media = await parseMediaLink(link)
      if (!media) throw new Error('Pega un enlace multimedia válido con HTTPS.')
      await addVideo(selectedId, { ...media, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: videos.length })
      setLink(''); clearPreview(); setNotice('Video añadido a la lista.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setLoadingVideo(false) }
  }

  async function searchYT(event: FormEvent) {
    event.preventDefault()
    if (!searchTerm.trim()) return
    if (!youtubeApiKey) { setYtError('Configura VITE_YOUTUBE_API_KEY para usar la búsqueda de YouTube.'); return }
    setYtLoading(true); setYtError(''); setYtMode('search')
    try { setYtVideos(await searchYouTubeVideos(searchTerm.trim(), youtubeApiKey)) }
    catch (cause) { setYtError(readableError(cause)); setYtVideos([]) }
    finally { setYtLoading(false) }
  }

  async function loadTrending() {
    if (!youtubeApiKey) return
    setSearchTerm(''); setYtMode('trending'); setYtLoading(true); setYtError('')
    try { setYtVideos(await getTrendingVideos(youtubeApiKey)) }
    catch (cause) { setYtError(readableError(cause)); setYtVideos([]) }
    finally { setYtLoading(false) }
  }

  async function addYTVideo(video: YouTubeVideo) {
    if (!user || !selectedId) { setError('Crea o selecciona una lista primero.'); return }
    setBusy(video.videoId); setError('')
    try {
      await addVideo(selectedId, { videoId: video.videoId, mediaUrl: `https://www.youtube.com/watch?v=${video.videoId}`, provider: 'youtube', title: video.title, thumbnail: video.thumbnail, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: videos.length })
      setNotice(`"${video.title.slice(0, 40)}…" añadido a la lista.`)
      setActivePreview(null)
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

  async function togglePublic() {
    if (!selectedId) return
    setBusy('public')
    try {
      await toggleWatchlistPublic(selectedId, !isListPublic)
      setIsListPublic(!isListPublic)
      setNotice(`Lista ${isListPublic ? 'privada' : 'pública'} — ahora ${isListPublic ? 'solo tú' : 'cualquiera'} puede verla.`)
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

    {/* ── YouTube Feed Section ── */}
    <section className="yt-feed-section">
      <div className="yt-feed-header">
        <div className="yt-feed-brand"><Tv2 size={20} /><span>YouTube</span></div>
        <form className="yt-feed-search" onSubmit={(e) => void searchYT(e)}>
          <Search size={15} />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar en YouTube…" />
          {searchTerm && <button type="button" className="yt-clear-btn" onClick={() => { setSearchTerm(''); void loadTrending() }}><X size={13} /></button>}
          <button type="submit" className="yt-search-btn" disabled={ytLoading} aria-label="Buscar">{ytLoading ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}</button>
        </form>
        {ytMode === 'search' && youtubeApiKey && (
          <button type="button" className="yt-trending-btn" onClick={() => void loadTrending()}>
            <TrendingUp size={14} /> Tendencias
          </button>
        )}
      </div>

      {!youtubeApiKey && (
        <div className="yt-no-key">
          <Tv2 size={28} />
          <div>
            <strong>Conecta YouTube</strong>
            <p>Agrega <code>VITE_YOUTUBE_API_KEY</code> en tu archivo <code>.env</code> con una clave de <strong>YouTube Data API v3</strong> para ver videos y tendencias aquí.</p>
            <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer" className="yt-api-link">Obtener clave gratuita →</a>
          </div>
        </div>
      )}

      {youtubeApiKey && ytError && (
        <div className="yt-feed-error"><span>{ytError}</span><button onClick={() => void loadTrending()}>Reintentar</button></div>
      )}

      {youtubeApiKey && ytLoading && !ytVideos.length && (
        <div className="yt-feed-loading"><LoaderCircle size={22} className="spin" /><span>{ytMode === 'trending' ? 'Cargando tendencias…' : 'Buscando…'}</span></div>
      )}

      {youtubeApiKey && !ytLoading && ytVideos.length === 0 && !ytError && (
        <div className="yt-feed-empty"><Search size={20} /><span>Sin resultados para "{searchTerm}"</span></div>
      )}

      {ytVideos.length > 0 && (
        <div className="yt-feed-label">
          {ytMode === 'trending' ? <><TrendingUp size={13} /> Tendencias</> : <><Search size={13} /> Resultados para "{searchTerm}"</>}
        </div>
      )}

      {ytVideos.length > 0 && (
        <div className="yt-video-grid">
          {ytVideos.map((video) => (
            <article key={video.videoId} className="yt-video-card" onClick={() => setActivePreview(video)}>
              <div className="yt-card-thumb">
                <img src={video.thumbnail} alt="" loading="lazy" />
                {video.duration && <span className="yt-duration">{video.duration}</span>}
                <div className="yt-card-hover-play"><Play size={22} fill="white" /></div>
              </div>
              <div className="yt-card-info">
                <p className="yt-card-title">{video.title}</p>
                <span className="yt-card-channel">{video.channelTitle}</span>
                <span className="yt-card-meta">{[video.viewCount, video.publishedAt].filter(Boolean).join(' · ')}</span>
              </div>
              <button
                className="yt-add-btn"
                title="Añadir a la lista"
                disabled={!selectedId || busy === video.videoId}
                onClick={(e) => { e.stopPropagation(); void addYTVideo(video) }}
              >
                {busy === video.videoId ? <LoaderCircle size={14} className="spin" /> : <Plus size={15} />}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>

    {/* ── Video Preview Modal ── */}
    {activePreview && (
      <div className="yt-preview-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setActivePreview(null) }}>
        <div className="yt-preview-modal">
          <div className="yt-preview-topbar">
            <div className="yt-preview-brand"><Tv2 size={16} /></div>
            <p className="yt-preview-title">{activePreview.title}</p>
            <button className="yt-preview-close" onClick={() => setActivePreview(null)} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <div className="yt-preview-embed">
            <iframe
              src={`https://www.youtube.com/embed/${activePreview.videoId}?rel=0&modestbranding=1&autoplay=1`}
              title={activePreview.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="yt-preview-foot">
            <div className="yt-preview-meta">
              <p>{activePreview.title}</p>
              <span className="yt-preview-channel">{activePreview.channelTitle}</span>
              <span className="yt-preview-stats">
                {activePreview.viewCount && <><Eye size={12} /> {activePreview.viewCount}</>}
              </span>
            </div>
            <button
              className="primary-button yt-preview-add"
              disabled={!selectedId || busy === activePreview.videoId}
              onClick={() => void addYTVideo(activePreview)}
            >
              {busy === activePreview.videoId ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
              {selectedId ? 'Añadir a mi lista' : 'Selecciona una lista primero'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Add by URL ── */}
    <section className="add-video-panel"><div className="add-video-copy"><span className="section-kicker">AÑADE UN ENLACE</span><strong>Comparte contenido multimedia</strong><small>YouTube, archivos de video/audio o páginas con reproductor.</small></div><form onSubmit={add} className="add-video-form"><div className="url-input"><Link2 size={17} /><input type="url" required value={link} onChange={(event) => handleLinkChange(event.target.value)} placeholder="https://..." />{link && <button type="button" className="url-clear" onClick={clearPreview} aria-label="Limpiar enlace"><X size={15} /></button>}<button disabled={loadingVideo || !selectedId} aria-label="Añadir a la lista">{loadingVideo ? <LoaderCircle className="spin" size={17} /> : <Plus size={19} />}</button></div><div className="add-video-options"><label><Users size={14} /><span>Guardar en</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lists.length}><option value="" disabled>Selecciona una lista</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}{list.shared ? ' · conjunta' : ''}</option>)}</select></label><button type="button" className="text-link" onClick={() => setShowNewList(true)}><Plus size={14} /> Crear lista</button></div></form></section>
    {previewYtId && (
      <div className="link-preview-panel">
        <div className="link-preview-header">
          <span className="section-kicker">VISTA PREVIA</span>
          {previewLoading ? <LoaderCircle size={14} className="spin" /> : previewTitle && <strong className="link-preview-title">{previewTitle}</strong>}
          <button type="button" className="link-preview-close" onClick={clearPreview} aria-label="Cerrar vista previa"><X size={14} /></button>
        </div>
        <div className="link-preview-embed">
          <iframe
            src={`https://www.youtube.com/embed/${previewYtId}?rel=0&modestbranding=1`}
            title={previewTitle || 'Vista previa de YouTube'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {previewThumb && (
          <div className="link-preview-meta">
            <img src={previewThumb} alt="" className="link-preview-thumb" />
            <div className="link-preview-info">
              <span className="link-preview-badge">YouTube</span>
              {previewTitle && <p>{previewTitle}</p>}
              <small>Haz clic en "+" para añadir este video a tu lista</small>
            </div>
          </div>
        )}
      </div>
    )}

    {showNewList && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewList(false) }}><form className="modal-card" onSubmit={newList}><button type="button" className="modal-close" onClick={() => setShowNewList(false)}>×</button><span className="section-kicker">UNA LISTA NUEVA</span><h2>¿Qué guardamos?</h2><label>Nombre<input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Nuestras pelis" maxLength={40} /></label><div className="list-mode-picker"><button type="button" className={newListMode === 'personal' ? 'selected' : ''} onClick={() => setNewListMode('personal')}><Bookmark size={15} /> Personal</button><button type="button" className={newListMode === 'shared' ? 'selected' : ''} onClick={() => setNewListMode('shared')}><Users size={15} /> Conjunta</button></div>{newListMode === 'shared' && <label>Compartir con<select value={newListFriend} onChange={(event) => setNewListFriend(event.target.value)} required><option value="">Elige un amigo</option>{friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName} · @{friend.username}</option>)}</select></label>}<button className="primary-button" disabled={busy === 'list' || (newListMode === 'shared' && friends.length === 0)}>Crear lista <ArrowUp size={15} /></button>{newListMode === 'shared' && friends.length === 0 && <small>Agrega un amigo antes de crear una lista conjunta.</small>}</form></div>}
    {lists.length === 0 ? <div className="first-list"><div className="first-list-icon"><Clapperboard size={25} /></div><h2>Todavía no hay lista.</h2><p>Crea una lista personal o compártela con alguien para empezar.</p><button className="primary-button" onClick={() => setShowNewList(true)}><Plus size={17} /> Crear mi primera lista</button></div> : <div className="watchlist-content"><div className="list-meta-row"><div><span className="section-kicker">{selected?.shared ? 'A DOS VOCES' : 'TU COLECCIÓN'}</span><h2><>{selected?.name || 'Mi lista'} <span className="count-badge">{pending.length}</span></></h2><button className="public-toggle" onClick={() => void togglePublic()} title={isListPublic ? 'Hacer lista privada' : 'Hacer lista pública'}>{isListPublic ? (<><Globe size={14} /> Público</>) : (<><Lock size={14} /> Privado</>)}</button></div><div className="list-stats"><span><Clock3 size={14} /> {pending.length} por ver</span><span><Check size={14} /> {watched.length} vistos</span></div></div>
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
