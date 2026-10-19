import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Check, Clapperboard, Clock3, Copy, Film, Globe, Link2, ListVideo, LoaderCircle, MessageCircle, Mic, Pause, Play, Plus, Search, Sparkles, Trash2, Users, Volume2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { readableError } from '../lib/errors'

const tutorialSteps = [
  { title: 'Crea tu cuenta y tu perfil', text: 'Regístrate con tu correo o con Google y elige tu nombre, tu @usuario, una foto y una frase. Así te reconocerán tus amigos dentro de CineJuntos.' },
  { title: 'Encuentra a tu gente', text: 'En Amigos busca por @usuario y envía solicitudes. Puedes aceptar o rechazar las que te llegan, cancelar las que enviaste y abrir el perfil de cada persona.' },
  { title: 'Arma una lista juntos', text: 'Crea listas personales o conjuntas con un amigo. Tú decides si serán privadas o públicas: las públicas aparecen en tu perfil para que otros descubran lo que te gusta.' },
  { title: 'Guarda cualquier enlace', text: 'Pega un enlace de video, audio o una página con reproductor. CineJuntos detecta el contenido y lo guarda en la lista que elijas.' },
  { title: 'Organiza tu función', text: 'Marca videos como vistos o pendientes, súbelos y bájalos para ordenar la noche, o elimina los que ya no quieras. También puedes renombrar, hacer pública o borrar una lista completa.' },
  { title: 'Inicia una sala compartida', text: 'Pulsa play en cualquier video y se abrirá una sala con el resto de la lista en cola. Play, pausa, avance y velocidad se sincronizan en ambas pantallas.' },
  { title: 'Invita y comparte el enlace', text: 'Invita a un amigo desde la sala o comparte el enlace para que entre desde otro dispositivo. Las invitaciones aparecen en el inicio de tu amigo para aceptarlas o rechazarlas.' },
  { title: 'Hablen durante la película', text: 'Usen el chat en vivo, manden reacciones con emojis o activen el micrófono para hablar. También pueden cambiar el video o la velocidad sin salir de la sala.' },
  { title: 'Salir o terminar la función', text: 'Al salir puedes irte solo y dejar la sala activa para tu amigo, o terminar la función para todos. En Inicio siempre verás tus salas activas, invitaciones y lo pendiente de tu lista.' },
]

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, authError, clearAuthError, login, loginWithGoogle, register } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialPlaying, setTutorialPlaying] = useState(true)
  const isRegister = mode === 'register'
  const requestedRedirect = searchParams.get('redirect')
  const redirect = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//') && !requestedRedirect.includes('\\') ? requestedRedirect : '/'

  useEffect(() => {
    if (!tutorialOpen || !tutorialPlaying) return
    const timer = window.setTimeout(() => {
      if (tutorialStep === tutorialSteps.length - 1) setTutorialPlaying(false)
      else setTutorialStep((current) => current + 1)
    }, 7000)
    return () => window.clearTimeout(timer)
  }, [tutorialOpen, tutorialPlaying, tutorialStep])

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
    clearAuthError()
    try {
      const result = await loginWithGoogle()
      if (result === 'popup') navigate(redirect, { replace: true })
    }
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
            {(error || authError) && <div className="form-error" role="alert">{error || authError}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{isRegister ? 'Crear mi cuenta' : 'Entrar a CineJuntos'}<span aria-hidden="true">↗</span></button>
          </form>
          <p className="auth-switch">{isRegister ? '¿Ya tienes cuenta?' : '¿Todavía no tienes cuenta?'} <Link to={isRegister ? '/login' : '/registro'}>{isRegister ? 'Inicia sesión' : 'Regístrate gratis'}</Link></p>
          <button type="button" className="tutorial-trigger tutorial-trigger-bottom" onClick={() => { setTutorialStep(0); setTutorialPlaying(true); setTutorialOpen(true) }}><Play size={14} fill="currentColor" /> Cómo usar CineJuntos <span>· {tutorialSteps.length} pasos</span></button>
          <p className="auth-legal">Al continuar aceptas nuestros <Link to="/terminos" target="_blank" rel="noreferrer">términos de uso</Link> y nuestra <Link to="/privacidad" target="_blank" rel="noreferrer">política de privacidad</Link>.</p>
        </div>
      </section>
      {tutorialOpen && <div className="tutorial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTutorialOpen(false) }}><section className="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><header className="tutorial-header"><div><span className="section-kicker">RECORRIDO RÁPIDO · {String(tutorialStep + 1).padStart(2, '0')} / {String(tutorialSteps.length).padStart(2, '0')}</span><h2 id="tutorial-title">{tutorialSteps[tutorialStep].title}</h2></div><button type="button" className="tutorial-close" onClick={() => setTutorialOpen(false)} aria-label="Cerrar recorrido"><X size={19} /></button></header><TutorialScene step={tutorialStep} /><p className="tutorial-description">{tutorialSteps[tutorialStep].text}</p><div className="tutorial-progress" aria-label={`Escena ${tutorialStep + 1} de ${tutorialSteps.length}`}>{tutorialSteps.map((step, index) => <button type="button" key={step.title} className={index === tutorialStep ? 'active' : ''} onClick={() => { setTutorialStep(index); setTutorialPlaying(false) }} aria-label={`Ver escena ${index + 1}`} />)}</div><footer className="tutorial-controls"><button type="button" className="tutorial-step-button" onClick={() => { setTutorialStep(Math.max(0, tutorialStep - 1)); setTutorialPlaying(false) }} disabled={tutorialStep === 0} aria-label="Escena anterior"><ArrowLeft size={18} /></button><button type="button" className="tutorial-play-button" onClick={() => setTutorialPlaying(!tutorialPlaying)} aria-label={tutorialPlaying ? 'Pausar recorrido' : 'Reproducir recorrido'}>{tutorialPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}{tutorialPlaying ? 'Pausar' : 'Reproducir'}</button><button type="button" className="tutorial-step-button" onClick={() => { setTutorialStep(Math.min(tutorialSteps.length - 1, tutorialStep + 1)); setTutorialPlaying(false) }} disabled={tutorialStep === tutorialSteps.length - 1} aria-label="Siguiente escena"><ArrowRight size={18} /></button></footer></section></div>}
    </main>
  )
}

