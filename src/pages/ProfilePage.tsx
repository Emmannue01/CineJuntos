import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Check, Clapperboard, LoaderCircle, LogOut, Save, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'
import { Avatar } from '../components/AppShell'

export default function ProfilePage() {
  const { profile, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [avatar, setAvatar] = useState(profile?.avatar || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setNotice(''); setError('')
    try {
      await updateProfile({ displayName, username: username.toLowerCase(), avatar, bio })
      setNotice('Tu perfil quedó actualizado.')
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy(false) }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return <div className="page-enter profile-page"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> TU IDENTIDAD DE CINE</div><h1>Tu perfil<span className="heading-period">.</span></h1><p>Así te verán tus amigos cuando los invites a una función.</p></div><div className="title-illustration profile-art"><UserRound size={27} /><span>YO</span></div></div>
    {error && <div className="inline-alert" role="alert">{error}<button onClick={() => setError('')}>Cerrar</button></div>}{notice && <div className="inline-success" role="status">{notice}<button onClick={() => setNotice('')}>Cerrar</button></div>}
    <div className="profile-layout"><section className="profile-preview"><div className="profile-preview-top"><span className="section-kicker">TU BUTACA</span><span>01 / PERFIL</span></div><div className="profile-preview-body"><div className="profile-avatar-frame"><Avatar name={displayName || 'C'} url={avatar} size="large" /><span className="camera-badge"><Camera size={14} /></span></div><h2>{displayName || 'Tu nombre'}</h2><span className="profile-username">@{username || 'tu_usuario'}</span><p>{bio || 'La próxima película buena todavía está por descubrirse.'}</p><div className="profile-preview-footer"><Clapperboard size={14} /> CINEJUNTOS MEMBER</div></div><div className="profile-preview-lines"><span /><span /><span /></div></section>
      <form className="profile-form" onSubmit={save}><div className="section-heading"><div><span className="section-kicker">PERSONALIZA TU ESPACIO</span><h2>Datos de tu perfil</h2></div></div><label>Nombre para mostrar<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={40} placeholder="Cómo te llamas" /></label><label>Nombre de usuario<div className="username-input"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" /></div><small>Único y fácil de encontrar.</small></label><label>Foto de perfil <span className="optional-label">OPCIONAL</span><div className="url-input"><Camera size={16} /><input type="url" value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://..." /></div><small>Usa el enlace directo de una imagen pública.</small></label><label>Una frase sobre ti <span className="optional-label">OPCIONAL</span><textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="¿Qué tipo de historias te gustan?" rows={3} maxLength={160} /></label><div className="profile-form-buttons"><button type="submit" className="primary-button profile-save" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} Guardar cambios <Check size={15} /></button><button type="button" className="profile-logout-button" onClick={handleLogout}><LogOut size={16} /> Cerrar sesión</button></div></form>
    </div>
  </div>
}
