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

interface AcademyProfessorLicensesPanelProps {
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
      return 'Seu vínculo atual não permite consultar esta academia.'

    case 'ACADEMY_CONTEXT_CHANGED':
      return 'A academia selecionada mudou. Consulte novamente.'

    case 'functions/not-found':
      return 'Academia não encontrada.'

    case 'functions/failed-precondition':
    case 'INVALID_PROFESSOR_LICENSE_RESPONSE':
    case 'PROFESSOR_LICENSE_CONTEXT_MISMATCH':
      return 'A consulta está indisponível ou os dados precisam de revisão.'

    default:
      return 'Não foi possível consultar as licenças. Tente novamente.'
  }
}

function AcademyProfessorLicensesPanel({
  membership,
}: AcademyProfessorLicensesPanelProps) {
  const [context, setContext] = useState(membership)
  const [page, setPage] = useState<AcademyProfessorLicensePage | null>(null)
  const [licenses, setLicenses] =
    useState<readonly AcademyProfessorLicense[]>([])
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  if (context !== membership) {
    setContext(membership)
    setPage(null)
    setLicenses([])
    setBusy(false)
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
      (loadMore && (!page || page.nextCursor === null))
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current
    const cursor = loadMore ? page?.nextCursor ?? null : null

    setBusy(true)
    setErrorMessage(null)

    if (!loadMore) {
      setPage(null)
      setLicenses([])
    }

    try {
      const listLicenses = createAcademyProfessorLicenseQueryService(
        () => currentAcademy.current,
      )

      const result = await listLicenses(
        membership.academyId,
        membership.userId,
        cursor,
      )

      if (version !== requestVersion.current) {
        return
      }

      setLicenses((previous) => (
        loadMore
          ? [...previous, ...result.licenses]
          : result.licenses
      ))
      setPage(result)
    } catch (error) {
      if (version === requestVersion.current) {
        setPage(null)
        setLicenses([])
        setErrorMessage(getErrorMessage(error))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(false)
      }
    }
  }

  return (
    <section aria-labelledby="professor-licenses-title" aria-busy={busy}>
      <h3 id="professor-licenses-title">Professores e licenças</h3>

      <p>
        Consulte as licenças cadastradas para os professores desta academia.
      </p>

      <button
        className="auth-button"
        type="button"
        disabled={busy}
        onClick={() => loadLicenses(false)}
      >
        {busy ? 'Consultando...' : 'Atualizar licenças'}
      </button>

      {!page && !busy && !errorMessage && (
        <p>Clique em Atualizar licenças para consultar a lista.</p>
      )}

      {busy && <p role="status">Consultando as licenças...</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">
          {errorMessage}
        </p>
      )}

      {page && (
        <>
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

          {licenses.length === 0 ? (
            <p>Nenhum professor possui licença cadastrada nesta academia.</p>
          ) : (
            <>
              <p>{licenses.length} licença(s) carregada(s).</p>

              <ul>
                {licenses.map((license) => (
                  <li key={license.licenseId}>
                    <article>
                      <h4>{license.email}</h4>
                      <p>
                        Estado: <strong>{license.status}</strong>
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}

          {page.nextCursor !== null && (
            <button
              className="auth-button auth-button-secondary"
              type="button"
              disabled={busy}
              onClick={() => loadLicenses(true)}
            >
              Carregar mais
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default AcademyProfessorLicensesPanel