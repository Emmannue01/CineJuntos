import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Globe, List, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { Avatar } from '../components/AppShell'
import { subscribePublicWatchlists } from '../services/appService'
import type { UserProfile, Watchlist } from '../types'

export default function PublicProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { userId = '' } = useParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [publicLists, setPublicLists] = useState<Watchlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) {
      setError('Usuario no encontrado.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')

    let cancelled = false

    // Cargar perfil desde Firestore
    const loadProfile = async () => {
      try {
        const { db } = await import('../firebase/firestore')
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'users', userId))
        if (!cancelled) {
          if (!snap.exists()) {
            setError('Usuario no encontrado.')
            setLoading(false)
            return
          }
          setProfile(snap.data() as UserProfile)
          setLoading(false)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(readableError(cause))
          setLoading(false)
        }
      }
    }

    // Cargar listas públicas
    const stopLists = subscribePublicWatchlists(userId, (lists) => {
      if (!cancelled) {
        setPublicLists(lists)
      }
    })

    loadProfile()

    return () => {
      cancelled = true
      stopLists()
    }
  }, [userId])

  async function goBack() {
    navigate('/')
  }

  if (loading) {
    return (
      <div className="page-enter">
        <div className="auth-loading">
          <span className="spinner" />
          <span>Cargando perfil…</span>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="page-enter">
        <div className="auth-loading">
          <span>{error}</span>
          <button className="small-outline-button" onClick={goBack}>Volver</button>
        </div>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="page-enter">
        <div className="auth-loading">
          <span>Sin perfil disponible.</span>
          <button className="small-outline-button" onClick={goBack}>Volver</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter public-profile-page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> PERFIL PÚBLICO</div>
          <h1>{profile.displayName || profile.username}<span className="heading-period">.</span></h1>
          <p>Lista pública de {profile.displayName || profile.username}</p>
        </div>
        <div className="title-illustration profile-art"><Users size={27} /><span>PÚBLICO</span></div>
      </div>
      {error && (
        <div className="inline-alert" role="alert">
          {error}
          <button onClick={() => setError('')}>Cerrar</button>
        </div>
      )}
      <div className="profile-layout">
        <section className="profile-preview">
          <div className="profile-preview-top">
            <span className="section-kicker">PERFIL</span>
            <span>01 / PÚBLICO</span>
          </div>
          <div className="profile-preview-body">
            <div className="profile-avatar-frame">
              <Avatar name={profile.displayName || 'C'} url={profile.avatar} size="large" />
            </div>
            <h2>{profile.displayName || 'Sin nombre'}</h2>
            <span className="profile-username">@{profile.username || 'usuario'}</span>
            <p>{profile.bio || 'Esta persona aún no ha escrito nada sobre sí misma.'}</p>
            <div className="profile-preview-footer">
              {user && profile.uid === user.uid ? (
                <span>Tu perfil público</span>
              ) : (
                <span>Perfil público de {profile.displayName || profile.username}</span>
              )}
            </div>
          </div>
        </section>
        <section className="public-lists-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">LISTAS PÚBLICAS</span>
              <h2>
                {publicLists.length} lista{publicLists.length === 1 ? '' : 's'} <List size={14} />
              </h2>
            </div>
          </div>
          {publicLists.length === 0 ? (
            <div className="empty-inline">
              <span className="empty-icon"><Globe size={20} /></span>
              <div>
                <strong>Sin listas públicas</strong>
                <small>
                  {user && profile.uid === user.uid
                    ? 'Crea una lista y hazla pública para que otros la vean.'
                    : 'Esta persona no tiene listas públicas aún.'}
                </small>
              </div>
            </div>
          ) : (
            <div className="video-list">
              {publicLists.map((list) => (
                <article
                  key={list.id}
                  className="video-item"
                  style={{ padding: '10px 3px', borderBottom: '1px solid var(--line)' }}
                >
                  <div className="video-thumb" style={{ width: '80px', height: '48px', flexShrink: 0 }}>
                    <div className="video-thumb-placeholder"><Globe size={20} /></div>
                  </div>
                  <div className="video-info" style={{ flex: 1, minWidth: 0 }}>
                    <strong className="video-title-clamp" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                      {list.name}
                    </strong>
                    <small style={{ fontSize: '9px' }}>
                      {list.shared ? 'Lista compartida' : 'Lista personal'} · Pública
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <button className="primary-button" onClick={goBack} style={{ marginTop: '20px' }}>
          Volver al inicio <ArrowLeft size={16} />
        </button>
      </div>
    </div>
  )
}
