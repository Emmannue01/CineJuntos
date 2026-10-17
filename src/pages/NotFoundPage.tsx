import { Link } from 'react-router-dom'
import { ArrowLeft, Clapperboard } from 'lucide-react'

export default function NotFoundPage() {
  return <div className="not-found-page"><div className="not-found-art"><Clapperboard size={34} /><span>404</span></div><span className="section-kicker">ESCENA NO ENCONTRADA</span><h1>Esta película<br />no está en cartelera.</h1><p>La página que buscas no existe o cambió de sala.</p><Link className="primary-button" to="/"><ArrowLeft size={16} /> Volver al inicio</Link></div>
}
