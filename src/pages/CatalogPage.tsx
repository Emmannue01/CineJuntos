import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Film, Plus, LoaderCircle, Bookmark } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { parseMediaLink } from '../lib/media'
import { addVideo, subscribeWatchlists } from '../services/appService'
import { catalog } from '../data/catalog'
import type { Watchlist } from '../types'

export default function CatalogPage() {
  const { user } = useAuth()
  const [lists, setLists] = useState<Watchlist[]>([])

  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [detailItem, setDetailItem] = useState<typeof catalog[number] | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [addTargetUrl, setAddTargetUrl] = useState<string | null>(null)

  const filteredCatalog = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return catalog
    return catalog.filter((item) =>
      item.title.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term)
    )
  }, [searchTerm])

  useEffect(() => {
    if (!user) return
    return subscribeWatchlists(user.uid, (next) => {
      setLists(next)
    })
  }, [user])

  async function addToSelected(itemUrl: string, listId: string) {
    if (!user) return
    if (!listId) { setError('Elige una lista de destino.'); return }
    setBusyId(itemUrl); setError(''); setNotice('')
    try {
      const media = await parseMediaLink(itemUrl)
      if (!media) throw new Error('El enlace del catálogo no es válido.')
      await addVideo(listId, { ...media, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: 0 })
      setNotice('Añadido a la lista.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusyId('') }
  }

  return (
    <div className="page-enter">
      <div className="page-title-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> CATÁLOGO</div>
          <h1>Catálogo<span className="heading-period">.</span></h1>
          <p>Elige algo del catálogo y añádelo a tu lista para verlo juntos.</p>
        </div>
        <div className="title-illustration list-art"><Film size={27} /><span>CATALOGO</span></div>
      </div>
      {error && <div className="inline-alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}
      {notice && <div className="inline-success" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}

      <section className="add-video-panel" style={{ marginBottom: 18 }}>
        <div className="add-video-copy"><span className="section-kicker">BUSCAR</span></div>
        <div className="search-field" style={{ width: '100%' }}>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar en el catálogo..." />
        </div>
      </section>

      <div className="catalog-grid">
        {filteredCatalog.map((item) => (
          <article
            key={item.id}
            style={{
              display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
              background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
            }}
          >
            <div className="video-thumb" style={{ width: '100%', aspectRatio: '4 / 3', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={() => setDetailItem(item)}>
              {item.thumbnail ? <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'var(--panel-raised)' }} /> : <span className="video-thumb-placeholder"><Film size={19} /></span>}
            </div>
            <div className="video-info" style={{ gap: 4 }}>
              <strong style={{ fontSize: 12, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</strong>
              {item.description && <small style={{ fontSize: 9.5, lineHeight: 1.3, color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</small>}
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={busyId === item.url}
              onClick={() => {
                if (!lists.length) { setError('Crea o selecciona una lista primero.'); return }
                setAddTargetUrl(item.url)
              }}
              style={{ minHeight: 32, fontSize: 10, width: '100%', justifyContent: 'center' }}
            >
              {busyId === item.url ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />} Añadir
            </button>
          </article>
        ))}
      </div>
      {filteredCatalog.length === 0 && (
        <div className="empty-inline"><span className="empty-icon"><Film size={17} /></span><div><strong>Sin elementos</strong><small>Agrega elementos al catálogo en src/data/catalog.ts.</small></div></div>
      )}
      {detailItem && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailItem(null) }}>
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <button type="button" className="modal-close" onClick={() => setDetailItem(null)}>×</button>
            <div className="modal-header">
              <span className="modal-kicker"><Film size={13} /> CATÁLOGO</span>
              <h2>{detailItem.title}</h2>
            </div>
            <div className="modal-body" style={{ gap: 12 }}>
              {detailItem.thumbnail && (
                <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', background: 'var(--panel-raised)' }}>
                  <img src={detailItem.thumbnail} alt={detailItem.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{detailItem.description}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="text-link" onClick={() => setDetailItem(null)}>Cerrar</button>
              <button className="primary-button" type="button" disabled={busyId === detailItem.url} onClick={() => { setAddTargetUrl(detailItem.url); setDetailItem(null) }}>
                {busyId === detailItem.url ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Añadir a la lista
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {addTargetUrl && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddTargetUrl(null) }}>
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <button type="button" className="modal-close" onClick={() => setAddTargetUrl(null)}>×</button>
            <div className="modal-header">
              <span className="modal-kicker"><Bookmark size={13} /> LISTA DESTINO</span>
              <h2>Elige una lista</h2>
            </div>
            <div className="modal-body" style={{ gap: 8 }}>
              {lists.length === 0 ? (
                <div className="empty-inline"><span className="empty-icon"><Bookmark size={17} /></span><div><strong>Sin listas</strong><small>Crea una lista primero.</small></div></div>
              ) : (
                lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="exit-option"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                    disabled={busyId === addTargetUrl}
                    onClick={() => { void addToSelected(addTargetUrl, list.id); setAddTargetUrl(null) }}
                  >
                    <span>{list.name}</span>
                    <small>{list.shared ? 'Compartida' : 'Personal'}{list.isPublic ? ' · Pública' : ''}</small>
                  </button>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="text-link" onClick={() => setAddTargetUrl(null)}>Cancelar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
