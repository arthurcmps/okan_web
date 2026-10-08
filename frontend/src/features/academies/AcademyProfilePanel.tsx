import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import type {
  AcademyMembershipContext,
} from './academy-membership-context'
import type {
  AcademyProfileFields,
  AcademyProfileResult,
} from './academy-profile-result'
import {
  createAcademyProfileQueryService,
} from './academy-profile-query-service'
import {
  createAcademyProfileUpdateService,
} from './academy-profile-update-service'
import {
  normalizeAcademyProfileFields,
} from './academy-profile-update-command'
import {
  formatCnpj,
  formatTelephone,
  formatCep,
  formatUf,
} from './academy-registration-format'
import {
  lookupRegistrationCep,
} from './academy-registration-cep'

interface AcademyProfilePanelProps {
  membership: AcademyMembershipContext
}

interface ProfileField {
  name: keyof AcademyProfileFields
  label: string
  type: 'text' | 'tel'
  maxLength?: number
}

const profileFields: readonly ProfileField[] = [
  { name: 'nome', label: 'Nome da academia', type: 'text' },
  { name: 'cnpj', label: 'CNPJ', type: 'text', maxLength: 18 },
  {
    name: 'telefoneResponsavel',
    label: 'Telefone da unidade',
    type: 'tel',
    maxLength: 15,
  },
  { name: 'cep', label: 'CEP', type: 'text', maxLength: 9 },
  {
    name: 'endereco',
    label: 'Rua ou avenida e número',
    type: 'text',
  },
  { name: 'bairro', label: 'Bairro', type: 'text' },
  { name: 'uf', label: 'UF', type: 'text', maxLength: 2 },
]

function errorMessageFor(error: unknown): string {
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

    case 'functions/aborted':
      return 'O cadastro foi alterado por outra operação. Consulte novamente antes de editar.'

    case 'functions/not-found':
      return 'A academia não foi encontrada.'

    case 'functions/failed-precondition':
      return 'O cadastro está indisponível neste ambiente ou precisa de revisão.'

    case 'functions/invalid-argument':
    case 'INVALID_ACADEMY_PROFILE_FIELDS':
      return 'Confira os campos obrigatórios. A UF deve ter duas letras.'

    default:
      return 'Não foi possível concluir ou validar a operação.'
  }
}

function editableFields(
  profile: AcademyProfileResult,
): AcademyProfileFields {
  const academy = profile.academy

  return {
    nome: academy.nome,
    cnpj: formatCnpj(academy.cnpj),
    telefoneResponsavel: formatTelephone(academy.telefoneResponsavel),
    cep: formatCep(academy.cep),
    endereco: academy.endereco,
    bairro: academy.bairro,
    uf: formatUf(academy.uf),
  }
}

