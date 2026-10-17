import { getDatabase } from 'firebase/database'
import { firebaseApp } from '../firebase'

const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://cinejuntos-default-rtdb.firebaseio.com'
export const rtdb = getDatabase(firebaseApp, databaseURL)
