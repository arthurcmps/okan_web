import { useEffect, useRef, useState } from 'react'

import {
  getAcademyMembershipContext,
  getMembershipErrorMessage,
} from './academy-membership-service'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'

import AcademyStudentsPanel from './AcademyStudentsPanel'
import AcademyLinkRequestPanel from './AcademyLinkRequestPanel'
import AcademySentLinkRequestsPanel from './AcademySentLinkRequestsPanel'

interface AcademyWorkspaceProps {
  membership: AcademyMembershipContext
  onRevalidated: (membership: AcademyMembershipContext) => void
  onBack: (message?: string) => void
}

const roleLabels = {
  gym_admin: 'Gestor',
  professor: 'Professor',
  aluno: 'Aluno',
}

function AcademyWorkspace({
  membership,
  onRevalidated,
  onBack,
}: AcademyWorkspaceProps) {
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestVersion = useRef(0)
  const requestRunning = useRef(false)

  useEffect(() => {
    return () => {
      requestVersion.current += 1
    }
  }, [])

  async function handleRevalidate() {
    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    setBusy(true)
    setErrorMessage(null)

    try {
      const updatedMembership = await getAcademyMembershipContext(
        membership.academyId,
        membership.userId,
      )

      if (version !== requestVersion.current) {
        return
      }

      if (!updatedMembership || updatedMembership.status !== 'active') {
        onBack('O vínculo não está mais ativo. Selecione uma academia novamente.')
        return
      }

      onRevalidated(updatedMembership)
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(getMembershipErrorMessage(error))
      }
    } finally {
      if (version === requestVersion.current) {
        setBusy(false)
      }

      requestRunning.current = false
    }
  }

  return (
    <section className="academy-workspace" aria-labelledby="workspace-title">
      <p className="dev-label">Academia selecionada</p>

      <h2 id="workspace-title">
        {membership.canManage ? 'Área de gestão' : 'Minha academia'}
      </h2>

      <dl className="dev-settings">
        <div>
          <dt>Academia</dt>
          <dd>{membership.academyId}</dd>
        </div>

        <div>
          <dt>Meu vínculo</dt>
          <dd>Ativo</dd>
        </div>

        <div>
          <dt>Meus papéis</dt>
          <dd>
            {membership.roles
              .map((role) => roleLabels[role])
              .join(', ')}
          </dd>
        </div>

        <div>
          <dt>Acesso administrativo</dt>
          <dd>
            {membership.canManage
              ? 'Permitido pelo vínculo consultado'
              : 'Não permitido pelo vínculo consultado'}
          </dd>
        </div>
      </dl>

      <div className="academy-actions">
        <button
          className="auth-button"
          type="button"
          disabled={busy}
          onClick={handleRevalidate}
        >
          {busy ? 'Revalidando...' : 'Revalidar acesso'}
        </button>

        <button
          className="auth-button auth-button-secondary"
          type="button"
          disabled={busy}
          onClick={() => onBack()}
        >
          Trocar academia
        </button>
      </div>

      {busy && <p role="status">Consultando o vínculo atual...</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">
          {errorMessage}
        </p>
      )}

                  {!busy &&
        membership.status === 'active' &&
        membership.canManage &&
        membership.roles.includes('gym_admin') && (
          <>
            <AcademyLinkRequestPanel
              key={`link-request-${membership.membershipId}`}
              membership={membership}
            />

            <AcademySentLinkRequestsPanel
              key={`sent-link-requests-${membership.membershipId}`}
              membership={membership}
            />

            <AcademyStudentsPanel
              key={membership.membershipId}
              membership={membership}
            />
          </>
        )}
    </section>
  )
}

export default AcademyWorkspace