import { useCallback, useEffect, useRef, useState } from 'react'
import { FirebaseError } from 'firebase/app'

import {
  createAcademyStudentsService,
} from './academy-students-service'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import type {
  AcademyStudentMembership,
} from './academy-students-page'

import AcademyStudentStatusControls from './AcademyStudentStatusControls'

import type {
  StudentStatusOutcome,
} from './AcademyStudentStatusControls'

interface AcademyStudentsPanelProps {
  membership: AcademyMembershipContext
}

interface StudentsState {
  context: AcademyMembershipContext
  students: readonly AcademyStudentMembership[]
  nextCursor: string | null
  loading: boolean
  loaded: boolean
  error: string | null
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

function getStudentsErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/permission-denied':
        return 'Seu acesso à lista foi negado. Revalide o acesso à academia.'

      case 'functions/unauthenticated':
        return 'Sua sessão não foi reconhecida. Saia e entre novamente.'

      case 'functions/failed-precondition':
        return 'A consulta está indisponível ou um vínculo precisa de revisão.'

      case 'functions/not-found':
        return 'A consulta de alunos não está disponível no backend DEV.'

      case 'functions/unavailable':
      case 'functions/deadline-exceeded':
      case 'functions/internal':
        return 'Não foi possível carregar os alunos. Tente atualizar a lista.'
    }
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'AUTHENTICATION_REQUIRED':
      case 'AUTHENTICATION_CHANGED':
        return 'A sessão mudou. Entre novamente para consultar os alunos.'

      case 'ACADEMY_CONTEXT_CHANGED':
        return 'A academia selecionada mudou. Revalide o acesso.'

      case 'ACADEMY_MANAGEMENT_FORBIDDEN':
        return 'Seu vínculo não permite consultar a lista de alunos.'
    }
  }

  return 'Não foi possível concluir ou validar a consulta de alunos.'
}

function isAccessFailure(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return (
      error.code === 'functions/permission-denied' ||
      error.code === 'functions/unauthenticated'
    )
  }

  if (error instanceof Error) {
    return [
      'AUTHENTICATION_REQUIRED',
      'AUTHENTICATION_CHANGED',
      'ACADEMY_CONTEXT_CHANGED',
      'ACADEMY_MANAGEMENT_FORBIDDEN',
    ].includes(error.message)
  }

  return false
}

