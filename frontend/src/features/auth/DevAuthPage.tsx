import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Auth, User } from 'firebase/auth'

import AcademySession from '../academies/AcademySession'
import AcademyRegistrationPage from '../academies/AcademyRegistrationPage'

import {
  getAuthErrorMessage,
  login,
  logout,
  observeSession,
  resetPassword,
} from './auth-service'

interface DevAuthPageProps {
  auth: Auth
}

type AuthOperation = 'login' | 'logout' | 'reset'

function DevAuthPage({ auth }: DevAuthPageProps) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [operation, setOperation] = useState<AuthOperation | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const operationRunning = useRef(false)
  const busy = operation !== null

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

  function openRegistration() {
    if (operationRunning.current) {
      return
    }

    setErrorMessage(null)
    setMessage(null)
    setPassword('')
    setShowPassword(false)
    setShowRegistration(true)
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (operationRunning.current) {
      return
    }

    operationRunning.current = true
    setOperation('login')
    setErrorMessage(null)
    setMessage(null)

    try {
      await login(auth, email, password)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setPassword('')
      setShowPassword(false)
      setOperation(null)
      operationRunning.current = false
    }
  }

  async function handleLogout() {
    if (operationRunning.current) {
      return
    }

    operationRunning.current = true
    setOperation('logout')
    setErrorMessage(null)
    setMessage(null)

    try {
      await logout(auth)
      setEmail('')
      setPassword('')
      setShowPassword(false)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setOperation(null)
      operationRunning.current = false
    }
  }

  async function handleResetPassword() {
    if (operationRunning.current) {
      return
    }

    if (email.trim() === '') {
      setMessage(null)
      setErrorMessage(
        'Informe seu e-mail no campo acima para recuperar a senha.',
      )
      return
    }

    operationRunning.current = true
    setOperation('reset')
    setErrorMessage(null)
    setMessage(null)

    try {
      await resetPassword(auth, email)

      setMessage(
        'Se houver uma conta para este e-mail, você receberá as instruções de redefinição.',
      )
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setOperation(null)
      operationRunning.current = false
    }
  }

  if (sessionReady && showRegistration) {
    return (
      <AcademyRegistrationPage
        initialEmail={user?.email ?? email}
        onBack={() => setShowRegistration(false)}
        onComplete={() => {
          setUser(auth.currentUser)
          setShowRegistration(false)
          setMessage('Academia cadastrada e acesso do gestor preparado.')
          setErrorMessage(null)
        }}
      />
    )
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

            <AcademySession
              key={user.uid}
              userId={user.uid}
            />

            <button
              className="auth-button auth-button-secondary"
              type="button"
              disabled={busy}
              onClick={openRegistration}
            >
              Retomar cadastro de academia
            </button>

            <button
              className="auth-button"
              type="button"
              disabled={busy}
              onClick={handleLogout}
            >
              {operation === 'logout' ? 'Saindo...' : 'Sair da conta'}
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
                onChange={(event) => {
                  setEmail(event.target.value)
                  setMessage(null)
                  setErrorMessage(null)
                }}
              />

              <label htmlFor="login-password">Senha</label>

              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                className="auth-button auth-button-secondary"
                type="button"
                disabled={busy}
                aria-controls="login-password"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              </button>

              <button
                className="auth-button"
                type="submit"
                disabled={busy}
              >
                {operation === 'login' ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                className="auth-button auth-button-secondary"
                type="button"
                disabled={busy}
                onClick={handleResetPassword}
              >
                {operation === 'reset'
                  ? 'Solicitando redefinição...'
                  : 'Esqueci minha senha'}
              </button>

              <button
                className="auth-button auth-button-secondary"
                type="button"
                disabled={busy}
                onClick={openRegistration}
              >
                Cadastrar academia
              </button>
            </form>
          </>
        )}

        {message && <p role="status">{message}</p>}

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