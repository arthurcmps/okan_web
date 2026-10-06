import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getAcademyMembershipContext,
  getMembershipErrorMessage,
} from './academy-membership-service'
import {
  listMyAcademyMemberships,
} from './academy-membership-list-service'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'

import type {
  AcademyMembershipListItem,
} from './academy-membership-list'

interface AcademyMembershipPanelProps {
  userId: string
  onSelect: (membership: AcademyMembershipContext) => void
}

interface ListState {
  memberships: readonly AcademyMembershipListItem[]
  nextCursor: string | null
  loaded: boolean
  loading: boolean
  selectingId: string | null
  error: string | null
  notice: string | null
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
  const [state, setState] = useState<ListState>({
    memberships: [],
    nextCursor: null,
    loaded: false,
    loading: true,
    selectingId: null,
    error: null,
    notice: null,
  })

  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  const fetchPage = useCallback(async (
    cursor: string | null,
    previousMemberships: readonly AcademyMembershipListItem[],
  ) => {
    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    try {
      const page = await listMyAcademyMemberships(userId, cursor)

      if (version !== requestVersion.current) {
        return
      }

      const membershipIds = new Set(
        previousMemberships.map((membership) => membership.membershipId),
      )

      const academyIds = new Set(
        previousMemberships.map((membership) => membership.academyId),
      )

      for (const membership of page.memberships) {
        if (
          membershipIds.has(membership.membershipId) ||
          academyIds.has(membership.academyId)
        ) {
          throw new Error('DUPLICATE_MEMBERSHIP_PAGE')
        }

        membershipIds.add(membership.membershipId)
        academyIds.add(membership.academyId)
      }

      setState({
        memberships: [...previousMemberships, ...page.memberships],
        nextCursor: page.nextCursor,
        loaded: true,
        loading: false,
        selectingId: null,
        error: null,
        notice: null,
      })
    } catch (error) {
      if (version === requestVersion.current) {
        setState((current) => ({
          ...current,
          loading: false,
          error: getMembershipErrorMessage(error),
        }))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
      }
    }
  }, [userId])

  useEffect(() => {
    const version = ++requestVersion.current
    requestRunning.current = true

    void listMyAcademyMemberships(userId)
      .then((page) => {
        if (version !== requestVersion.current) {
          return
        }

        setState({
          memberships: page.memberships,
          nextCursor: page.nextCursor,
          loaded: true,
          loading: false,
          selectingId: null,
          error: null,
          notice: null,
        })
      })
      .catch((error: unknown) => {
        if (version !== requestVersion.current) {
          return
        }

        setState((current) => ({
          ...current,
          loading: false,
          error: getMembershipErrorMessage(error),
        }))
      })
      .finally(() => {
        if (version === requestVersion.current) {
          requestRunning.current = false
        }
      })

    return () => {
      requestVersion.current += 1
      requestRunning.current = false
    }
  }, [userId])

  function handleRefresh() {
    if (requestRunning.current) {
      return
    }

    setState({
      memberships: [],
      nextCursor: null,
      loaded: false,
      loading: true,
      selectingId: null,
      error: null,
      notice: null,
    })

    void fetchPage(null, [])
  }

  function handleLoadMore() {
    if (requestRunning.current || state.nextCursor === null) {
      return
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
      notice: null,
    }))

    void fetchPage(state.nextCursor, state.memberships)
  }

  async function handleSelect(
    selected: AcademyMembershipContext,
  ) {
    if (
      requestRunning.current ||
      selected.status !== 'active'
    ) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setState((current) => ({
      ...current,
      selectingId: selected.membershipId,
      error: null,
      notice: null,
    }))

    try {
      const membership = await getAcademyMembershipContext(
        selected.academyId,
        userId,
      )

      if (version !== requestVersion.current) {
        return
      }

      if (membership === null || membership.status !== 'active') {
        setState((current) => ({
          ...current,
          selectingId: null,
          memberships: membership === null
            ? current.memberships.filter(
                (item) => item.membershipId !== selected.membershipId,
              )
                        : current.memberships.map(
                (item) => item.membershipId === selected.membershipId
                  ? {
                      ...membership,
                      academyName: item.academyName,
                    }
                  : item,
              ),
          notice: membership === null
            ? 'O vínculo não está mais disponível. Atualize a lista.'
            : 'O vínculo deixou de estar ativo e não pode ser selecionado.',
        }))

        return
      }

      onSelect(membership)
    } catch (error) {
      if (version === requestVersion.current) {
        setState((current) => ({
          ...current,
          selectingId: null,
          error: getMembershipErrorMessage(error),
        }))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
      }
    }
  }

  const busy = state.loading || state.selectingId !== null

  return (
    <section
      className="membership-panel"
      aria-labelledby="membership-title"
      aria-busy={busy}
    >
      <h2 id="membership-title">Minhas academias</h2>

      <p>Selecione uma academia com vínculo ativo para continuar.</p>

      <button
        className="auth-button auth-button-secondary"
        type="button"
        disabled={busy}
        onClick={handleRefresh}
      >
        Atualizar lista
      </button>

      <div aria-live="polite">
        {state.loading && (
          <p>
            {state.loaded
              ? 'Carregando mais academias...'
              : 'Carregando suas academias...'}
          </p>
        )}

        {state.selectingId !== null && (
          <p>Verificando seu vínculo antes de continuar...</p>
        )}

        {state.notice && <p>{state.notice}</p>}
      </div>

      {state.error && (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      )}

      {state.loaded && state.memberships.length === 0 && (
        <p>Nenhum vínculo de academia foi encontrado para esta conta.</p>
      )}

      {state.memberships.length > 0 && (
        <ul className="membership-list">
          {state.memberships.map((membership, index) => (
            <li
              className="membership-card"
              key={membership.membershipId}
            >
              <h3>
                {membership.academyName ?? `Academia ${index + 1}`}
              </h3>

              <dl className="dev-settings">
                <div>
                  <dt>Identificador</dt>
                  <dd>{membership.academyId}</dd>
                </div>

                <div>
                  <dt>Estado do vínculo</dt>
                  <dd>{statusLabels[membership.status]}</dd>
                </div>

                <div>
                  <dt>Seus papéis</dt>
                  <dd>
                    {membership.roles
                      .map((role) => roleLabels[role])
                      .join(', ')}
                  </dd>
                </div>

                <div>
                  <dt>Permissão administrativa</dt>
                  <dd>
                    {membership.canManage
                      ? 'Permitida'
                      : 'Não permitida'}
                  </dd>
                </div>
              </dl>

              {membership.status === 'active' ? (
                <button
                  className="auth-button"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void handleSelect(membership)
                  }}
                >
                  {state.selectingId === membership.membershipId
                    ? 'Verificando...'
                    : 'Usar esta academia'}
                </button>
              ) : (
                <p>Este vínculo não permite entrar na academia.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.nextCursor !== null && (
        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy}
          onClick={handleLoadMore}
        >
          Carregar mais
        </button>
      )}
    </section>
  )
}

export default AcademyMembershipPanel