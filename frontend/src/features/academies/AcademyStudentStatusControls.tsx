import { useEffect, useRef, useState } from 'react'
import { FirebaseError } from 'firebase/app'

import {
  createAcademyStudentStatusService,
} from './academy-student-status-service'

import type {
  AcademyStudentStatusAction,
} from './academy-student-status-command'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'

import type {
  AcademyStudentMembership,
} from './academy-students-page'

import type {
  AcademyStudentStatusResult,
} from './academy-student-status-result'

export type StudentStatusOutcome =
  | {
    readonly success: true
    readonly result: AcademyStudentStatusResult
  }
  | {
    readonly success: false
    readonly error: unknown
  }

interface StudentStatusControlsProps {
  student: AcademyStudentMembership
  operatorUid: string
  disabled: boolean
  getCurrentAcademy: () => AcademyMembershipContext | null
  onStart: () => number | null
  onFinish: (token: number, outcome: StudentStatusOutcome) => void
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/permission-denied':
        return 'Seu acesso foi negado. Revalide o acesso à academia.'

      case 'functions/unauthenticated':
        return 'Sua sessão não foi reconhecida. Entre novamente.'

      case 'functions/failed-precondition':
        return 'O vínculo ou o ambiente não permite essa alteração.'

      case 'functions/not-found':
        return 'O vínculo não foi encontrado. Atualize a lista.'

      case 'functions/aborted':
        return 'A operação está desatualizada. Atualize a lista.'
    }
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'AUTHENTICATION_REQUIRED':
      case 'AUTHENTICATION_CHANGED':
        return 'A sessão mudou. Entre novamente antes de continuar.'

      case 'ACADEMY_CONTEXT_CHANGED':
        return 'O contexto da academia mudou. Revalide o acesso.'

      case 'ACADEMY_MANAGEMENT_FORBIDDEN':
      case 'STUDENT_STATUS_TARGET_FORBIDDEN':
        return 'Seu vínculo não permite executar essa ação.'
    }
  }

  return (
    'Não foi possível confirmar o resultado. A alteração pode ter sido ' +
    'concluída. Confira novamente usando o mesmo pedido ou atualize a lista.'
  )
}

function AcademyStudentStatusControls({
  student,
  operatorUid,
  disabled,
  getCurrentAcademy,
  onStart,
  onFinish,
}: StudentStatusControlsProps) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mounted = useRef(false)
  const requestRunning = useRef(false)
  const pendingAction = useRef<AcademyStudentStatusAction | null>(null)

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  const eligible =
    student.userId !== operatorUid &&
    !student.roles.includes('gym_admin') &&
    (
      student.status === 'active' ||
      student.status === 'suspended'
    )

  async function executeAction() {
    if (disabled || requestRunning.current || !eligible) {
      return
    }

    let action = pendingAction.current

    if (!action) {
      const nextStatus = student.status === 'active'
        ? 'suspended'
        : 'active'

      const verb = nextStatus === 'suspended' ? 'Suspender' : 'Reativar'
      const name = student.studentName ?? student.userId

      if (!window.confirm(
        `${verb} o vínculo de ${name} com esta academia?`,
      )) {
        return
      }

      action = {
        student,
        expectedUserId: operatorUid,
        nextStatus,
        requestId: crypto.randomUUID(),
      }
    }

    const token = onStart()

    if (token === null) {
      return
    }

    pendingAction.current = action
    requestRunning.current = true
    setRunning(true)
    setError(null)

    let outcome: StudentStatusOutcome

    try {
      const command = createAcademyStudentStatusService(
        getCurrentAcademy,
      )

      const result = await command(action)

      pendingAction.current = null
      outcome = { success: true, result }
    } catch (actionError) {
      outcome = { success: false, error: actionError }

      if (mounted.current) {
        setError(getActionErrorMessage(actionError))
      }
    }

    requestRunning.current = false

    if (mounted.current) {
      setRunning(false)
    }

    onFinish(token, outcome)
  }

  if (!eligible) {
    return null
  }

  const buttonLabel = running
    ? 'Processando...'
    : error
      ? 'Conferir novamente a ação'
      : student.status === 'active'
        ? 'Suspender vínculo'
        : 'Reativar vínculo'

  return (
    <div className="student-status-controls" aria-busy={running}>
      <button
        className="auth-button auth-button-secondary"
        type="button"
        disabled={disabled || running}
        onClick={() => {
          void executeAction()
        }}
      >
        {buttonLabel}
      </button>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default AcademyStudentStatusControls