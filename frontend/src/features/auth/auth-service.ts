import { FirebaseError } from 'firebase/app'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import type { Auth, User } from 'firebase/auth'

export function observeSession(
  auth: Auth,
  onChange: (user: User | null) => void,
  onError: (error: Error) => void,
) {
  return onAuthStateChanged(auth, onChange, onError)
}

export async function login(
  auth: Auth,
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  )
}

export async function logout(auth: Auth): Promise<void> {
  await signOut(auth)
}

export async function resetPassword(
  auth: Auth,
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim()

  if (normalizedEmail === '') {
    throw new FirebaseError(
      'auth/invalid-email',
      'Informe um e-mail válido.',
    )
  }

  try {
    await sendPasswordResetEmail(auth, normalizedEmail)
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      error.code === 'auth/user-not-found'
    ) {
      return
    }

    throw error
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Não foi possível concluir a operação. Tente novamente.'
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return 'Informe um email válido.'

    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email ou senha incorretos.'

    case 'auth/user-disabled':
      return 'Esta conta está desativada.'

    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde antes de tentar novamente.'

    case 'auth/network-request-failed':
      return 'Não foi possível acessar o Authentication Emulator. Confira se o backend DEV está funcionando.'

    default:
      return 'Não foi possível concluir a autenticação. Tente novamente.'
  }
}