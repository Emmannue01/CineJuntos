import { usePresence } from '../hooks/usePresence'
import { Avatar } from './AppShell'

export default function StatusAvatar({ uid, name, photoURL, size }: { uid: string; name: string; photoURL?: string; size?: 'small' | 'large' }) {
  const online = usePresence(uid)
  return <span className="status-avatar"><Avatar name={name} url={photoURL} size={size} /><i className={online ? 'online' : ''} title={online ? 'En línea' : 'Desconectado'} /></span>
}
