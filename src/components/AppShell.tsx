import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bookmark, Clapperboard, Home, LogOut, Users, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePresence } from '../hooks/usePresence'

const links = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/amigos', label: 'Amigos', icon: Users },
  { to: '/lista', label: 'Mi lista', icon: Bookmark },
]

export default function AppShell() {
  const { user, profile, authError, clearAuthError, logout } = useAuth()
  const navigate = useNavigate()
  usePresence(user?.uid)
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <NavLink to="/" className="brand-lockup"><span className="brand-mark"><Clapperboard size={19} /></span><span>Cine<span className="brand-light">Juntos</span></span></NavLink>
        <div className="sidebar-label">TU ESPACIO</div>
        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/perfil" className={({ isActive }) => `profile-mini ${isActive ? 'active' : ''}`}>
            <Avatar name={profile?.displayName || 'Cinefilo'} url={profile?.avatar} /><span className="profile-mini-copy"><strong>{profile?.displayName || 'Tu perfil'}</strong><small>@{profile?.username}</small></span><UserRound size={16} />
          </NavLink>
          <button className="nav-link logout-link" onClick={async () => { await logout(); navigate('/login') }}><LogOut size={17} /><span>Cerrar sesión</span></button>
          <div className="sidebar-footnote"><span className="live-dot" /> Una buena historia se disfruta más en compañía.</div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar"><NavLink to="/" className="mobile-brand"><span className="brand-mark"><Clapperboard size={17} /></span>Cine<span className="brand-light">Juntos</span></NavLink><div className="topbar-note">Tu próxima noche de cine empieza aquí <span>✳</span></div><NavLink to="/perfil" className="topbar-avatar" aria-label="Ir a mi perfil"><Avatar name={profile?.displayName || 'Cinefilo'} url={profile?.avatar} /></NavLink></header>
        {authError && <div className="inline-alert auth-session-alert" role="alert">{authError}<button onClick={clearAuthError}>Cerrar</button></div>}
        <main className="page-content"><Outlet /></main>
      </div>
      <nav className="mobile-tabs" aria-label="Navegación principal">
        {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}
        <NavLink to="/perfil" className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}><UserRound size={19} /><span>Perfil</span></NavLink>
      </nav>
    </div>
  )
}

export function Avatar({ name, url, size }: { name: string; url?: string; size?: 'small' | 'large' }) {
  return url ? <img className={`avatar ${size || ''}`} src={url} alt={name} referrerPolicy="no-referrer" /> : <span className={`avatar avatar-fallback ${size || ''}`} aria-label={name}>{name.slice(0, 1).toUpperCase()}</span>
}
