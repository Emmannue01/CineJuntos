import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Clapperboard, Film, LoaderCircle, Play, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, login, loginWithGoogle, register } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isRegister = mode === 'register'
  const requestedRedirect = searchParams.get('redirect')
  const redirect = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//') && !requestedRedirect.includes('\\') ? requestedRedirect : '/'

  if (loading) return <div className="auth-loading"><span className="spinner" /></div>
  if (user) return <Navigate to={redirect} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) await register(email, password, username, displayName)
      else await login(email, password)
      navigate(redirect, { replace: true })
    } catch (cause) { setError(readableError(cause)) }
    finally { setBusy(false) }
  }

  async function google() {
    setBusy(true)
    setError('')
    try { await loginWithGoogle(); navigate(redirect, { replace: true }) }
    catch (cause) { setError(readableError(cause)) }
    finally { setBusy(false) }
  }

  return (
    <main className="auth-page">
      <div className="auth-left">
        <Link className="brand-lockup auth-brand" to="/login"><span className="brand-mark"><Clapperboard size={19} /></span><span>Cine<span className="brand-light">Juntos</span></span></Link>
        <div className="auth-content">
          <div className="eyebrow"><span className="eyebrow-line" /> TU CINE, EN COMPAÑÍA</div>
          <h1>{isRegister ? <>Las mejores historias<br /><em>se comparten.</em></> : <>Una peli cerca.<br /><em>Tu persona favorita.</em></>}</h1>
          <p className="auth-intro">Sincronizados aunque estén lejos. Elijan algo rico, acomódense y denle play juntos.</p>
          <div className="auth-poster-stack" aria-hidden="true">
            <div className="poster poster-one"><span>UNA NOCHE<br />PARA RECORDAR</span><i>01 / 03</i></div>
            <div className="poster poster-two"><span>LO QUE<br />NOS UNE</span><i>02 / 03</i></div>
            <div className="poster poster-three"><span>EL PLAN<br />PERFECTO</span><i>03 / 03</i></div>
            <div className="poster-caption"><Play size={14} fill="currentColor" /> Dos pantallas. Un mismo momento.</div>
          </div>
          <div className="auth-ornament"><Sparkles size={17} /> Hecho para compartir el sillón, incluso a kilómetros.</div>
        </div>
        <span className="auth-copyright">CINEJUNTOS · 2025</span>
      </div>
      <section className="auth-right">
        <div className="auth-form-wrap">
          <div className="form-kicker"><Film size={16} /> {isRegister ? 'TU PRIMERA ESCENA' : 'QUÉ BUENO VERTE'}</div>
          <h2>{isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</h2>
          <p className="form-subtitle">{isRegister ? 'Arma tu rincón para ver películas juntos.' : 'Vuelve a donde quedó la última película.'}</p>
          <button type="button" className="google-button" onClick={google} disabled={busy}><GoogleMark /> Continuar con Google</button>
          <div className="form-divider"><span /> o con tu correo <span /></div>
          <form className="auth-form" onSubmit={submit}>
            {isRegister && <>
              <label>¿Cómo te llamas?<input required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu nombre" maxLength={40} /></label>
              <label>Elige tu usuario<div className="username-input"><span>@</span><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="usuario" minLength={3} maxLength={20} pattern="[a-z0-9_]{3,20}" /></div><small>3–20 caracteres, letras, números o _</small></label>
            </>}
            <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></label>
            <label>Contraseña<input required type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{isRegister ? 'Crear mi cuenta' : 'Entrar a CineJuntos'}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-switch">{isRegister ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'} <Link to={isRegister ? '/login' : '/registro'}>{isRegister ? 'Inicia sesión' : 'Regístrate gratis'}</Link></p>
          <p className="auth-legal">Al continuar aceptas nuestros términos de uso y política de privacidad.</p>
        </div>
      </section>
    </main>
  )
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.5 18.7 11.9 24 11.9Z"/></svg>
}