function AcademyStudentsPanel({
  membership,
}: AcademyStudentsPanelProps) {
  const [state, setState] = useState<StudentsState>({
    context: membership,
    students: [],
    nextCursor: null,
    loading: true,
    loaded: false,
    error: null,
  })

  const [mutationContext, setMutationContext] =
    useState<AcademyMembershipContext | null>(null)

  const [notice, setNotice] = useState<{
    context: AcademyMembershipContext
    text: string
  } | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  const fetchPage = useCallback(async (
    cursor: string | null,
    previousStudents: readonly AcademyStudentMembership[],
  ) => {
    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    try {
      const query = createAcademyStudentsService(
        () => currentAcademy.current,
      )

      const page = await query(
        membership.academyId,
        membership.userId,
        cursor,
      )

      if (version !== requestVersion.current) {
        return
      }

      const membershipIds = new Set(
        previousStudents.map((student) => student.membershipId),
      )

      const userIds = new Set(
        previousStudents.map((student) => student.userId),
      )

      for (const student of page.students) {
        if (
          membershipIds.has(student.membershipId) ||
          userIds.has(student.userId)
        ) {
          throw new Error('DUPLICATE_STUDENTS_PAGE')
        }

        membershipIds.add(student.membershipId)
        userIds.add(student.userId)
      }

      setState({
        context: membership,
        students: [...previousStudents, ...page.students],
        nextCursor: page.nextCursor,
        loading: false,
        loaded: true,
        error: null,
      })
    } catch (error) {
      if (version === requestVersion.current) {
        setState({
          context: membership,
          students: [],
          nextCursor: null,
          loading: false,
          loaded: false,
          error: getStudentsErrorMessage(error),
        })
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
      }
    }
  }, [membership])

  useEffect(() => {
    currentAcademy.current = membership
    requestRunning.current = true

    const version = ++requestVersion.current

    const query = createAcademyStudentsService(
      () => currentAcademy.current,
    )

    void query(membership.academyId, membership.userId)
      .then((page) => {
        if (version !== requestVersion.current) {
          return
        }

        setState({
          context: membership,
          students: page.students,
          nextCursor: page.nextCursor,
          loading: false,
          loaded: true,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (version !== requestVersion.current) {
          return
        }

        setState({
          context: membership,
          students: [],
          nextCursor: null,
          loading: false,
          loaded: false,
          error: getStudentsErrorMessage(error),
        })
      })
      .finally(() => {
        if (version === requestVersion.current) {
          requestRunning.current = false
        }
      })

    return () => {
      requestVersion.current += 1
      requestRunning.current = false
      currentAcademy.current = null
    }
  }, [membership])

  const visibleState = state.context === membership ? state : null
  const changingStatus = mutationContext === membership
  const loadingStudents = visibleState === null || visibleState.loading
  const busy = loadingStudents || changingStatus

    function handleStatusStart(): number | null {
    if (
      requestRunning.current ||
      !visibleState ||
      currentAcademy.current !== membership
    ) {
      return null
    }

    requestRunning.current = true
    const token = ++requestVersion.current

    setMutationContext(membership)
    setNotice(null)

    return token
  }

  function handleStatusFinish(
    token: number,
    outcome: StudentStatusOutcome,
  ) {
    if (
      token !== requestVersion.current ||
      currentAcademy.current !== membership
    ) {
      return
    }

    requestRunning.current = false
    setMutationContext(null)

    if (!outcome.success) {
      if (isAccessFailure(outcome.error)) {
        setState({
          context: membership,
          students: [],
          nextCursor: null,
          loading: false,
          loaded: false,
          error: getStudentsErrorMessage(outcome.error),
        })
      }

      return
    }

    setNotice({
      context: membership,
      text: outcome.result.alreadyProcessed
        ? 'Pedido já processado. Consultando o estado atual dos alunos.'
        : 'Alteração confirmada. Atualizando a lista de alunos.',
    })

    setState({
      context: membership,
      students: [],
      nextCursor: null,
      loading: true,
      loaded: false,
      error: null,
    })

    void fetchPage(null, [])
  }

  function handleRefresh() {
    if (requestRunning.current || !visibleState) {
      return
    }

    setState({
      context: membership,
      students: [],
      nextCursor: null,
      loading: true,
      loaded: false,
      error: null,
    })

    void fetchPage(null, [])
  }

  function handleLoadMore() {
    if (
      requestRunning.current ||
      !visibleState ||
      visibleState.nextCursor === null
    ) {
      return
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }))

    void fetchPage(
      visibleState.nextCursor,
      visibleState.students,
    )
  }

  return (
    <section
      className="academy-students-panel"
      aria-labelledby="academy-students-title"
      aria-busy={busy}
    >
      <h3 id="academy-students-title">Alunos da academia</h3>

      <button
        className="auth-button auth-button-secondary"
        type="button"
        disabled={busy}
        onClick={handleRefresh}
      >
        Atualizar alunos
      </button>

      {loadingStudents && (
        <p role="status">Carregando alunos...</p>
          )}

          {changingStatus && (
            <p role="status">Processando alteração do vínculo...</p>
          )}

          {notice?.context === membership && (
            <p role="status">{notice.text}</p>
          )}

          {visibleState?.error && (
            <p className="auth-error" role="alert">
              {visibleState.error}
            </p>
          )}

      {visibleState?.loaded && visibleState.students.length === 0 && (
        <p>Nenhum vínculo de aluno foi encontrado nesta academia.</p>
      )}

      {visibleState && visibleState.students.length > 0 && (
        <>
          <p aria-live="polite">
            Alunos carregados: {visibleState.students.length}
          </p>

          <ul className="membership-list">
            {visibleState.students.map((student, index) => (
              <li
                className="membership-card"
                key={student.membershipId}
              >
                <h4>
                  {student.studentName ?? `Aluno ${index + 1}`}
                </h4>

                <dl className="dev-settings">
                  <div>
                    <dt>Identificador da conta</dt>
                    <dd>{student.userId}</dd>
                  </div>

                  <div>
                    <dt>Estado do vínculo</dt>
                    <dd>{statusLabels[student.status]}</dd>
                  </div>

                  <div>
                    <dt>Papéis na academia</dt>
                    <dd>
                      {student.roles
                        .map((role) => roleLabels[role])
                        .join(', ')}
                    </dd>
                  </div>
                </dl>
                  <AcademyStudentStatusControls
                  student={student}
                  operatorUid={membership.userId}
                  disabled={busy}
                  getCurrentAcademy={() => currentAcademy.current}
                  onStart={handleStatusStart}
                  onFinish={handleStatusFinish}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {visibleState?.nextCursor && (
        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy}
          onClick={handleLoadMore}
        >
          Carregar mais alunos
        </button>
      )}
    </section>
  )
}

export default AcademyStudentsPanel