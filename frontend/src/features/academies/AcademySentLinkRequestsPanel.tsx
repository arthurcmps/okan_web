import { useEffect, useRef, useState } from 'react'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import type {
  AcademySentLinkRequest,
  AcademySentLinkRequestStatus,
} from './academy-sent-link-request-result'
import {
  createAcademySentLinkRequestService,
} from './academy-sent-link-request-service'
import {
  createAcademyLinkCancelService,
} from './academy-link-cancel-service'

interface AcademySentLinkRequestsPanelProps {
  membership: AcademyMembershipContext
}

const statusLabels: Record<AcademySentLinkRequestStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)

  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : dateFormatter.format(date)
}

function getQueryErrorMessage(error: unknown): string {
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
    case 'functions/unauthenticated':
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_CHANGED':
      return 'Sua sessão mudou. Entre novamente antes de continuar.'

    case 'functions/permission-denied':
    case 'ACADEMY_MANAGEMENT_FORBIDDEN':
      return 'Seu vínculo atual não permite consultar esta academia.'

    case 'ACADEMY_CONTEXT_CHANGED':
      return 'A academia selecionada mudou. Faça uma nova consulta.'

    case 'functions/failed-precondition':
      return 'A consulta está indisponível neste ambiente ou precisa de revisão.'

    default:
      return 'Não foi possível atualizar as solicitações. Tente novamente.'
  }
}

function AcademySentLinkRequestsPanel({
  membership,
}: AcademySentLinkRequestsPanelProps) {
  const [context, setContext] = useState(membership)
  const [requests, setRequests] =
    useState<readonly AcademySentLinkRequest[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<'list' | 'cancel' | null>(null)
  const [confirmationId, setConfirmationId] = useState<string | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  if (context !== membership) {
    setContext(membership)
    setRequests([])
    setNextCursor(null)
    setLoaded(false)
    setBusy(null)
    setConfirmationId(null)
    setNeedsRefresh(false)
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

  async function loadRequests(loadMore: boolean) {
    if (
      requestRunning.current ||
      (loadMore && (nextCursor === null || needsRefresh))
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current
    const cursor = loadMore ? nextCursor : null

    setBusy('list')
    setConfirmationId(null)
    setMessage(null)
    setErrorMessage(null)

    if (!loadMore) {
      setRequests([])
      setNextCursor(null)
      setLoaded(false)
    }

    try {
      const listSentRequests = createAcademySentLinkRequestService(
        () => currentAcademy.current,
      )

      const page = await listSentRequests(
        membership.academyId,
        membership.userId,
        cursor,
      )

      if (version !== requestVersion.current) {
        return
      }

      setRequests((previous) => (
        loadMore
          ? [...previous, ...page.requests]
          : page.requests
      ))

      setNextCursor(page.nextCursor)
      setLoaded(true)
      setNeedsRefresh(false)
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(getQueryErrorMessage(error))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  async function handleCancel(request: AcademySentLinkRequest) {
    if (
      requestRunning.current ||
      needsRefresh ||
      request.status !== 'pending' ||
      confirmationId !== request.requestId
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setBusy('cancel')
    setConfirmationId(null)
    setNeedsRefresh(true)
    setMessage(null)
    setErrorMessage(null)

    let cancellationConfirmed = false

    try {
      const cancelRequest = createAcademyLinkCancelService(
        () => currentAcademy.current,
      )

      await cancelRequest(
        membership.academyId,
        membership.userId,
        request.requestId,
      )

      cancellationConfirmed = true
    } catch {
      if (version === requestVersion.current) {
        setErrorMessage(
          'Não foi possível confirmar o cancelamento. Consulte o estado atualizado abaixo antes de tentar novamente.',
        )
      }
    }

    if (version !== requestVersion.current) {
      return
    }

    try {
      const listSentRequests = createAcademySentLinkRequestService(
        () => currentAcademy.current,
      )

      const page = await listSentRequests(
        membership.academyId,
        membership.userId,
      )

      if (version !== requestVersion.current) {
        return
      }

      setRequests(page.requests)
      setNextCursor(page.nextCursor)
      setLoaded(true)
      setNeedsRefresh(false)

      if (cancellationConfirmed) {
        setMessage('Solicitação cancelada. A lista foi atualizada.')
      }
    } catch {
      if (version === requestVersion.current) {
        setErrorMessage(
          cancellationConfirmed
            ? 'O cancelamento foi confirmado, mas a lista não pôde ser atualizada. Clique em Atualizar solicitações.'
            : 'Não foi possível confirmar o cancelamento nem atualizar a lista. Clique em Atualizar solicitações antes de tentar novamente.',
        )
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  return (
    <section aria-labelledby="sent-link-requests-title">
      <h3 id="sent-link-requests-title">
        Solicitações enviadas por você
      </h3>

      <p>
        Acompanhe as solicitações que você enviou nesta academia.
        As pendentes podem ser canceladas antes do vencimento.
      </p>

      <button
        className="auth-button"
        type="button"
        disabled={busy !== null}
        onClick={() => loadRequests(false)}
      >
        {busy === 'list' ? 'Consultando...' : 'Atualizar solicitações'}
      </button>

      {!loaded && busy === null && !errorMessage && (
        <p>Clique em Atualizar solicitações para consultar a lista.</p>
      )}

      {message && <p role="status">{message}</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">
          {errorMessage}
        </p>
      )}

      {busy === 'cancel' && (
        <p role="status">Processando cancelamento e atualizando a lista...</p>
      )}

      {needsRefresh && busy === null && (
        <p>
          Atualize a lista para consultar o estado atual e liberar as ações.
        </p>
      )}

      {loaded && requests.length === 0 && (
        <p>Você ainda não enviou solicitações nesta academia.</p>
      )}

      <ul>
        {requests.map((request) => (
          <li key={request.requestId}>
            <article>
              <h4>
                Solicitação de {formatDate(request.createdAtMs)}
              </h4>

              <p>
                Estado: <strong>{statusLabels[request.status]}</strong>
              </p>

              <p>Validade: {formatDate(request.expiresAtMs)}</p>

              {request.respondedAtMs !== null && (
                <p>
                  Finalizada em: {formatDate(request.respondedAtMs)}
                </p>
              )}

              {request.status === 'pending' && (
                <div>
                  {confirmationId === request.requestId ? (
                    <>
                      <p>
                        Confirma o cancelamento desta solicitação?
                        O aluno não poderá aceitá-la depois.
                      </p>

                      <div className="academy-actions">
                        <button
                          className="auth-button"
                          type="button"
                          disabled={busy !== null || needsRefresh}
                          onClick={() => handleCancel(request)}
                        >
                          Confirmar cancelamento
                        </button>

                        <button
                          className="auth-button auth-button-secondary"
                          type="button"
                          disabled={busy !== null}
                          onClick={() => setConfirmationId(null)}
                        >
                          Voltar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="auth-button auth-button-secondary"
                      type="button"
                      disabled={busy !== null || needsRefresh}
                      onClick={() => setConfirmationId(request.requestId)}
                    >
                      Cancelar solicitação
                    </button>
                  )}
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>

      {nextCursor !== null && !needsRefresh && (
        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy !== null}
          onClick={() => loadRequests(true)}
        >
          Carregar mais
        </button>
      )}
    </section>
  )
}

export default AcademySentLinkRequestsPanel