import { useEffect, useRef, useState } from 'react'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import type {
  AcademyProfessorLicense,
  AcademyProfessorLicensePage,
} from './academy-professor-license-result'
import {
  createAcademyProfessorLicenseQueryService,
} from './academy-professor-license-query-service'
import {
  createAcademyProfessorLicenseCommandService,
} from './academy-professor-license-command-service'

interface Props {
  membership: AcademyMembershipContext
}

function getErrorMessage(error: unknown): string {
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
      return 'Seu vínculo atual não permite administrar esta academia.'

    case 'ACADEMY_CONTEXT_CHANGED':
      return 'A academia selecionada mudou. Consulte novamente.'

    case 'functions/resource-exhausted':
      return 'Todas as licenças contratadas estão em uso.'

    case 'INVALID_PROFESSOR_EMAIL':
      return 'Informe um e-mail válido para o professor.'

    case 'functions/not-found':
      return 'Academia não encontrada.'

    case 'functions/failed-precondition':
    case 'INVALID_LICENSE_MUTATION_RESPONSE':
    case 'INVALID_PROFESSOR_LICENSE_RESPONSE':
    case 'PROFESSOR_LICENSE_CONTEXT_MISMATCH':
      return 'A operação está indisponível ou os dados precisam de revisão.'

    default:
      return 'Não foi possível concluir a operação.'
  }
}

