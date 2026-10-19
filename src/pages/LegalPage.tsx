import { ArrowLeft, Clapperboard, ScrollText, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const CONTACT_EMAIL = 'contacto@cinejuntos.app'
const LAST_UPDATE = '19 de octubre de 2026'

type LegalMode = 'terms' | 'privacy'

interface LegalSection {
  title: string
  paragraphs?: string[]
  list?: string[]
}

const termsSections: LegalSection[] = [
  {
    title: 'Aceptación de los términos',
    paragraphs: [
      'Al crear una cuenta, iniciar sesión o usar CineJuntos aceptas estos Términos y Condiciones y nuestra Política de Privacidad. Si no estás de acuerdo con alguna parte, no uses el servicio.',
    ],
  },
  {
    title: 'Qué es CineJuntos',
    paragraphs: [
      'CineJuntos es una plataforma para organizar listas de contenido multimedia y ver videos al mismo tiempo con otra persona, con chat y chat de voz.',
      'No alojamos, almacenamos ni transmitimos los videos o archivos que compartes. Solo guardamos los enlaces que agregas y coordinamos la reproducción mediante reproductores propios o de terceros.',
    ],
  },
  {
    title: 'Tu cuenta',
    paragraphs: [
      'Debes tener al menos 13 años y la edad legal necesaria en tu país para aceptar estos términos. Si eres menor de edad, necesitas el consentimiento de tu madre, padre o tutor.',
      'Te comprometes a proporcionar información veraz, a mantener la seguridad de tu contraseña y a avisarnos de cualquier uso no autorizado. Eres responsable de la actividad realizada desde tu cuenta.',
    ],
  },
  {
    title: 'Uso aceptable',
    paragraphs: [
      'Al usar CineJuntos te comprometes a respetar a las demás personas. No está permitido:',
    ],
    list: [
      'Publicar o compartir contenido ilegal, violento, sexual con menores, discriminatorio o que incite al odio.',
      'Acosar, amenazar, suplantar la identidad de otra persona o divulgar datos privados de terceros sin su consentimiento.',
      'Enviar spam, publicidad no solicitada o usar el servicio para fines comerciales sin nuestra autorización.',
      'Intentar acceder a cuentas ajenas, vulnerar la seguridad del servicio o automatizar su uso de forma abusiva.',
      'Guardar enlaces a contenido que infrinja derechos de autor o que no tengas derecho a compartir.',
    ],
  },
  {
    title: 'Tus listas y tu contenido',
    paragraphs: [
      'Eres responsable de los enlaces, nombres, mensajes y demás contenido que guardes o compartas en CineJuntos. Las listas marcadas como públicas pueden verse desde tu perfil por otras personas usuarias.',
      'Conservas la propiedad de tu contenido. Solo nos concedes una licencia limitada para mostrarlo y procesarlo dentro del servicio, con el único fin de que CineJuntos funcione. Puedes eliminar tus listas y videos en cualquier momento.',
    ],
  },
  {
    title: 'Contenido de terceros',
    paragraphs: [
      'CineJuntos funciona con enlaces y reproductores de sitios externos. No controlamos esos sitios, su disponibilidad ni sus condiciones de uso. Al abrir un enlace externo quedas sujeto a los términos y políticas de ese tercero.',
      'Algunos reproductores no permiten sincronización completa o pueden dejar de estar disponibles sin previo aviso. No garantizamos que todo enlace funcione en todo momento.',
    ],
  },
  {
    title: 'Salas, chat y voz',
    paragraphs: [
      'Las salas, el chat y el chat de voz son funciones en tiempo real. Los mensajes se guardan para mostrar el historial de la sala, mientras que las llamadas de voz se transmiten entre los participantes y no se graban en nuestros servidores.',
      'Estas funciones pueden tener retrasos, interrupciones o fallos propios de la conexión de internet. No deben usarse para emergencias ni como único medio de comunicación importante.',
    ],
  },
  {
    title: 'Moderación y reportes',
    paragraphs: [
      'Podemos revisar, ocultar o eliminar contenido y suspender o cancelar cuentas que incumplan estos términos o que pongan en riesgo a otras personas. Si ves algo inapropiado, repórtalo escribiendo a nuestro correo de contacto.',
    ],
  },
  {
    title: 'Propiedad intelectual',
    paragraphs: [
      'El nombre CineJuntos, su diseño, logotipos, interfaz y código son propiedad de sus creadores o se usan con autorización. No puedes copiarlos, modificarlos ni redistribuirlos sin permiso.',
      'Recibes una licencia personal, limitada, no exclusiva y revocable para usar el servicio de acuerdo con estos términos.',
    ],
  },
  {
    title: 'Disponibilidad y limitación de responsabilidad',
    paragraphs: [
      'El servicio se ofrece “tal cual” y “según disponibilidad”. Trabajamos para mantenerlo funcionando, pero no garantizamos que esté libre de errores, interrupciones o pérdidas de datos.',
      'En la medida permitida por la ley, no somos responsables por daños indirectos, pérdida de contenido, fallos de terceros o uso indebido del servicio. Nada en estos términos limita los derechos que la ley te reconozca como consumidor.',
    ],
  },
  {
    title: 'Terminación',
    paragraphs: [
      'Puedes dejar de usar CineJuntos y cerrar tu cuenta cuando quieras. También podemos suspender o cancelar el acceso si incumples estos términos. Las obligaciones que por su naturaleza deban sobrevivir seguirán vigentes después de la terminación.',
    ],
  },
  {
    title: 'Cambios a estos términos',
    paragraphs: [
      'Podemos actualizar estos términos para reflejar cambios en el servicio o en la ley. Publicaremos la versión vigente en esta página con su fecha de actualización. Si los cambios son importantes, procuraremos avisarte dentro de la app. El uso continuado del servicio implica su aceptación.',
    ],
  },
  {
    title: 'Contacto',
    paragraphs: [
      `Si tienes dudas sobre estos términos, escríbenos a ${CONTACT_EMAIL}.`,
    ],
  },
]

const privacySections: LegalSection[] = [
  {
    title: 'Responsable del tratamiento',
    paragraphs: [
      `CineJuntos es responsable de los datos personales que se tratan dentro de la aplicación. Para cualquier consulta sobre privacidad puedes escribirnos a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Datos que recopilamos',
    paragraphs: [
      'Recopilamos únicamente la información necesaria para que el servicio funcione:',
    ],
    list: [
      'Datos de cuenta: nombre para mostrar, nombre de usuario (@usuario), correo electrónico, foto de perfil y frase o biografía.',
      'Relaciones: lista de amigos y solicitudes de amistad enviadas o recibidas.',
      'Contenido: listas, nombres de listas, enlaces multimedia, títulos, miniaturas y estado de cada video (pendiente o visto).',
      'Actividad en salas: mensajes de chat, reacciones, participantes y tu estado de conexión (en línea o desconectado).',
      'Datos técnicos: identificador de usuario, fecha de registro y datos básicos necesarios para operar la autenticación.',
    ],
  },
  {
    title: 'Datos de voz',
    paragraphs: [
      'El chat de voz usa la conexión directa entre navegadores (WebRTC). El audio se transmite en tiempo real entre los participantes y no se graba ni se almacena en nuestros servidores. Tu navegador te pedirá permiso antes de activar el micrófono y puedes desactivarlo cuando quieras.',
    ],
  },
  {
    title: 'Cómo usamos tus datos',
    paragraphs: [
      'Usamos tus datos para crear y mantener tu cuenta, mostrar tu perfil y tus listas públicas, gestionar amistades y solicitudes, sincronizar las salas, mostrar el chat y la presencia, brindar soporte y mantener la seguridad del servicio.',
      'No usamos tus datos para publicidad de terceros ni los vendemos.',
    ],
  },
  {
    title: 'Con quién compartimos',
    paragraphs: [
      'No vendemos tus datos personales. Los compartimos únicamente con proveedores que nos ayudan a operar el servicio, principalmente Google Firebase (Authentication, Firestore y Realtime Database), que aloja la información en sus servidores y puede procesarla en otros países bajo sus propias garantías.',
      'También podemos divulgar información si la ley lo exige o para proteger derechos, seguridad y integridad de las personas usuarias.',
      'Otras personas usuarias pueden ver tu nombre, @usuario, foto, biografía, listas públicas, estado de conexión y los mensajes que envíes en una sala compartida.',
    ],
  },
  {
    title: 'Cookies y almacenamiento local',
    paragraphs: [
      'CineJuntos no usa cookies publicitarias. Utilizamos el almacenamiento local del navegador y la sesión de Firebase para mantener tu inicio de sesión, recordar el tema visual y conservar preferencias básicas. Puedes borrar estos datos desde la configuración de tu navegador, aunque eso cerrará tu sesión.',
    ],
  },
  {
    title: 'Cuánto tiempo conservamos los datos',
    paragraphs: [
      'Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, borraremos tu perfil, tus listas y tus relaciones, salvo la información que debamos conservar por obligaciones legales o de seguridad. Los mensajes de una sala pueden permanecer mientras la sala exista o hasta que se elimine.',
    ],
  },
  {
    title: 'Seguridad',
    paragraphs: [
      'Aplicamos medidas razonables para proteger tu información, como autenticación, reglas de acceso y cifrado en tránsito. Aun así, ningún sistema es completamente seguro: protege tu contraseña y no compartas tu cuenta.',
    ],
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      'Puedes acceder, corregir o eliminar la información de tu perfil desde la app. También puedes solicitar el acceso, la rectificación, la eliminación, la oposición o la portabilidad de tus datos escribiéndonos a nuestro correo de contacto. Responderemos en un plazo razonable y conforme a la ley aplicable.',
    ],
  },
  {
    title: 'Menores de edad',
    paragraphs: [
      'CineJuntos no está dirigido a menores de 13 años. Si eres menor, debes contar con el consentimiento de tu madre, padre o tutor. Si detectamos una cuenta de un menor sin la autorización correspondiente, podremos eliminarla.',
    ],
  },
  {
    title: 'Cambios a esta política',
    paragraphs: [
      'Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa. Publicaremos la nueva versión en esta página con su fecha de actualización. Si los cambios son relevantes, procuraremos avisarte dentro de la app.',
    ],
  },
  {
    title: 'Contacto',
    paragraphs: [
      `Para ejercer tus derechos o resolver dudas sobre privacidad, escríbenos a ${CONTACT_EMAIL}.`,
    ],
  },
]

export default function LegalPage({ mode }: { mode: LegalMode }) {
  const navigate = useNavigate()
  const isTerms = mode === 'terms'
  const sections = isTerms ? termsSections : privacySections

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/login')
  }

  return <main className="legal-page">
    <div className="legal-shell">
      <header className="legal-topbar">
        <Link className="brand-lockup" to="/login"><span className="brand-mark"><Clapperboard size={19} /></span><span>Cine<span className="brand-light">Juntos</span></span></Link>
        <button type="button" className="legal-back" onClick={goBack}><ArrowLeft size={16} /> Regresar</button>
      </header>

      <div className="legal-hero">
        <div className="eyebrow"><span className="eyebrow-line" /> INFORMACIÓN LEGAL</div>
        <h1>{isTerms ? 'Términos y condiciones' : 'Política de privacidad'}<span className="heading-period">.</span></h1>
        <p>{isTerms ? 'Las reglas para usar CineJuntos y compartir historias con otras personas.' : 'Qué datos usamos, para qué y cómo puedes controlarlos.'}</p>
        <span className="legal-updated">Última actualización: {LAST_UPDATE}</span>
      </div>

      <nav className="legal-tabs" aria-label="Documentos legales">
        <Link to="/terminos" className={`legal-tab ${isTerms ? 'active' : ''}`} aria-current={isTerms ? 'page' : undefined}><ScrollText size={15} /> Términos y condiciones</Link>
        <Link to="/privacidad" className={`legal-tab ${!isTerms ? 'active' : ''}`} aria-current={!isTerms ? 'page' : undefined}><ShieldCheck size={15} /> Política de privacidad</Link>
      </nav>

      <article className="legal-content">
        {sections.map((section, index) => <section className="legal-section" key={section.title}>
          <h2><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.list && <ul>{section.list.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>)}
      </article>

      <footer className="legal-footer">
        <p>¿Tienes dudas sobre este documento? Escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        <div className="legal-actions">
          <button type="button" className="text-link" onClick={goBack}><ArrowLeft size={15} /> Regresar</button>
          <Link className="primary-button" to="/login">Ir a CineJuntos</Link>
        </div>
      </footer>
    </div>
  </main>
}