function AcademyProfilePanel({
  membership,
}: AcademyProfilePanelProps) {
  const [context, setContext] = useState(membership)
  const [profile, setProfile] = useState<AcademyProfileResult | null>(null)
  const [draft, setDraft] = useState<AcademyProfileFields | null>(null)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<'get' | 'save' | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cepBusy, setCepBusy] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)

  const currentAcademy = useRef<AcademyMembershipContext | null>(null)
  const requestVersion = useRef(0)
  const requestRunning = useRef(false)
  const cepVersion = useRef(0)
  const cepController = useRef<AbortController | null>(null)

  if (context !== membership) {
    setContext(membership)
    setProfile(null)
    setDraft(null)
    setEditing(false)
    setBusy(null)
    setNeedsRefresh(false)
    setMessage(null)
    setErrorMessage(null)
    setCepBusy(false)
    setCepMessage(null)
  }

  useEffect(() => {
    currentAcademy.current = membership
    requestRunning.current = false

    return () => {
      currentAcademy.current = null
      requestVersion.current += 1
      cepVersion.current += 1
      cepController.current?.abort()
    }
  }, [membership])

  function cancelCepLookup() {
    cepVersion.current += 1
    cepController.current?.abort()
    cepController.current = null
    setCepBusy(false)
    setCepMessage(null)
  }

  async function searchCep(value: string) {
    const cep = formatCep(value)

    if (!/^\d{5}-\d{3}$/.test(cep)) {
      setCepMessage('Informe os oito dígitos do CEP.')
      return
    }

    const version = ++cepVersion.current
    cepController.current?.abort()

    const controller = new AbortController()
    cepController.current = controller

    setCepBusy(true)
    setCepMessage('Buscando endereço...')

    const timeout = window.setTimeout(() => {
      controller.abort()
    }, 10000)

    try {
      const address = await lookupRegistrationCep(
        cep,
        controller.signal,
      )

      if (version !== cepVersion.current) {
        return
      }

      setDraft((previous) => {
        if (!previous || previous.cep !== cep) {
          return previous
        }

        return {
          ...previous,
          endereco: address.logradouro
            ? `${address.logradouro}, `
            : '',
          bairro: address.bairro,
          uf: address.uf,
        }
      })

      setCepMessage(
        address.logradouro
          ? 'Endereço encontrado. Confira os dados e acrescente o número.'
          : 'CEP encontrado sem nome de rua. Preencha o endereço manualmente.',
      )
    } catch (error) {
      if (version !== cepVersion.current) {
        return
      }

      setCepMessage(
        error instanceof Error &&
        error.message === 'REGISTRATION_CEP_NOT_FOUND'
          ? 'CEP não encontrado. Confira ou preencha o endereço manualmente.'
          : 'Não foi possível consultar o CEP. Preencha manualmente ou tente novamente.',
      )
    } finally {
      window.clearTimeout(timeout)

      if (version === cepVersion.current) {
        cepController.current = null
        setCepBusy(false)
      }
    }
  }

  function changeField(name: keyof AcademyProfileFields, value: string) {
    let formatted = value

    switch (name) {
      case 'cnpj':
        formatted = formatCnpj(value)
        break
      case 'telefoneResponsavel':
        formatted = formatTelephone(value)
        break
      case 'cep':
        formatted = formatCep(value)
        break
      case 'uf':
        formatted = formatUf(value)
        break
    }

    if (
      name === 'cep' ||
      name === 'endereco' ||
      name === 'bairro' ||
      name === 'uf'
    ) {
      cancelCepLookup()
    }

    setDraft((previous) => (
      previous ? { ...previous, [name]: formatted } : previous
    ))

    setErrorMessage(null)

    if (name === 'cep' && /^\d{5}-\d{3}$/.test(formatted)) {
      void searchCep(formatted)
    }
  }

  async function loadProfile() {
    if (requestRunning.current) {
      return
    }

    requestRunning.current = true
    const version = ++requestVersion.current

    cancelCepLookup()
    setBusy('get')
    setEditing(false)
    setDraft(null)
    setProfile(null)
    setNeedsRefresh(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const getProfile = createAcademyProfileQueryService(
        () => currentAcademy.current,
      )

      const result = await getProfile(
        membership.academyId,
        membership.userId,
      )

      if (version !== requestVersion.current) {
        return
      }

      setProfile(result)
      setNeedsRefresh(false)
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(errorMessageFor(error))
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
      }
    }
  }

  function startEditing() {
    if (!profile || needsRefresh || requestRunning.current) {
      return
    }

    cancelCepLookup()
    setDraft(editableFields(profile))
    setEditing(true)
    setMessage(null)
    setErrorMessage(null)
  }

  function cancelEditing() {
    cancelCepLookup()
    setEditing(false)
    setDraft(null)
    setErrorMessage(null)
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      requestRunning.current ||
      cepBusy ||
      needsRefresh ||
      !editing ||
      !profile ||
      !draft
    ) {
      return
    }

    let fields: AcademyProfileFields

    try {
      fields = normalizeAcademyProfileFields(draft)
    } catch (error) {
      setErrorMessage(errorMessageFor(error))
      return
    }

    const expectedRevision = profile.revision

    requestRunning.current = true
    const version = ++requestVersion.current

    cancelCepLookup()
    setBusy('save')
    setNeedsRefresh(true)
    setMessage(null)
    setErrorMessage(null)

    try {
      const updateProfile = createAcademyProfileUpdateService(
        () => currentAcademy.current,
      )

      const result = await updateProfile(
        membership.academyId,
        membership.userId,
        fields,
        expectedRevision,
      )

      if (version !== requestVersion.current) {
        return
      }

      setProfile({
        academy: result.academy,
        revision: result.revision,
      })

      setNeedsRefresh(false)
      setMessage(
        result.updated
          ? 'Dados da academia atualizados.'
          : 'Os dados já estavam atualizados.',
      )
    } catch (error) {
      if (version === requestVersion.current) {
        setErrorMessage(
          `${errorMessageFor(error)} Consulte os dados novamente antes de editar.`,
        )
      }
    } finally {
      if (version === requestVersion.current) {
        requestRunning.current = false
        setBusy(null)
        setEditing(false)
        setDraft(null)
      }
    }
  }

  return (
    <section aria-labelledby="academy-profile-title">
      <h3 id="academy-profile-title">Dados da academia</h3>

      <button
        className="auth-button"
        type="button"
        disabled={busy !== null || editing}
        onClick={loadProfile}
      >
        {busy === 'get' ? 'Consultando...' : 'Consultar dados'}
      </button>

      {!profile && busy === null && !errorMessage && (
        <p>Clique em Consultar dados para carregar o cadastro.</p>
      )}

      {message && <p role="status">{message}</p>}

      {errorMessage && (
        <p className="auth-error" role="alert">
          {errorMessage}
        </p>
      )}

      {needsRefresh && busy === null && (
        <p>Consulte novamente para obter o cadastro atual e liberar a edição.</p>
      )}

      {profile && !editing && (
        <>
          <dl className="dev-settings">
            {profileFields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>{profile.academy[field.name] || 'Não informado'}</dd>
              </div>
            ))}

            <div>
              <dt>E-mail do gestor</dt>
              <dd>{profile.academy.emailGestor || 'Não informado'}</dd>
            </div>
          </dl>

          <button
            className="auth-button auth-button-secondary"
            type="button"
            disabled={busy !== null || needsRefresh}
            onClick={startEditing}
          >
            Editar dados
          </button>
        </>
      )}

      {editing && draft && profile && (
        <form
          className="auth-form"
          onSubmit={handleSave}
          aria-busy={busy !== null || cepBusy}
        >
          {profileFields.map((field) => (
            <div className="auth-form" key={field.name}>
              <label htmlFor={`profile-${field.name}`}>
                {field.label}
              </label>

              <input
                id={`profile-${field.name}`}
                name={field.name}
                type={field.type}
                inputMode={
                  field.name === 'cnpj' || field.name === 'cep'
                    ? 'numeric'
                    : field.name === 'telefoneResponsavel'
                      ? 'tel'
                      : 'text'
                }
                maxLength={field.maxLength}
                required
                disabled={busy !== null}
                value={draft[field.name]}
                onChange={(event) => {
                  changeField(field.name, event.target.value)
                }}
              />

              {field.name === 'cep' && (
                <>
                  <button
                    className="auth-button auth-button-secondary"
                    type="button"
                    disabled={
                      busy !== null ||
                      cepBusy ||
                      !/^\d{5}-\d{3}$/.test(draft.cep)
                    }
                    onClick={() => {
                      void searchCep(draft.cep)
                    }}
                  >
                    {cepBusy ? 'Buscando...' : 'Buscar endereço'}
                  </button>

                  {cepMessage && <p role="status">{cepMessage}</p>}
                </>
              )}
            </div>
          ))}

          <p>
            E-mail do gestor: {profile.academy.emailGestor || 'Não informado'}
          </p>

          <div className="academy-actions">
            <button
              className="auth-button"
              type="submit"
              disabled={busy !== null || cepBusy || needsRefresh}
            >
              {busy === 'save' ? 'Salvando...' : 'Salvar alterações'}
            </button>

            <button
              className="auth-button auth-button-secondary"
              type="button"
              disabled={busy !== null}
              onClick={cancelEditing}
            >
              Cancelar edição
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default AcademyProfilePanel