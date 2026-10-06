import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  getAcademyMembershipContext,
  getMembershipErrorMessage,
} from './academy-membership-service'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'

interface AcademyMembershipPanelProps {
  userId: string
  onSelect: (membership: AcademyMembershipContext) => void
}

type QueryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success'
      academyId: string
      membership: AcademyMembershipContext | null
    }

const roleLabels = {
  gym_admin: 'Gestor',
  professor: 'Professor',
  aluno: 'Aluno',
}

const statusLabels = {
  pending: 'Pendente',
  active: 'Ativo',
  suspended: 'Suspenso',
  ended: 'Encerrado',
}

function AcademyMembershipPanel({
  userId,
  onSelect,
}: AcademyMembershipPanelProps) {
  const [academyId, setAcademyId] = useState('')
  const [state, setState] = useState<QueryState>({ status: 'idle' })

  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  useEffect(() => {
    return () => {
      requestVersion.current += 1
    }
  }, [])

  async function runQuery(
    requestedAcademyId: string,
    selectAfterQuery: boolean,
  ) {
    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setState({ status: 'loading' })

    try {
      const membership = await getAcademyMembershipContext(
        requestedAcademyId,
        userId,
      )

      if (version !== requestVersion.current) {
        return
      }

      if (
        selectAfterQuery &&
        membership &&
        membership.status === 'active'
      ) {
        onSelect(membership)
        return
      }

      setState({
        status: 'success',
        academyId: requestedAcademyId,
        membership,
      })
    } catch (error) {
      if (version === requestVersion.current) {
        setState({
          status: 'error',
          message: getMembershipErrorMessage(error),
        })
      }
    } finally {
      requestRunning.current = false
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runQuery(academyId.trim(), false)
  }

  const busy = state.status === 'loading'
  const result = state.status === 'success' ? state : null

  return (
    <section className="membership-panel" aria-labelledby="membership-title">
      <h2 id="membership-title">Selecionar academia</h2>

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        aria-busy={busy}
      >
        <label htmlFor="membership-academy-id">
          Identificador da academia
        </label>

        <input
          id="membership-academy-id"
          name="academyId"
          type="text"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          value={academyId}
          onChange={(event) => {
            setAcademyId(event.target.value)
            setState({ status: 'idle' })
          }}
        />

        <button
          className="auth-button"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Consultando...' : 'Consultar vínculo'}
        </button>
      </form>

      <div aria-live="polite">
        {busy && <p>Consultando o backend DEV...</p>}

        {state.status === 'error' && (
          <p className="auth-error" role="alert">
            {state.message}
          </p>
        )}

        {result && (
          <>
            <p>
              Academia consultada: <strong>{result.academyId}</strong>
            </p>

            {result.membership === null ? (
              <p>Esta conta não possui vínculo com a academia informada.</p>
            ) : (
              <>
                <dl className="dev-settings">
                  <div>
                    <dt>Estado</dt>
                    <dd>{statusLabels[result.membership.status]}</dd>
                  </div>

                  <div>
                    <dt>Papéis</dt>
                    <dd>
                      {result.membership.roles
                        .map((role) => roleLabels[role])
                        .join(', ')}
                    </dd>
                  </div>

                  <div>
                    <dt>Permissão administrativa</dt>
                    <dd>
                      {result.membership.canManage
                        ? 'Permitida'
                        : 'Não permitida'}
                    </dd>
                  </div>
                </dl>

                {result.membership.status === 'active' ? (
                  <button
                    className="auth-button"
                    type="button"
                    onClick={() => runQuery(result.academyId, true)}
                  >
                    Usar esta academia
                  </button>
                ) : (
                  <p>Somente vínculos ativos podem ser selecionados.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default AcademyMembershipPanel