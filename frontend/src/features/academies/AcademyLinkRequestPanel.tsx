import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import type {
  AcademyIdentityLookupTicket,
} from './academy-identity-lookup-result'
import {
  createAcademyIdentityLookupService,
} from './academy-identity-lookup-service'
import {
  createAcademyLinkRequestService,
} from './academy-link-request-service'

interface AcademyLinkRequestPanelProps {
  membership: AcademyMembershipContext
}

function getErrorMessage(error: unknown, sending: boolean): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.message
        : ''

  switch (code) {
    case 'INVALID_ACADEMY_LOOKUP_EMAIL':
      return 'Informe um e-mail válido.'

    case 'IDENTITY_LOOKUP_TICKET_EXPIRED':
      return 'A confirmação expirou. Busque o e-mail novamente.'

    case 'functions/unauthenticated':
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_CHANGED':
      return 'Sua sessão mudou. Entre novamente antes de continuar.'

    case 'ACADEMY_CONTEXT_CHANGED':
      return 'A academia selecionada mudou. Faça uma nova busca.'

    case 'ACADEMY_MANAGEMENT_FORBIDDEN':
    case 'functions/permission-denied':
      return 'Seu vínculo atual não permite realizar esta operação.'

    case 'functions/resource-exhausted':
      return 'O limite de buscas foi atingido. Aguarde antes de tentar novamente.'

    case 'functions/already-exists':
      return 'Já existe um vínculo ou uma solicitação pendente para esta conta.'

    case 'functions/failed-precondition':
      return sending
        ? 'Não foi possível enviar. Confira se já existe uma solicitação ou vínculo.'
        : 'A busca está indisponível neste momento.'

    default:
      return sending
        ? 'Não foi possível confirmar o envio. A solicitação pode ter sido registrada. Confira com o aluno antes de tentar novamente.'
        : 'Não foi possível concluir a busca. Confira o e-mail e tente novamente.'
  }
}

function AcademyLinkRequestPanel({
  membership,
}: AcademyLinkRequestPanelProps) {
  const [context, setContext] = useState(membership)
  const [email, setEmail] = useState('')
  const [ticket, setTicket] =
    useState<AcademyIdentityLookupTicket | null>(null)
  const [busy, setBusy] = useState<'lookup' | 'send' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  // Descarta os dados do formulário quando o contexto muda.
  if (context !== membership) {
    setContext(membership)
    setEmail('')
    setTicket(null)
    setBusy(null)
    setMessage(null)
    setErrorMessage(null)
  }

  useEffect(() => {
    currentAcademy.current = membership
    requestRunning.current = false

    return () => {
      currentAcademy.current = null
      requestVersion.current += 1
    }
  }, [membership])

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setBusy('lookup')
    setTicket(null)
    setMessage(null)
    setErrorMessage(null)

    try {
      const lookupAccount = createAcademyIdentityLookupService(
        () => currentAcademy.current,
      )

      const result = await lookupAccount(
        membership.academyId,
        membership.userId,
        email,
      )

      if (version !== requestVersion.current) {
        return
      }

      setTicket(result)

      setMessage(
        result === null
          ? 'Nenhuma conta elegível foi encontrada para este e-mail.'
          : 'Conta localizada. Confira o e-mail antes de enviar a solicitação.',
      )
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(getErrorMessage(error, false))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  async function handleSend() {
    if (requestRunning.current || ticket === null) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current
    const selectedTicket = ticket

    setBusy('send')
    setTicket(null)
    setMessage(null)
    setErrorMessage(null)

    try {
      const requestLink = createAcademyLinkRequestService(
        () => currentAcademy.current,
      )

      await requestLink(
        membership.academyId,
        membership.userId,
        selectedTicket,
      )

      if (version !== requestVersion.current) {
        return
      }

      setEmail('')
      setMessage(
        'Solicitação enviada. O aluno deve aceitar ou recusar no aplicativo. O vínculo será criado somente após o aceite.',
      )
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(getErrorMessage(error, true))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value)
    setTicket(null)
    setMessage(null)
    setErrorMessage(null)
  }

  return (
    <section aria-labelledby="academy-link-request-title">
      <h3 id="academy-link-request-title">
        Solicitar vínculo de aluno
      </h3>

      <p>
        Busque o e-mail da conta utilizada pelo aluno no Okan.
        Ele receberá a solicitação no aplicativo e decidirá se aceita.
      </p>

      <form onSubmit={handleLookup}>
        <label htmlFor="academy-link-request-email">
          E-mail do aluno
        </label>

        <input
          id="academy-link-request-email"
          name="studentEmail"
          type="email"
          autoComplete="off"
          maxLength={254}
          required
          disabled={busy !== null}
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
        />

        <div className="academy-actions">
          <button
            className="auth-button"
            type="submit"
            disabled={busy !== null || email.trim() === ''}
          >
            {busy === 'lookup' ? 'Buscando...' : 'Buscar conta'}
          </button>
        </div>
      </form>

      {message && <p role="status">{message}</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">
          {errorMessage}
        </p>
      )}

      {ticket && (
        <div>
          <p>
            Enviar solicitação para <strong>{email.trim()}</strong>?
          </p>

          <p>A solicitação terá validade de sete dias.</p>

          <button
            className="auth-button"
            type="button"
            disabled={busy !== null}
            onClick={handleSend}
          >
            Confirmar envio da solicitação
          </button>
        </div>
      )}

      {busy === 'send' && (
        <p role="status">Enviando solicitação...</p>
      )}
    </section>
  )
}

export default AcademyLinkRequestPanel