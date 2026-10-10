import { useEffect, useRef, useState } from 'react'

import type { AcademyMembershipContext } from './academy-membership-context'
import type {
  AcademySubscriptionPanelResult,
  AcademySubscriptionQuote,
  BillingStatus,
  SubscriptionStatus,
} from './academy-subscription-result'
import { createAcademySubscriptionService } from './academy-subscription-service'

interface Props {
  membership: AcademyMembershipContext
}

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  creating: 'Em preparação',
  active: 'Autorizada',
  paused: 'Pausada',
  canceled: 'Cancelada',
  expired: 'Expirada',
  failed: 'Não concluída',
}

const billingLabels: Record<BillingStatus, string> = {
  scheduled: 'Cobrança agendada',
  current: 'Pagamento aprovado',
  processing: 'Pagamento em processamento',
  retrying: 'Nova tentativa de cobrança',
  past_due: 'Pagamento pendente de regularização',
}

const accessLabels: Record<string, string> = {
  subscription_not_active: 'Assinatura sem acesso ativo.',
  billing_current: 'Acesso permitido pelo pagamento aprovado.',
  billing_past_due: 'Acesso indisponível por pendência financeira.',
  billing_grace: 'Acesso mantido durante a tentativa de cobrança.',
  awaiting_first_payment: 'Aguardando o primeiro pagamento aprovado.',
  next_charge_scheduled: 'Acesso permitido; próxima cobrança agendada.',
  billing_not_initialized: 'A situação financeira ainda não foi confirmada.',
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function errorMessage(error: unknown): string {
  const code = typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : error instanceof Error ? error.message : ''

  switch (code) {
    case 'functions/unauthenticated':
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_CHANGED':
      return 'Sua sessão mudou. Entre novamente antes de continuar.'

    case 'functions/permission-denied':
    case 'ACADEMY_MANAGEMENT_FORBIDDEN':
      return 'Não foi possível concluir a operação. Tente novamente.'

    case 'ACADEMY_CONTEXT_CHANGED':
      return 'A academia selecionada mudou. Consulte novamente.'

    case 'functions/aborted':
      return 'Os dados da assinatura mudaram. Atualize e tente novamente.'

    case 'functions/unavailable':
      return 'Não foi possível confirmar a operação no servidor.'

    case 'functions/not-found':
      return 'Academia não encontrada.'

    case 'INVALID_SUBSCRIPTION_QUOTE_INPUT':
    case 'functions/invalid-argument':
      return 'Informe uma quantidade inteira de licenças e um dia entre 1 e 28.'

    case 'functions/failed-precondition':
      return error instanceof Error
        ? error.message
        : 'A operação está indisponível ou os dados precisam de revisão.'

    case 'INVALID_ACADEMY_SUBSCRIPTION_RESPONSE':
    case 'ACADEMY_SUBSCRIPTION_CONTEXT_MISMATCH':
      return 'Não foi possível validar os dados recebidos. Consulte novamente.'

    default:
      return 'Não foi possível concluir a consulta. Tente novamente.'
  }
}

function AcademySubscriptionPanel({ membership }: Props) {
  const [context, setContext] = useState(membership)
  const [panel, setPanel] =
    useState<AcademySubscriptionPanelResult | null>(null)
  const [quote, setQuote] = useState<AcademySubscriptionQuote | null>(null)
  const [quantity, setQuantity] = useState('3')
  const [billingDay, setBillingDay] = useState('10')
  const [busy, setBusy] = useState<'get' | 'quote' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [confirmCancellation, setConfirmCancellation] = useState(false)
  const [cancellationNotice, setCancellationNotice] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const version = useRef(0)
  const running = useRef(false)

  if (context !== membership) {
    setContext(membership)
    setPanel(null)
    setQuote(null)
    setQuantity('3')
    setBillingDay('10')
    setBusy(null)
    setError(null)
    setConfirmCancellation(false)
    setCancellationNotice(null)
  }

  useEffect(() => {
    currentAcademy.current = membership
    running.current = false

    return () => {
      currentAcademy.current = null
      version.current += 1
    }
  }, [membership])

  async function execute(operation: 'get' | 'quote') {
    if (running.current) return

    running.current = true
    const requestVersion = ++version.current

    setBusy(operation)
    setError(null)
    setQuote(null)
    setConfirmCancellation(false)
    setCancellationNotice(null)

    if (operation === 'get') setPanel(null)

    try {
      const service = createAcademySubscriptionService(
        () => currentAcademy.current,
      )

      if (operation === 'get') {
        const result = await service.getPanel(
          membership.academyId,
          membership.userId,
        )

        if (requestVersion !== version.current) return

        setPanel(result)
        setQuantity(String(Math.max(
          result.subscription?.licenseQuantity ?? result.licensesTotal,
          result.licensesUsed,
          1,
        )))
      } else {
        const result = await service.quote(
          membership.academyId,
          membership.userId,
          Number(quantity),
          Number(billingDay),
        )

        if (requestVersion !== version.current) return

        setQuote(result)
      }
    } catch (caught) {
      if (requestVersion === version.current) {
        setError(errorMessage(caught))
      }
    } finally {
      if (requestVersion === version.current) {
        running.current = false
        setBusy(null)
      }
    }
  }

    async function cancelSubscription() {
    if (running.current || !confirmCancellation) return

    running.current = true
    const requestVersion = ++version.current
    let cancellationConfirmed = false

    setBusy('cancel')
    setError(null)
    setCancellationNotice(null)
    setQuote(null)

    try {
      const service = createAcademySubscriptionService(
        () => currentAcademy.current,
      )

      const result = await service.cancel(
        membership.academyId,
        membership.userId,
      )

      if (requestVersion !== version.current) return

      cancellationConfirmed = true
      setConfirmCancellation(false)
      setPanel(null)

      setCancellationNotice(result.alreadyCanceled
        ? 'A assinatura já estava cancelada. O servidor confirmou o estado.'
        : 'Cancelamento confirmado pelo servidor.')

      const updatedPanel = await service.getPanel(
        membership.academyId,
        membership.userId,
      )

      if (requestVersion !== version.current) return

      setPanel(updatedPanel)
    } catch (caught) {
      if (requestVersion === version.current) {
        setConfirmCancellation(false)

        setError(cancellationConfirmed
          ? 'Não foi possível atualizar o painel. Use Atualizar assinatura.'
          : `${errorMessage(caught)} Atualize a assinatura para conferir o estado.`)
      }
    } finally {
      if (requestVersion === version.current) {
        running.current = false
        setBusy(null)
      }
    }
  }

  const subscription = panel?.subscription ?? null
  const hasSubscription = subscription !== null && (
    subscription.status === 'creating' ||
    subscription.status === 'active' ||
    subscription.status === 'paused'
  )

  const canCancel = subscription !== null && (
    subscription.status === 'active' ||
    subscription.status === 'paused'
  )

  const canQuote = panel !== null &&
    !panel.legacyBilling.requiresMigration &&
    !hasSubscription

  return (
    <section
      aria-labelledby="academy-subscription-title"
      aria-busy={busy !== null}
    >
      <h3 id="academy-subscription-title">Assinatura da academia</h3>

      <p>
        Consulte a situação da assinatura e calcule o valor mensal
        das licenças para professores.
      </p>

      <button
        className="auth-button"
        type="button"
        disabled={busy !== null}
        onClick={() => execute('get')}
      >
        {busy === 'get' ? 'Consultando...' : 'Atualizar assinatura'}
      </button>

      {!panel && !busy && !error && (
        <p>Atualize a assinatura para consultar os dados.</p>
      )}

            {busy && (
        <p role="status">
          {busy === 'get'
            ? 'Consultando a assinatura...'
            : busy === 'quote'
              ? 'Consultando os valores no servidor...'
              : 'Cancelando e confirmando a assinatura...'}
        </p>
      )}

      {cancellationNotice && (
        <p role="status">{cancellationNotice}</p>
      )}

      {error && <p className="auth-error" role="alert">{error}</p>}

      {panel && (
        <>
          <h4>{panel.academyName ?? 'Academia selecionada'}</h4>

          <dl className="dev-settings">
            <div>
              <dt>Capacidade de licenças</dt>
              <dd>{panel.licensesTotal}</dd>
            </div>
            <div>
              <dt>Licenças em uso</dt>
              <dd>{panel.licensesUsed}</dd>
            </div>
            <div>
              <dt>Licenças disponíveis</dt>
              <dd>{panel.licensesAvailable}</dd>
            </div>
          </dl>

          {subscription ? (
            <>
              <dl className="dev-settings">
                <div>
                  <dt>Assinatura</dt>
                  <dd>{subscriptionLabels[subscription.status]}</dd>
                </div>
                <div>
                  <dt>Situação financeira</dt>
                  <dd>
                    {subscription.billingStatus
                      ? billingLabels[subscription.billingStatus]
                      : 'Ainda não informada'}
                  </dd>
                </div>
                <div>
                  <dt>Licenças na assinatura</dt>
                  <dd>{subscription.licenseQuantity}</dd>
                </div>
                <div>
                  <dt>Valor mensal da assinatura</dt>
                  <dd>{formatMoney(subscription.monthlyAmount)}</dd>
                </div>
                <div>
                  <dt>Dia de cobrança</dt>
                  <dd>{subscription.billingDay}</dd>
                </div>
              </dl>

              <p>{accessLabels[subscription.accessReason]}</p>
            </>
          ) : (
            <p>
              Nenhuma assinatura foi encontrada no novo sistema.
              A capacidade de licenças, sozinha, não confirma pagamento.
            </p>
          )}

          {panel.legacyBilling.detected && (
            <p role="status">
              Há um registro de cobrança no sistema antigo
              {panel.legacyBilling.status
                ? ` (${panel.legacyBilling.status})`
                : ''}.
              {panel.legacyBilling.requiresMigration
                ? ' Essa cobrança precisa ser migrada antes de uma nova contratação.'
                : ' A cotação será revalidada pelo servidor.'}
            </p>
          )}

          {hasSubscription && (
            <p>
              Esta academia já possui uma assinatura em andamento.
              Uma nova contratação está bloqueada.
            </p>
          )}

                    {canCancel && (
            <div>
              {!confirmCancellation ? (
                <button
                  className="auth-button"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setConfirmCancellation(true)}
                >
                  Cancelar assinatura
                </button>
              ) : (
                <div>
                  <p>
                    Confirmar o cancelamento da assinatura de{' '}
                    <strong>{panel.academyName ?? 'esta academia'}</strong>?
                    O acesso seguirá o estado confirmado pelo servidor.
                  </p>

                  <button
                    className="auth-button"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void cancelSubscription()}
                  >
                    {busy === 'cancel'
                      ? 'Cancelando...'
                      : 'Confirmar cancelamento'}
                  </button>

                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setConfirmCancellation(false)}
                  >
                    Voltar
                  </button>
                </div>
              )}
            </div>
          )}

          {canQuote && (
            <form onSubmit={(event) => {
              event.preventDefault()
              void execute('quote')
            }}>
              <h4>Consultar cotação</h4>

              <label htmlFor="subscription-license-quantity">
                Quantidade total de licenças
              </label>
              <input
                id="subscription-license-quantity"
                type="number"
                min={Math.max(panel.licensesUsed, 1)}
                step={1}
                required
                value={quantity}
                disabled={busy !== null}
                onChange={(event) => {
                  setQuantity(event.target.value)
                  setQuote(null)
                  setError(null)
                }}
              />

              <label htmlFor="subscription-billing-day">
                Dia de cobrança
              </label>
              <select
                id="subscription-billing-day"
                value={billingDay}
                disabled={busy !== null}
                onChange={(event) => {
                  setBillingDay(event.target.value)
                  setQuote(null)
                  setError(null)
                }}
              >
                {Array.from({ length: 28 }, (_, index) => index + 1)
                  .map((day) => (
                    <option key={day} value={day}>Dia {day}</option>
                  ))}
              </select>

              <button
                className="auth-button"
                type="submit"
                disabled={busy !== null}
              >
                Consultar valor mensal
              </button>
            </form>
          )}

          {quote && (
            <div role="status">
              <h4>Cotação recebida</h4>
              <p>{quote.licenseQuantity} licença(s) para professores.</p>
              <p>
                Valor por licença: {formatMoney(quote.unitMonthlyAmount)}.
              </p>
              <p>
                Total mensal: <strong>{formatMoney(quote.monthlyAmount)}</strong>.
              </p>
              <p>Dia de cobrança: {quote.billingDay}.</p>
              <p>
                Esta consulta não criou uma assinatura nem uma cobrança.
                A contratação será disponibilizada na próxima etapa.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default AcademySubscriptionPanel