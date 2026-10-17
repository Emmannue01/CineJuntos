import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { isFirebaseConfigured } from '../firebase'
import type { UserProfile } from '../types'
import { readableError } from '../lib/errors'

async function loadAuth() {
  if (!isFirebaseConfigured) throw new Error('Configura Firebase en el archivo .env para habilitar las cuentas.')
  const [firebase, sdk] = await Promise.all([import('../firebase/auth'), import('firebase/auth')])
  return { ...firebase, ...sdk }
}

async function loadFirestore() {
  const [firebase, sdk] = await Promise.all([import('../firebase/firestore'), import('firebase/firestore')])
  return { db: firebase.db, ...sdk }
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  authError: string
  clearAuthError: () => void
  register: (email: string, password: string, username: string, displayName: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<'popup' | 'redirect'>
  logout: () => Promise<void>
  updateProfile: (changes: Pick<UserProfile, 'username' | 'displayName' | 'bio' | 'avatar'>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function makeUsername(name: string) {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 15) || 'cinefilo'
  return `${base}_${Math.random().toString(36).slice(2, 6)}`
}

async function reserveProfile(user: User, username: string, displayName: string) {
  const { db, doc, runTransaction, serverTimestamp } = await loadFirestore()
  const usernameLower = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,20}$/.test(usernameLower)) throw new Error('El usuario debe tener entre 3 y 20 caracteres: letras, números o _.')
  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', usernameLower)
    const profileRef = doc(db, 'users', user.uid)
    const [usernameSnap, profileSnap] = await Promise.all([transaction.get(usernameRef), transaction.get(profileRef)])
    if (usernameSnap.exists() && usernameSnap.data().uid !== user.uid) throw new Error('Ese nombre de usuario ya está ocupado.')
    if (profileSnap.exists() && profileSnap.data().usernameLower !== usernameLower) {
      transaction.delete(doc(db, 'usernames', profileSnap.data().usernameLower))
    }
    transaction.set(usernameRef, { uid: user.uid })
    transaction.set(profileRef, {
      uid: user.uid,
      username: usernameLower,
      usernameLower,
      displayName: displayName.trim() || usernameLower,
      photoURL: user.photoURL || '',
      avatar: user.photoURL || '',
      bio: profileSnap.exists() ? profileSnap.data().bio || '' : '',
      createdAt: profileSnap.exists() ? profileSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true })
  })
}

async function ensureProfile(user: User) {
  const { db, doc, getDoc } = await loadFirestore()
  const profileRef = doc(db, 'users', user.uid)
  const snapshot = await getDoc(profileRef)
  if (snapshot.exists()) return snapshot.data() as UserProfile
  const username = makeUsername(user.displayName || user.email?.split('@')[0] || 'cinefilo')
  await reserveProfile(user, username, user.displayName || username)
  return (await getDoc(profileRef)).data() as UserProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const registrationInProgressRef = useRef(false)
  const authSdkRef = useRef<Awaited<ReturnType<typeof loadAuth>> | null>(null)

  const refreshProfile = async () => {
    const { auth } = await loadAuth()
    if (!auth.currentUser) return
    const { db, doc, getDoc } = await loadFirestore()
    const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid))
    if (snapshot.exists()) setProfile(snapshot.data() as UserProfile)
  }

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }
    let active = true
    let unsubscribe: (() => void) | undefined
    void (async () => {
      const authSdk = await loadAuth()
      authSdkRef.current = authSdk
      const { auth, onAuthStateChanged, getRedirectResult } = authSdk
      if (!active) return
      try {
        const result = await getRedirectResult(auth)
        if (result) {
          const resultProfile = await ensureProfile(result.user)
          if (!active) return
          setProfile(resultProfile)
          setUser(result.user)
          setAuthError('')
        }
      } catch (error) {
        if (active) setAuthError(readableError(error))
      }
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (!active) return
        if (registrationInProgressRef.current) return
        if (!currentUser) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }
        try {
          const currentProfile = await ensureProfile(currentUser)
          if (!active) return
          setProfile(currentProfile)
          setUser(currentUser)
          setAuthError('')
        } catch (error) {
          console.error('No se pudo cargar el perfil', error)
          if (active) setAuthError(`Google pudo autenticarte, pero no se pudo guardar tu perfil: ${readableError(error)}`)
          setProfile(null)
          setUser(null)
        } finally {
          if (active) setLoading(false)
        }
      })
    })().catch((error) => {
      console.error('No se pudo inicializar Firebase Authentication', error)
      if (active) setLoading(false)
    })
    return () => { active = false; unsubscribe?.() }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    profile,
    loading,
    authError,
    clearAuthError: () => setAuthError(''),
    register: async (email, password, username, displayName) => {
      const { auth, createUserWithEmailAndPassword, deleteUser } = await loadAuth()
      registrationInProgressRef.current = true
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        try {
          await reserveProfile(credential.user, username, displayName)
          const { db, doc, getDoc } = await loadFirestore()
          setProfile((await getDoc(doc(db, 'users', credential.user.uid))).data() as UserProfile)
          setUser(credential.user)
        } catch (error) {
          await deleteUser(credential.user)
          setUser(null)
          setProfile(null)
          throw error
        }
      } finally {
        registrationInProgressRef.current = false
      }
    },
    login: async (email, password) => {
      const { auth, signInWithEmailAndPassword } = await loadAuth()
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const currentProfile = await ensureProfile(credential.user)
      setProfile(currentProfile)
      setUser(credential.user)
    },
    loginWithGoogle: async () => {
      const authSdk = authSdkRef.current
      if (!authSdk) throw new Error('Firebase Authentication todavía se está preparando. Inténtalo de nuevo.')
      const { auth, googleProvider, signInWithPopup, signInWithRedirect } = authSdk
      setAuthError('')
      const mobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      if (mobileBrowser) {
        const redirect = signInWithRedirect(auth, googleProvider)
        await redirect
        return 'redirect' as const
      }
      try {
        const credential = await signInWithPopup(auth, googleProvider)
        const currentProfile = await ensureProfile(credential.user)
        setProfile(currentProfile)
        setUser(credential.user)
        return 'popup' as const
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(code)) {
          await signInWithRedirect(auth, googleProvider)
          return 'redirect' as const
        }
        throw error
      }
    },
    logout: async () => {
      const { auth, signOut } = await loadAuth()
      await signOut(auth)
    },
    updateProfile: async (changes) => {
      if (!user) throw new Error('Inicia sesión para editar tu perfil.')
      await reserveProfile(user, changes.username, changes.displayName)
      const { db, doc, runTransaction, serverTimestamp } = await loadFirestore()
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'users', user.uid), { bio: changes.bio, avatar: changes.avatar, photoURL: changes.avatar, updatedAt: serverTimestamp() })
      })
      const { updateProfile } = await loadAuth()
      await updateProfile(user, { displayName: changes.displayName, photoURL: changes.avatar })
      await refreshProfile()
    },
    refreshProfile,
  }), [user, profile, loading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
