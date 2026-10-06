import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Auth, User } from 'firebase/auth'
import AcademyMembershipPanel from '../academies/AcademyMembershipPanel'

import {
  getAuthErrorMessage,
  login,
  logout,
  observeSession,
} from './auth-service'

interface DevAuthPageProps {
  auth: Auth
}

function DevAuthPage({ auth }: DevAuthPageProps) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const operationRunning = useRef(false)

  useEffect(() => {
    return observeSession(
      auth,
      (currentUser) => {
        setUser(currentUser)
        setSessionReady(true)
      },
      (error) => {
        setErrorMessage(getAuthErrorMessage(error))
        setSessionReady(true)
      },
    )
  }, [auth])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (operationRunning.current) {
      return
    }

    operationRunning.current = true
    setBusy(true)
    setErrorMessage(null)

    try {
      await login(auth, email, password)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setPassword('')
      setBusy(false)
      operationRunning.current = false
    }
  }

  async function handleLogout() {
    if (operationRunning.current) {
      return
    }

    operationRunning.current = true
    setBusy(true)
    setErrorMessage(null)

    try {
      await logout(auth)
      setEmail('')
      setPassword('')
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setBusy(false)
      operationRunning.current = false
    }
  }

  return (
    <main className="dev-page">
      <section className="dev-panel">
        <p className="dev-label">OKAN · DEV local</p>

        {!sessionReady ? (
          <p role="status">Verificando sessão...</p>
        ) : user ? (
          <>
            <h1>Sessão autenticada</h1>

            <dl className="dev-settings">
              <div>
                <dt>Email</dt>
                <dd>{user.email ?? 'Não informado'}</dd>
              </div>

              <div>
                <dt>UID</dt>
                <dd>{user.uid}</dd>
              </div>
            </dl>

            <AcademyMembershipPanel
              key={user.uid}
              userId={user.uid}
            />

            <button
              className="auth-button"
              type="button"
              disabled={busy}
              onClick={handleLogout}
            >
              {busy ? 'Saindo...' : 'Sair da conta'}
            </button>
          </>
        ) : (
          <>
            <h1>Entrar no DEV</h1>

            <p>Use uma conta do Authentication Emulator.</p>

            <form
              className="auth-form"
              onSubmit={handleLogin}
              aria-busy={busy}
            >
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                className="auth-button"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </>
        )}

        {errorMessage && (
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  )
}

export default DevAuthPage