function TutorialScene({ step }: { step: number }) {
  return <div className={`tutorial-scene tutorial-scene-${step}`} key={step}>
    <div className="tutorial-app-bar"><span className="tutorial-app-mark"><Clapperboard size={14} /></span><strong>CineJuntos</strong><span className="tutorial-demo-avatar">CJ</span></div>
    {step === 0 && <div className="tutorial-profile-demo">
      <div className="tutorial-profile-card"><span className="tutorial-profile-avatar">CJ</span><strong>Tu nombre</strong><small>@tu_usuario</small><p>“Historias que se disfrutan mejor acompañado.”</p></div>
      <div className="tutorial-google-chip"><GoogleMark /> Continuar con Google</div>
      <div className="tutorial-profile-tags"><span>Foto</span><span>Frase</span><span>@usuario</span></div>
    </div>}
    {step === 1 && <div className="tutorial-friends-demo">
      <div className="tutorial-search-input"><Search size={14} /> Busca por @usuario</div>
      <div className="tutorial-person"><span className="tutorial-person-avatar">S</span><span><b>Sam</b><small>@sam_cine</small></span><em>Añadir</em></div>
      <div className="tutorial-person"><span className="tutorial-person-avatar alt">A</span><span><b>Alex</b><small>@alex_cine · quiere conectar</small></span><em className="accept">Aceptar</em></div>
      <div className="tutorial-friend-note"><Check size={13} /> Solicitudes enviadas y recibidas en un solo lugar</div>
    </div>}
    {step === 2 && <div className="tutorial-list-demo">
      <div className="tutorial-list-heading"><ListVideo size={16} /><strong>Nueva lista</strong><span><Users size={12} /> conjunta</span></div>
      <div className="tutorial-form-row"><small>Nombre</small><div className="tutorial-fake-input">Maratón del viernes</div></div>
      <div className="tutorial-form-row two"><div><small>Tipo</small><div className="tutorial-fake-input">Conjunta</div></div><div><small>Amigo</small><div className="tutorial-fake-input">Sam</div></div></div>
      <div className="tutorial-fake-toggle"><span>Lista pública</span><i /></div>
    </div>}
    {step === 3 && <div className="tutorial-search-demo">
      <div className="tutorial-search-input"><Link2 size={14} /> https://tu-enlace-multimedia</div>
      <div className="tutorial-add-options"><span><Users size={13} /> Guardar en <b>Maratón del viernes</b></span><span className="tutorial-add-button"><Plus size={13} /> Añadir</span></div>
      <div className="tutorial-poster-row"><span>VIDEO</span><span>AUDIO</span><span>WEB</span></div>
      <div className="tutorial-demo-caption"><Check size={13} /> Enlace detectado y guardado</div>
    </div>}
    {step === 4 && <div className="tutorial-list-demo">
      <div className="tutorial-list-heading"><Bookmark size={16} /><strong>Maratón del viernes</strong><span><Globe size={12} /> Pública</span></div>
      <div className="tutorial-list-row"><span className="tutorial-thumb" /><span><b>La próxima película</b><small>Por ver · reproductor externo</small></span><span className="tutorial-row-actions"><ArrowUp size={13} /><ArrowDown size={13} /><Check size={13} /><Trash2 size={13} /></span></div>
      <div className="tutorial-list-row"><span className="tutorial-thumb thumb-two" /><span><b>Videos para el finde</b><small>Por ver · video directo</small></span><span className="tutorial-row-actions"><ArrowUp size={13} /><ArrowDown size={13} /><Check size={13} /><Trash2 size={13} /></span></div>
      <div className="tutorial-demo-caption"><Check size={13} /> 2 vistos · 2 por ver</div>
    </div>}
    {step === 5 && <div className="tutorial-watch-demo">
      <div className="tutorial-screen"><Film size={33} /><span>REPRODUCIENDO JUNTOS</span><i><Play size={12} fill="currentColor" /></i></div>
      <div className="tutorial-sync-line"><span /><span>Sincronizado automáticamente</span><span /></div>
      <div className="tutorial-people"><span>Alex · viendo</span><span>Sam · viendo</span></div>
      <div className="tutorial-queue-chip"><Clock3 size={12} /> En la cola: 3 videos más</div>
    </div>}
    {step === 6 && <div className="tutorial-invite-demo">
      <div className="tutorial-invite-actions"><span><Copy size={13} /> Compartir enlace</span><span><Users size={13} /> Invitar amigo</span></div>
      <div className="tutorial-person"><span className="tutorial-person-avatar">S</span><span><b>Sam</b><small>@sam_cine</small></span><em>Invitar</em></div>
      <div className="tutorial-friend-note"><Check size={13} /> La invitación llega al inicio de tu amigo</div>
    </div>}
    {step === 7 && <div className="tutorial-chat-demo">
      <div className="tutorial-chat-message"><span>Alex</span><b>¡Esta escena es buenísima!</b></div>
      <div className="tutorial-chat-message mine"><span>Tú</span><b>🍿 totalmente</b></div>
      <div className="tutorial-reactions">{['❤️', '😂', '😮', '👏', '🍿'].map((emoji) => <span key={emoji}>{emoji}</span>)}</div>
      <div className="tutorial-chat-actions"><span><MessageCircle size={15} /> Chat</span><span><Mic size={15} /> Voz</span><span><Volume2 size={15} /> Velocidad</span></div>
    </div>}
    {step === 8 && <div className="tutorial-exit-demo">
      <div className="tutorial-exit-option"><strong>Solo salir</strong><small>La sala sigue activa para tu amigo</small></div>
      <div className="tutorial-exit-option danger"><strong>Terminar sala</strong><small>La función se acaba para todos</small></div>
      <div className="tutorial-friend-note"><Check size={13} /> Vuelves al inicio con tus salas y tu lista</div>
    </div>}
  </div>
}

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.5 18.7 11.9 24 11.9Z"/></svg>
}
