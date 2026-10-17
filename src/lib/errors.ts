export function readableError(error: unknown): string {
  if (error instanceof Error) {
    const code = 'code' in error ? String(error.code) : ''
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
      'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Intenta de nuevo; abriremos Google directamente.',
      'auth/unauthorized-domain': 'El dominio de esta página no está autorizado. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.',
      'auth/operation-not-allowed': 'Este método de acceso no está habilitado en Firebase Authentication.',
      'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.',
      'auth/web-storage-unsupported': 'El navegador no permite el almacenamiento requerido para iniciar sesión. Prueba en el navegador principal del teléfono.',
      'auth/operation-not-supported-in-this-environment': 'Este navegador no admite el inicio de sesión. Abre CineJuntos en Safari o Chrome.',
      'auth/invalid-api-key': 'La clave de Firebase no es válida para este proyecto.',
      'auth/too-many-requests': 'Hubo demasiados intentos. Espera un momento e inténtalo de nuevo.',
      'firestore/permission-denied': 'Google inició sesión, pero Firestore no permitió guardar el perfil. Publica las reglas con firebase deploy --only firestore:rules.',
      'permission-denied': 'No tienes permiso para realizar esta acción.',
      'functions/unauthenticated': 'Inicia sesión para continuar.',
      'functions/failed-precondition': 'La invitación o la sala ya no está disponible.',
    }
    return messages[code] || error.message || 'Algo salió mal. Inténtalo de nuevo.'
  }
  return 'Algo salió mal. Inténtalo de nuevo.'
}
