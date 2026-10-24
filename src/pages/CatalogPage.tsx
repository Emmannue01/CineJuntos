import { useEffect, useState } from 'react'
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
  const [selectedId, setSelectedId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [detailItem, setDetailItem] = useState<typeof catalog[number] | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeWatchlists(user.uid, (next) => {
      setLists(next)
      setSelectedId((current) => current && next.some((list) => list.id === current) ? current : next[0]?.id || '')
    })
  }, [user])

  async function addToSelected(itemUrl: string) {
    if (!user) return
    if (!selectedId) { setError('Crea o selecciona una lista primero.'); return }
    setBusyId(itemUrl); setError(''); setNotice('')
    try {
      const media = await parseMediaLink(itemUrl)
      if (!media) throw new Error('El enlace del catálogo no es válido.')
      await addVideo(selectedId, { ...media, addedBy: user.uid, addedAt: Date.now(), status: 'pending', position: 0 })
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
        <div className="add-video-copy"><span className="section-kicker">LISTA DESTINO</span><strong>Guardar en</strong><small>Selecciona la lista donde se añadirán los elementos.</small></div>
        <div className="add-video-options" style={{ width: '100%' }}>
          <label><Bookmark size={14} /><span>Lista</span>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!lists.length}>
              <option value="" disabled>Selecciona una lista</option>
              {lists.map((list) => <option value={list.id} key={list.id}>{list.name}{list.shared ? ' · conjunta' : ''}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="catalog-grid">
        {catalog.map((item) => (
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
              disabled={busyId === item.url || !selectedId}
              onClick={() => void addToSelected(item.url)}
              style={{ minHeight: 32, fontSize: 10, width: '100%', justifyContent: 'center' }}
            >
              {busyId === item.url ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />} Añadir
            </button>
          </article>
        ))}
      </div>
      {catalog.length === 0 && (
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
              <button className="primary-button" type="button" disabled={busyId === detailItem.url || !selectedId} onClick={() => { void addToSelected(detailItem.url); setDetailItem(null) }}>
                {busyId === detailItem.url ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Añadir a la lista
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
