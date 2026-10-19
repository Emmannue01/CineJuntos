import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Search, Send, UserPlus, Users, X } from 'lucide-react'
import StatusAvatar from '../components/StatusAvatar'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { removeFriend, respondFriendRequest, searchUsers, sendFriendRequest, subscribeFriends, subscribeRequests, subscribeSentRequests, cancelFriendRequest, type FriendRequest } from '../services/appService'
import type { UserProfile } from '../types'

export default function FriendsPage() {
  const { user } = useAuth()
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<UserProfile[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    const stopFriends = subscribeFriends(user.uid, setFriends)
    const stopRequests = subscribeRequests(user.uid, setRequests)
    const stopSentRequests = subscribeSentRequests(user.uid, setSentRequests)
    return () => { stopFriends(); stopRequests(); stopSentRequests() }
  }, [user])

  // Búsqueda automática con debounce cuando escribes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) return
      setError('')
      if (term.trim().length >= 2) {
        try {
          searchUsers(term, user.uid).then(setResults).catch((cause) => setError(readableError(cause)))
        } catch (cause) { setError(readableError(cause)) }
      } else {
        setResults([])
      }
      setSearched(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [term, user])

  async function addFriend(target: UserProfile) {
    if (!user) return
    setBusy(target.uid); setError('')
    try { await sendFriendRequest(user.uid, target.uid); setNotice(`Solicitud enviada a @${target.username}`) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function answer(request: FriendRequest, accept: boolean) {
    setBusy(request.id); setError('')
    try { await respondFriendRequest(request, accept) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function cancelSent(requestId: string) {
    setBusy(requestId); setError('')
    try { await cancelFriendRequest(requestId) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  async function remove(profile: UserProfile) {
    if (!user || !window.confirm(`¿Eliminar a @${profile.username} de tus amigos?`)) return
    setBusy(profile.uid); setError('')
    try { await removeFriend(profile.uid) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy('') }
  }

  const friendIds = new Set(friends.map((friend) => friend.uid))
  return <div className="page-enter">
    <div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> MEJOR EN COMPAÑÍA</div><h1>Tu gente<span className="heading-period">.</span></h1><p>Encuentra a quien le debes una noche de cine.</p></div><div className="title-illustration friends-art"><Users size={29} /><span>02</span></div></div>
    {error && <div className="inline-alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{notice && <div className="inline-success" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    <section className="friends-search-section"><div className="section-heading"><div><span className="section-kicker">ENCUENTRA A TU PERSONA</span><h2>Buscar usuarios</h2></div><span className="section-aside">POR NOMBRE DE USUARIO</span></div><form className="search-form"><div className="search-field"><span>@</span><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Busca por usuario..." minLength={2} /><button aria-label="Buscar"><Search size={18} /></button></div><small>Los nombres de usuario son únicos, así siempre encuentras a la persona correcta.</small></form>
      {searched && <div className="search-results">{results.length ? results.map((result) => <div className="person-row" key={result.uid}><Link to={`/perfil/${result.uid}`} className="profile-wrapper"><StatusAvatar uid={result.uid} name={result.displayName} photoURL={result.avatar} /><span className="person-copy"><strong>{result.displayName}</strong><small>@{result.username}</small></span></Link>{friendIds.has(result.uid) ? <span className="friend-state"><Check size={14} /> Ya son amigos</span> : <button className="small-outline-button" disabled={busy === result.uid} onClick={(event) => { event.stopPropagation(); void addFriend(result) }}><UserPlus size={15} /> Añadir</button>}</div>) : <div className="search-empty">No encontramos a nadie con ese usuario. Revisa que esté escrito correctamente.</div>}</div>}
    </section>
    <div className="friends-columns"><section className="section-block"><div className="section-heading"><div><span className="section-kicker">TU CÍRCULO</span><h2>Amigos <span className="count-badge">{friends.length}</span></h2></div></div>{friends.length ? <div className="people-list">{friends.map((friend) => <div className="person-row" key={friend.uid}><Link to={`/perfil/${friend.uid}`} className="profile-wrapper"><StatusAvatar uid={friend.uid} name={friend.displayName} photoURL={friend.avatar} /><span className="person-copy"><strong>{friend.displayName}</strong><small>@{friend.username}</small></span></Link><button className="remove-friend" title={`Eliminar a ${friend.displayName}`} onClick={(event) => { event.stopPropagation(); void remove(friend) }} disabled={busy === friend.uid}><X size={16} /></button></div>)}</div> : <div className="empty-inline"><span className="empty-icon"><Users size={16} /></span><div><strong>La butaca de al lado está libre</strong><small>Busca a tus amigos para ver algo juntos.</small></div></div>}</section>
      <section className="section-block"><div className="section-heading"><div><span className="section-kicker">TE ESTÁN BUSCANDO</span><h2>Solicitudes <span className="count-badge">{requests.length}</span></h2></div></div>{requests.length ? <div className="people-list">{requests.map((request) => <div className="person-row request-row" key={request.id}><Link to={`/perfil/${request.fromUid}`} className="profile-wrapper"><StatusAvatar uid={request.fromUid} name={request.sender?.displayName || 'Cinéfilo'} photoURL={request.sender?.avatar} /><span className="person-copy"><strong>{request.sender?.displayName || 'Cinéfilo'}</strong><small>@{request.sender?.username || 'usuario'} quiere conectar</small></span></Link><div className="request-actions"><button className="icon-button accept-invite" aria-label="Aceptar solicitud" disabled={busy === request.id} onClick={(event) => { event.stopPropagation(); void answer(request, true) }}><Check size={17} /></button><button className="icon-button quiet-icon" aria-label="Rechazar solicitud" disabled={busy === request.id} onClick={(event) => { event.stopPropagation(); void answer(request, false) }}><X size={16} /></button></div></div>)}</div> : <div className="empty-inline"><span className="empty-icon"><Check size={16} /></span><div><strong>Sin solicitudes pendientes</strong><small>Cuando alguien te encuentre, aparecerá aquí.</small></div></div>}</section>
      <section className="section-block"><div className="section-heading"><div><span className="section-kicker">ESPERANDO RESPUESTA</span><h2>Solicitudes enviadas <span className="count-badge">{sentRequests.length}</span></h2></div></div>{sentRequests.length ? <div className="people-list">{sentRequests.map((request) => <div className="person-row request-row" key={request.id}><Link to={`/perfil/${request.toUid}`} className="profile-wrapper"><StatusAvatar uid={request.toUid} name={request.toUser?.displayName || 'Usuario'} photoURL={request.toUser?.avatar} /><span className="person-copy"><strong>{request.toUser?.displayName || 'Usuario'}</strong><small>@{request.toUser?.username || 'usuario'} · Pendiente</small></span></Link><button className="text-link" onClick={() => void cancelSent(request.id)} disabled={busy === request.id}><X size={14} /> Cancelar</button></div>)}</div> : <div className="empty-inline"><span className="empty-icon"><Send size={16} /></span><div><strong>Sin solicitudes enviadas</strong><small>Cuando envíes una solicitud, aparecerá aquí hasta que te acepten.</small></div></div>}</section></div>
  </div>
}
