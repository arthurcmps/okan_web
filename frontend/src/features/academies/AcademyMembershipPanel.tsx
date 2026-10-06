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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current
    const requestedAcademyId = academyId.trim()

    setState({ status: 'loading' })

    try {
      const membership = await getAcademyMembershipContext(
        requestedAcademyId,
        userId,
      )

      if (version === requestVersion.current) {
        setState({
          status: 'success',
          academyId: requestedAcademyId,
          membership,
        })
      }
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

  const busy = state.status === 'loading'

  return (
    <section className="membership-panel" aria-labelledby="membership-title">
      <h2 id="membership-title">Vínculo com a academia</h2>

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
        {state.status === 'loading' && (
          <p>Consultando o backend DEV...</p>
        )}

        {state.status === 'error' && (
          <p className="auth-error" role="alert">
            {state.message}
          </p>
        )}

        {state.status === 'success' && (
          <>
            <p>
              Academia consultada: <strong>{state.academyId}</strong>
            </p>

            {state.membership === null ? (
              <p>Esta conta não possui vínculo com a academia informada.</p>
            ) : (
              <dl className="dev-settings">
                <div>
                  <dt>Estado</dt>
                  <dd>{statusLabels[state.membership.status]}</dd>
                </div>

                <div>
                  <dt>Papéis</dt>
                  <dd>
                    {state.membership.roles
                      .map((role) => roleLabels[role])
                      .join(', ')}
                  </dd>
                </div>

                <div>
                  <dt>Permissão administrativa</dt>
                  <dd>
                    {state.membership.canManage
                      ? 'Permitida'
                      : 'Não permitida'}
                  </dd>
                </div>
              </dl>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default AcademyMembershipPanel