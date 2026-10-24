import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Bookmark, Check, ChevronDown, Clapperboard, Clock3, Film, Globe, Link2, LoaderCircle, Lock, Pencil, Play, Plus, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { parseMediaLink } from '../lib/media'
import { addVideo, createRoom, createWatchlist, deleteVideo, deleteWatchlist, reorderVideos, shareWatchlistWith, subscribeFriends, subscribeVideos, subscribeWatchlists, toggleWatchlistPublic, updateVideo, updateWatchlistName } from '../services/appService'
import type { UserProfile, VideoItem, Watchlist } from '../types'

export default function WatchlistPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState<Watchlist[]>([])
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [link, setLink] = useState('')
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [listModal, setListModal] = useState<'create' | 'edit' | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newListFriend, setNewListFriend] = useState('')
  const [newListMode, setNewListMode] = useState<'personal' | 'shared'>('personal')
  const [newListPublic, setNewListPublic] = useState(false)

  useEffect(() => {
    if (!user) return
    const stopLists = subscribeWatchlists(user.uid, (next) => {
      setLists(next)
      setSelectedId((current) => current && next.some((list) => list.id === current) ? current : next[0]?.id || '')
      setExpandedId((current) => current && next.some((list) => list.id === current) ? current : next[0]?.id || '')
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

  function openCreate() {
    setNewListName(''); setNewListFriend(''); setNewListMode('personal'); setNewListPublic(false); setError(''); setListModal('create')
  }

  function openEdit() {
    if (!selected) return
    setNewListName(selected.name); setNewListFriend(''); setNewListMode(selected.shared ? 'shared' : 'personal'); setNewListPublic(!!selected.isPublic); setError(''); setListModal('edit')
  }

  async function saveList(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    if (!newListName.trim()) { setError('Escribe un nombre para la lista.'); return }
    if (listModal === 'create' && newListMode === 'shared' && !newListFriend) { setError('Elige a un amigo para crear una lista conjunta.'); return }
    setBusy('list'); setError('')
    try {
      if (listModal === 'create') {
        const id = await createWatchlist(user.uid, newListName, newListMode === 'shared' ? newListFriend : undefined)
        if (newListPublic) await toggleWatchlistPublic(id, true)
        setSelectedId(id)
      } else if (selected) {
        if (newListName.trim() !== selected.name) await updateWatchlistName(selectedId, newListName)
        if (newListPublic !== !!selected.isPublic) await toggleWatchlistPublic(selectedId, newListPublic)
        if (newListFriend) await shareWatchlistWith(selectedId, newListFriend)
        setNotice('Lista actualizada.')
      }
      setListModal(null)
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function launch(video: VideoItem) {
    if (!user) return
    setBusy(video.id); setError('')
    try {
      const queue = pending.slice(pending.findIndex((item) => item.id === video.id) + 1).map((item) => ({ videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, itemId: item.id, listId: selectedId }))
      const roomId = await createRoom({ videoId: video.videoId, mediaUrl: video.mediaUrl, provider: video.provider, title: video.title, thumbnail: video.thumbnail }, undefined, queue, selectedId, video.id)
      navigate(`/sala/${roomId}`)
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function deleteList() {
    if (!selectedId || !window.confirm('¿Eliminar esta lista y todos sus videos?')) return
    setBusy('delete-list')
    try {
      await deleteWatchlist(selectedId)
      setSelectedId('')
      setListModal(null)
      setNotice('Lista eliminada.')
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

    <section className="add-video-panel">
      <div className="add-video-copy"><span className="section-kicker">AÑADE UN ENLACE</span><strong>Comparte contenido multimedia</strong><small>Archivos de video/audio o páginas con reproductor.</small></div>
      <form onSubmit={add} className="add-video-form">
        <div className="url-input">
          <Link2 size={17} />
          <input type="url" required value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
          {link && <button type="button" className="url-clear" onClick={() => setLink('')} aria-label="Limpiar enlace"><X size={15} /></button>}
          <button disabled={loadingVideo || !selectedId} aria-label="Añadir a la lista">{loadingVideo ? <LoaderCircle className="spin" size={17} /> : <Plus size={19} />}</button>
        </div>
        <div className="add-video-options">
          <label><Users size={14} /><span>Guardar en</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lists.length}>
              <option value="" disabled>Selecciona una lista</option>
              {lists.map((list) => <option value={list.id} key={list.id}>{list.name}{list.shared ? ' · conjunta' : ''}</option>)}
            </select></label>
          <button type="button" className="text-link" onClick={openCreate}><Plus size={14} /> Crear lista</button>
        </div>
      </form></section>

    {lists.length === 0 ? <div className="first-list"><div className="first-list-icon"><Clapperboard size={25} /></div><h2>Todavía no hay lista.</h2><p>Crea una lista personal o compártela con alguien para empezar.</p><button className="primary-button" onClick={openCreate}><Plus size={17} /> Crear mi primera lista</button></div> : <div className="watchlist-content">
      {lists.map((list) => {
        const isExpanded = expandedId === list.id
        return (
          <section key={list.id} style={{ border: '1px solid var(--line)', borderRadius: 12, marginBottom: 12, overflow: 'hidden', background: 'var(--panel)' }}>
            <button
              type="button"
              onClick={() => {
                if (isExpanded) setExpandedId('')
                else { setExpandedId(list.id); setSelectedId(list.id) }
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
                <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .18s', color: 'var(--accent)' }} />
                {list.name}
                {list.shared && <Users size={12} />}
                {list.isPublic && <Globe size={12} />}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{list.shared ? 'Compartida' : 'Personal'}{list.isPublic ? ' · Pública' : ''}</span>
            </button>
            {isExpanded && selectedId === list.id && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--line)' }}>
                <div className="list-meta-row">
                  <div><span className="section-kicker">{selected?.shared ? 'A DOS VOCES' : 'TU COLECCIÓN'}</span><h2><>{selected?.name || 'Mi lista'} <span className="count-badge">{pending.length}</span></><span className="public-toggle">{selected?.isPublic ? <><Globe size={14} /> Pública</> : <><Lock size={14} /> Privada</>}</span>
                    <button className="text-link" onClick={openEdit}><Pencil size={14} /> Editar lista</button></h2>

                </div>
                <div className="list-stats"><span><Clock3 size={14} /> {pending.length} por ver</span><span><Check size={14} /> {watched.length} vistos</span></div></div>
                {pending.length ? (
                  <div className="video-list">{pending.map((video, index) => (
                    <article className="video-item" key={video.id}><span className="video-index">{String(index + 1).padStart(2, '0')}</span><div className="video-thumb">{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="video-thumb-placeholder"><Film size={19} /></span>}<span className="thumb-play"><Play size={15} fill="currentColor" /></span></div><div className="video-info"><strong>{video.title}</strong><small>{selected?.shared ? <><Users size={12} /> Lista conjunta</> : 'Añadido a la lista'} · {mediaLabel(video.provider)}</small></div><div className="video-actions"><button className="icon-button watch-button" title="Ver juntos" disabled={busy === video.id} onClick={() => void launch(video)}>{busy === video.id ? <LoaderCircle size={16} className="spin" /> : <Play size={16} fill="currentColor" />}</button><div className="reorder-actions"><button className="bare-icon" title="Subir" disabled={index === 0 || busy === 'reorder'} onClick={() => void move(index, -1)}><ArrowUp size={14} /></button><button className="bare-icon" title="Bajar" disabled={index === pending.length - 1 || busy === 'reorder'} onClick={() => void move(index, 1)}><ArrowDown size={14} /></button></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar como visto" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'watched' })}><Check size={15} /></button></div></article>))}</div>) : <div className="empty-inline list-empty"><span className="empty-icon"><Film size={17} /></span><div><strong>No hay videos pendientes</strong><small>Añade un enlace multimedia para tu siguiente función.</small></div></div>}
                {watched.length > 0 && <details className="watched-details"><summary><Check size={15} /> Ya vimos ({watched.length})</summary><div className="video-list watched-list">{watched.map((video) => <article className="video-item" key={video.id}><span className="video-index">✓</span><div className="video-thumb">{video.thumbnail ? <img src={video.thumbnail} alt="" /> : <span className="video-thumb-placeholder"><Film size={19} /></span>}</div><div className="video-info"><strong>{video.title}</strong><small>Vista juntos · {mediaLabel(video.provider)}</small></div><button className="bare-icon delete-video" title="Eliminar" onClick={() => selectedId && void deleteVideo(selectedId, video.id)}><Trash2 size={15} /></button><button className="bare-icon" title="Marcar pendiente" onClick={() => selectedId && void updateVideo(selectedId, video.id, { status: 'pending' })}><Clock3 size={15} /></button></article>)}</div></details>}
              </div>
            )}
          </section>
        )
      })}
    </div>}
     {listModal && (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setListModal(null) }}>
        <form className="modal-card list-modal" onSubmit={saveList}>
          <button type="button" className="modal-close" onClick={() => setListModal(null)}>×</button>
          <div className="modal-header">
            <span className="modal-kicker"><Bookmark size={13} /> {listModal === 'create' ? 'NUEVA LISTA' : 'EDITAR LISTA'}</span>
            <h2>{listModal === 'create' ? 'Crear lista' : 'Datos de la lista'}</h2>
          </div>
          <div className="modal-body">
            <label>Nombre
              <input value={newListName} onChange={(event) => setNewListName(event.target.value)} placeholder="Ej. Maratón del viernes" required autoFocus />
            </label>
            <div className="list-type-row">
              <label>Tipo
                <select className="list-type-select" value={newListMode} onChange={(event) => setNewListMode(event.target.value as 'personal' | 'shared')}>
                  <option value="personal">Personal</option>
                  <option value="shared">Conjunta</option>
                </select>
              </label>
            </div>
            {newListMode === 'shared' && (
              <div className="shared-friend-row">
                <label>Amigo
                  <select className="list-type-select" value={newListFriend} onChange={(event) => setNewListFriend(event.target.value)} required>
                    <option value="">Elige a un amigo</option>
                    {friends.map((friend) => <option key={friend.uid} value={friend.uid}>{friend.displayName}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="public-toggle-row" onClick={() => setNewListPublic(!newListPublic)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setNewListPublic(!newListPublic) }}>
              <div>
                <span className="public-toggle-label">{newListPublic ? 'Lista pública' : 'Lista privada'}</span>
              </div>
              <div className="public-toggle-switch">
                <input type="checkbox" checked={newListPublic} onChange={() => setNewListPublic(!newListPublic)} readOnly />
                <div className="public-toggle-slider" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="modal-actions list-modal-actions">
            {listModal === 'edit' && <button type="button" className="text-link delete-list" disabled={busy === 'delete-list'} onClick={() => void deleteList()}><Trash2 size={14} /> Eliminar </button>}
            <button type="button" className="text-link" onClick={() => setListModal(null)}>Cancelar</button>
            <button className="primary-button" type="submit" disabled={busy === 'list'}>{busy === 'list' ? <LoaderCircle className="spin" size={16} /> : listModal === 'create' ? 'Crear lista' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    )}
  </div>
}

function mediaLabel(provider: VideoItem['provider']) {
  return provider === 'direct' ? 'Video/audio directo' : 'Reproductor externo'
}