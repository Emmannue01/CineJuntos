import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bookmark, Clapperboard, Film, Home, LogOut, Monitor, Moon, Sun, Users, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { usePublishPresence } from '../hooks/usePresence'
import { useTheme } from '../hooks/useTheme'

const links = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/amigos', label: 'Amigos', icon: Users },
  { to: '/lista', label: 'Mi lista', icon: Bookmark },
  { to: '/catalogo', label: 'Catálogo', icon: Film },
]

export default function AppShell() {
  const { user, profile, authError, clearAuthError, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  usePublishPresence(user?.uid)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const handleResize = () => {
      if (window.innerWidth > 850) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [menuOpen])

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
          <div className="sidebar-theme-row">
            <span>Tema</span>
            <button
              type="button"
              className="sidebar-theme-btn"
              onClick={toggleTheme}
              title="Cambiar tema: Sistema / Claro / Oscuro"
            >
              {theme === 'system' ? <Monitor size={14} /> : theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'system' ? 'Sistema' : theme === 'light' ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>
          <div className="sidebar-footnote"><span className="live-dot" /> Una buena historia se disfruta más en compañía.</div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <NavLink to="/" className="mobile-brand"><span className="brand-mark"><Clapperboard size={17} /></span>Cine<span className="brand-light">Juntos</span></NavLink>
          <div className="topbar-note">Tu próxima noche de cine empieza aquí <span>✳</span></div>
          <div className="topbar-user-menu" ref={menuRef}>
            <button
              type="button"
              className={`topbar-avatar-button ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Abrir menú de usuario"
              aria-expanded={menuOpen}
            >
              <Avatar name={profile?.displayName || 'Cinefilo'} url={profile?.avatar} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="user-dropdown-backdrop"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="user-dropdown-menu" role="menu">
                  <div className="user-dropdown-header">
                    <Avatar name={profile?.displayName || 'Cinefilo'} url={profile?.avatar} size="small" />
                    <div className="user-dropdown-info">
                      <strong>{profile?.displayName || 'Cinefilo'}</strong>
                      <small>@{profile?.username || 'usuario'}</small>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <NavLink
                    to="/perfil"
                    className="user-dropdown-item"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                  >
                    <UserRound size={17} />
                    <span>Mi perfil</span>
                  </NavLink>
                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={toggleTheme}
                    role="menuitem"
                  >
                    {theme === 'system' ? <Monitor size={17} /> : theme === 'light' ? <Sun size={17} /> : <Moon size={17} />}
                    <span>Tema: {theme === 'system' ? 'Sistema' : theme === 'light' ? 'Claro' : 'Oscuro'}</span>
                    <span className="user-dropdown-badge">{theme === 'system' ? 'Auto' : theme === 'light' ? 'Luz' : 'Noche'}</span>
                  </button>
                  <div className="user-dropdown-divider" />
                  <button
                    type="button"
                    className="user-dropdown-item logout"
                    onClick={async () => {
                      setMenuOpen(false)
                      await logout()
                      navigate('/login')
                    }}
                    role="menuitem"
                  >
                    <LogOut size={17} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
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