function AcademyProfessorLicensesPanel({ membership }: Props) {
  const [context, setContext] = useState(membership)
  const [page, setPage] = useState<AcademyProfessorLicensePage | null>(null)
  const [licenses, setLicenses] =
    useState<readonly AcademyProfessorLicense[]>([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'list' | 'grant' | 'revoke' | null>(null)
  const [confirmationId, setConfirmationId] = useState<string | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  if (context !== membership) {
    setContext(membership)
    setPage(null)
    setLicenses([])
    setEmail('')
    setBusy(null)
    setConfirmationId(null)
    setNeedsRefresh(true)
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

  async function loadLicenses(loadMore: boolean) {
    if (
      requestRunning.current ||
      (loadMore && (!page || page.nextCursor === null || needsRefresh))
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current
    const cursor = loadMore ? page?.nextCursor ?? null : null

    setBusy('list')
    setConfirmationId(null)
    setMessage(null)
    setErrorMessage(null)

    if (!loadMore) {
      setPage(null)
      setLicenses([])
      setNeedsRefresh(true)
    }

    try {
      const list = createAcademyProfessorLicenseQueryService(
        () => currentAcademy.current,
      )

      const result = await list(
        membership.academyId,
        membership.userId,
        cursor,
      )

      if (version !== requestVersion.current) return

      setLicenses((previous) => (
        loadMore ? [...previous, ...result.licenses] : result.licenses
      ))
      setPage(result)
      setNeedsRefresh(false)
    } catch (error) {
      if (version === requestVersion.current) {
        setPage(null)
        setLicenses([])
        setNeedsRefresh(true)
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  async function mutate(
    operation: 'grant' | 'revoke',
    license?: AcademyProfessorLicense,
  ) {
    if (
      requestRunning.current ||
      needsRefresh ||
      !page ||
      (
        operation === 'revoke' &&
        (!license || confirmationId !== license.licenseId)
      )
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setBusy(operation)
    setConfirmationId(null)
    setNeedsRefresh(true)
    setMessage(null)
    setErrorMessage(null)

    let confirmed = false

    try {
      const commands = createAcademyProfessorLicenseCommandService(
        () => currentAcademy.current,
      )

      if (operation === 'grant') {
        const result = await commands.grantLicense(
          membership.academyId,
          membership.userId,
          email,
        )

        if (version !== requestVersion.current) return

        setEmail('')
        setMessage(result.alreadyProcessed
          ? 'Este e-mail já possui uma licença nesta academia.'
          : 'Licença cadastrada para o professor.')
      } else if (license) {
        const result = await commands.revokeLicense(
          membership.academyId,
          membership.userId,
          license.licenseId,
        )

        if (version !== requestVersion.current) return

        setMessage(result.alreadyProcessed
          ? 'A licença já havia sido removida.'
          : 'Licença removida.')
      }

      confirmed = true
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(
          `${getErrorMessage(error)} Consulte a lista atualizada antes de tentar novamente.`,
        )
      }
    }

    if (version !== requestVersion.current) return

    try {
      const list = createAcademyProfessorLicenseQueryService(
        () => currentAcademy.current,
      )

      const result = await list(
        membership.academyId,
        membership.userId,
      )

      if (version !== requestVersion.current) return

      setPage(result)
      setLicenses(result.licenses)
      setNeedsRefresh(false)
    } catch {
      if (version === requestVersion.current) {
        setPage(null)
        setLicenses([])
        setErrorMessage(confirmed
          ? 'A alteração foi confirmada, mas a lista não pôde ser atualizada. Clique em Atualizar licenças.'
          : 'Não foi possível confirmar a alteração nem atualizar a lista. Clique em Atualizar licenças antes de continuar.')
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  const actionsDisabled = busy !== null || needsRefresh || !page

  return (
    <section
      aria-labelledby="professor-licenses-title"
      aria-busy={busy !== null}
    >
      <h3 id="professor-licenses-title">Professores e licenças</h3>

      <p>
        Cadastre uma licença pelo e-mail do professor e acompanhe
        a capacidade disponível da academia.
      </p>

      <button
        className="auth-button"
        type="button"
        disabled={busy !== null}
        onClick={() => loadLicenses(false)}
      >
        {busy === 'list' ? 'Consultando...' : 'Atualizar licenças'}
      </button>

      {!page && busy === null && !errorMessage && (
        <p>Atualize as licenças para consultar a lista e liberar as ações.</p>
      )}

      {busy !== null && (
        <p role="status">
          {busy === 'list'
            ? 'Consultando as licenças...'
            : 'Processando a alteração e atualizando a lista...'}
        </p>
      )}

      {message && <p role="status">{message}</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">{errorMessage}</p>
      )}

      {page && (
        <dl className="dev-settings">
          <div>
            <dt>Licenças contratadas</dt>
            <dd>{page.licensesTotal}</dd>
          </div>
          <div>
            <dt>Licenças em uso</dt>
            <dd>{page.licensesUsed}</dd>
          </div>
          <div>
            <dt>Licenças disponíveis</dt>
            <dd>{page.licensesAvailable}</dd>
          </div>
        </dl>
      )}

      <form onSubmit={(event) => {
        event.preventDefault()
        void mutate('grant')
      }}>
        <label htmlFor="professor-license-email">
          E-mail do professor
        </label>

        <input
          id="professor-license-email"
          type="email"
          autoComplete="off"
          maxLength={254}
          required
          value={email}
          disabled={actionsDisabled}
          onChange={(event) => setEmail(event.target.value)}
        />

        <button
          className="auth-button"
          type="submit"
          disabled={actionsDisabled || email.trim() === ''}
        >
          Conceder licença
        </button>
      </form>

      {page?.licensesAvailable === 0 && (
        <p>
          Não há capacidade disponível para cadastrar uma nova licença.
          Um e-mail já cadastrado não consome outra licença.
        </p>
      )}

      {page && licenses.length === 0 && (
        <p>Nenhum professor possui licença cadastrada nesta academia.</p>
      )}

      {licenses.length > 0 && (
        <>
          <p>{licenses.length} licença(s) carregada(s).</p>

          <ul>
            {licenses.map((license) => (
              <li key={license.licenseId}>
                <article>
                  <h4>{license.email}</h4>
                  <p>Estado: <strong>{license.status}</strong></p>

                  {confirmationId === license.licenseId ? (
                    <>
                      <p>
                        Confirma a remoção da licença de {license.email}?
                        A conta do professor será preservada.
                      </p>

                      <div className="academy-actions">
                        <button
                          className="auth-button"
                          type="button"
                          disabled={actionsDisabled}
                          onClick={() => mutate('revoke', license)}
                        >
                          Confirmar remoção
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
                      disabled={actionsDisabled}
                      onClick={() => setConfirmationId(license.licenseId)}
                    >
                      Remover licença
                    </button>
                  )}
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {page?.nextCursor && !needsRefresh && (
        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy !== null}
          onClick={() => loadLicenses(true)}
        >
          Carregar mais
        </button>
      )}
    </section>
  )
}

export default AcademyProfessorLicensesPanel