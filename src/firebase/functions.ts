import { getFunctions } from 'firebase/functions'
import { firebaseApp } from '../firebase'

export const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
