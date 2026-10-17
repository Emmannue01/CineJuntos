export function readableError(error: unknown): string {
  if (error instanceof Error) {
    const code = 'code' in error ? String(error.code) : ''
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Intenta de nuevo; abriremos Google directamente.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
      'permission-denied': 'No tienes permiso para realizar esta acción.',
      'functions/unauthenticated': 'Inicia sesión para continuar.',
      'functions/failed-precondition': 'La invitación o la sala ya no está disponible.',
    }
    return messages[code] || error.message || 'Algo salió mal. Inténtalo de nuevo.'
  }
  return 'Algo salió mal. Inténtalo de nuevo.'
}
