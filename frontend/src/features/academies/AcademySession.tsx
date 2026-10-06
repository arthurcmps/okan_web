import { useState } from 'react'

import AcademyMembershipPanel from './AcademyMembershipPanel'
import AcademyWorkspace from './AcademyWorkspace'
import type {
  AcademyMembershipContext,
} from './academy-membership-context'

interface AcademySessionProps {
  userId: string
}

function AcademySession({ userId }: AcademySessionProps) {
  const [selectedMembership, setSelectedMembership] =
    useState<AcademyMembershipContext | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  function handleSelection(membership: AcademyMembershipContext) {
    if (
      membership.userId !== userId ||
      membership.status !== 'active'
    ) {
      setSelectedMembership(null)
      setFeedback('Não foi possível selecionar esse vínculo.')
      return
    }

    setFeedback(null)
    setSelectedMembership(membership)
  }

  function handleBack(message?: string) {
    setSelectedMembership(null)
    setFeedback(message ?? null)
  }

  if (selectedMembership) {
    return (
      <AcademyWorkspace
        membership={selectedMembership}
        onRevalidated={handleSelection}
        onBack={handleBack}
      />
    )
  }

  return (
    <>
      {feedback && (
        <p className="auth-error" role="alert">
          {feedback}
        </p>
      )}

      <AcademyMembershipPanel
        userId={userId}
        onSelect={handleSelection}
      />
    </>
  )
}

export default AcademySession