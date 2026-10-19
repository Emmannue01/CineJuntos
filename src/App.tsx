import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { isFirebaseConfigured } from './firebase'
import AppShell from './components/AppShell'
import ProtectedRoute from './routes/ProtectedRoute'
import './App.css'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))
const RoomPage = lazy(() => import('./pages/RoomPage'))
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'))

const router = createBrowserRouter([
  { path: '/login', element: <AuthPage mode="login" /> },
  { path: '/registro', element: <AuthPage mode="register" /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'amigos', element: <FriendsPage /> },
          { path: 'lista', element: <WatchlistPage /> },
          { path: 'sala/:roomId', element: <RoomPage /> },
          { path: 'perfil', element: <ProfilePage /> },
          { path: 'perfil/:userId', element: <PublicProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <AuthProvider><div className="app-root">{!isFirebaseConfigured && <div className="configuration-banner"><strong>Falta conectar Firebase.</strong><span>Copia .env.example como .env y completa las credenciales para habilitar las cuentas.</span></div>}<Suspense fallback={<div className="auth-loading"><span className="spinner" /><span>Cargando CineJuntos…</span></div>}><RouterProvider router={router} future={{ v7_startTransition: true }} /></Suspense></div></AuthProvider>
}
