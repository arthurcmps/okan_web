import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'

import {
  createAcademyRegistrationService,
} from './academy-registration-service'
import type {
  AcademyRegistrationInput,
} from './academy-registration-input'

import {
  formatCnpj,
  formatTelephone,
  formatCep,
  formatUf,
} from './academy-registration-format'

import {
  lookupRegistrationCep,
} from './academy-registration-cep'

interface AcademyRegistrationPageProps {
  initialEmail: string
  onBack: () => void
  onComplete: () => void
}

interface RegistrationField {
  name: keyof AcademyRegistrationInput
  label: string
  placeholder: string
  type: 'text' | 'tel'
  maxLength?: number
}

const academyFields: readonly RegistrationField[] = [
  {
    name: 'gymName',
    label: 'Nome da academia',
    placeholder: 'Academia de teste',
    type: 'text',
  },
  {
    name: 'cnpj',
    label: 'CNPJ',
    placeholder: '00.000.000/0000-00',
    type: 'text',
    maxLength: 18,
  },
  {
    name: 'telefone',
    label: 'Telefone da unidade',
    placeholder: '(21) 99999-9999',
    type: 'tel',
    maxLength: 15,
  },
  {
    name: 'cep',
    label: 'CEP',
    placeholder: '00000-000',
    type: 'text',
    maxLength: 9,
  },
  {
    name: 'endereco',
    label: 'Rua ou avenida e número',
    placeholder: 'Rua de teste, 123',
    type: 'text',
  },
  {
    name: 'bairro',
    label: 'Bairro',
    placeholder: 'Centro',
    type: 'text',
  },
  {
    name: 'uf',
    label: 'UF',
    placeholder: 'RJ',
    type: 'text',
    maxLength: 2,
  },
]

function registrationErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Este e-mail já possui uma conta. Volte, faça login e use a opção de retomar cadastro.'

      case 'auth/invalid-email':
        return 'Informe um e-mail válido.'

      case 'auth/weak-password':
        return 'Escolha uma senha mais forte, com pelo menos seis caracteres.'

      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde antes de tentar novamente.'

      case 'functions/failed-precondition':
        return 'O backend não pôde concluir o cadastro ou o vínculo. Confira os logs e se o provisionamento do gestor está habilitado no DEV.'

      case 'functions/invalid-argument':
        return 'Confira os dados da academia e do gestor.'

      case 'functions/permission-denied':
        return 'O backend não autorizou o cadastro ou o vínculo para esta conta.'

      case 'functions/unauthenticated':
        return 'A sessão não foi reconhecida. Volte, faça login e retome o cadastro.'

      case 'auth/network-request-failed':
      case 'functions/unavailable':
      case 'functions/deadline-exceeded':
      case 'functions/internal':
        return 'Não foi possível confirmar a conclusão. Confira os emuladores e tente novamente com o mesmo e-mail.'
    }
  }

  if (error instanceof Error) {
    switch (error.message) {
      case 'INVALID_ACADEMY_REGISTRATION_INPUT':
        return 'Preencha os dados da academia e do gestor. A UF deve ter duas letras.'

      case 'INVALID_ACADEMY_REGISTRATION_CREDENTIALS':
        return 'Confira o e-mail e as senhas. A senha deve ter pelo menos seis caracteres e coincidir com a confirmação.'

      case 'ACADEMY_REGISTRATION_SESSION_MISMATCH':
        return 'Existe uma sessão de outro e-mail. Volte e saia dessa conta antes de cadastrar.'

      case 'AUTHENTICATION_CHANGED':
        return 'A sessão mudou durante o cadastro. Volte, faça login e retome a operação.'

      case 'INVALID_ACADEMY_REGISTRATION_RESPONSE':
      case 'INVALID_ACADEMY_REGISTRATION_MEMBERSHIP':
        return 'A resposta do backend não pôde ser validada. O cadastro pode ter sido gravado; confira os logs antes de retomar.'
    }
  }

  return 'Não foi possível concluir o cadastro. Confira os emuladores e tente novamente com o mesmo e-mail.'
}

function AcademyRegistrationPage({
  initialEmail,
  onBack,
  onComplete,
}: AcademyRegistrationPageProps) {
  const [fields, setFields] = useState<AcademyRegistrationInput>({
    gymName: '',
    adminName: '',
    cnpj: '',
    telefone: '',
    cep: '',
    endereco: '',
    bairro: '',
    uf: '',
  })

  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [registerAcademy] = useState(
    () => createAcademyRegistrationService(),
  )

  const running = useRef(false)

    const [cepBusy, setCepBusy] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)

  const cepRequestVersion = useRef(0)
  const cepController = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      cepRequestVersion.current += 1
      cepController.current?.abort()
    }
  }, [])

  function cancelCepLookup() {
    cepRequestVersion.current += 1
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

    const requestVersion = ++cepRequestVersion.current

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

      if (requestVersion !== cepRequestVersion.current) {
        return
      }

      setFields((previous) => {
        if (previous.cep !== cep) {
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
          ? 'Endereço encontrado. Confira os dados e acrescente o número da academia.'
          : 'CEP encontrado sem nome de rua. Preencha o endereço e confira o bairro e a UF.',
      )
    } catch (error) {
      if (requestVersion !== cepRequestVersion.current) {
        return
      }

      setCepMessage(
        error instanceof Error &&
        error.message === 'REGISTRATION_CEP_NOT_FOUND'
          ? 'CEP não encontrado. Confira o número ou preencha o endereço manualmente.'
          : 'Não foi possível consultar o CEP. Você pode tentar novamente ou preencher o endereço manualmente.',
      )
    } finally {
      window.clearTimeout(timeout)

      if (requestVersion === cepRequestVersion.current) {
        cepController.current = null
        setCepBusy(false)
      }
    }
  }

      function changeField(
    name: keyof AcademyRegistrationInput,
    value: string,
  ) {
    let formattedValue = value

    switch (name) {
      case 'cnpj':
        formattedValue = formatCnpj(value)
        break

      case 'telefone':
        formattedValue = formatTelephone(value)
        break

      case 'cep':
        formattedValue = formatCep(value)
        break

      case 'uf':
        formattedValue = formatUf(value)
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

    setFields((previous) => ({
      ...previous,
      [name]: formattedValue,
    }))

    setErrorMessage(null)

    if (
      name === 'cep' &&
      /^\d{5}-\d{3}$/.test(formattedValue)
    ) {
      void searchCep(formattedValue)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

        if (running.current || cepBusy) {
      return
    }

    cancelCepLookup()

    running.current = true
    setBusy(true)
    setErrorMessage(null)

    try {
      await registerAcademy({
        ...fields,
        email,
        password,
        confirmPassword,
      })
    } catch (error) {
      setErrorMessage(registrationErrorMessage(error))
      return
    } finally {
      running.current = false
      setBusy(false)
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmation(false)
    }

    onComplete()
  }

  return (
    <main className="dev-page">
      <section className="dev-panel">
        <p className="dev-label">OKAN · DEV local</p>

        <h1>Cadastre sua academia</h1>

        <p>
          Cadastre a academia e prepare o acesso do gestor ao painel web.
        </p>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-busy={busy}
        >
          <h2>Dados da academia</h2>

          {academyFields.map((field) => (
            <div className="auth-form" key={field.name}>
              <label htmlFor={`register-${field.name}`}>
                {field.label}
              </label>

              <input
                id={`register-${field.name}`}
                name={field.name}
                type={field.type}
                inputMode={
                  field.name === 'cnpj' || field.name === 'cep'
                    ? 'numeric'
                    : field.name === 'telefone'
                      ? 'tel'
                      : 'text'
                }
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                required
                disabled={busy || cepBusy}
                value={fields[field.name]}
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
                      busy ||
                      cepBusy ||
                      !/^\d{5}-\d{3}$/.test(fields.cep)
                    }
                    onClick={() => {
                      void searchCep(fields.cep)
                    }}
                  >
                    {cepBusy ? 'Buscando...' : 'Buscar endereço'}
                  </button>

                  {cepMessage && (
                    <p role="status">{cepMessage}</p>
                  )}
                </>
              )}
            </div>
          ))}

          <h2>Acesso do gestor</h2>

          <label htmlFor="register-admin-name">Nome do gestor</label>

          <input
            id="register-admin-name"
            name="adminName"
            type="text"
            autoComplete="name"
            required
            disabled={busy}
            value={fields.adminName}
            onChange={(event) => {
              changeField('adminName', event.target.value)
            }}
          />

          <label htmlFor="register-email">E-mail</label>

          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={busy}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrorMessage(null)
            }}
          />

          <label htmlFor="register-password">Senha</label>

          <input
            id="register-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={6}
            required
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button
            className="auth-button auth-button-secondary"
            type="button"
            disabled={busy}
            aria-controls="register-password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((previous) => !previous)}
          >
            {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          </button>

          <label htmlFor="register-confirm-password">
            Confirmar senha
          </label>

          <input
            id="register-confirm-password"
            name="confirmPassword"
            type={showConfirmation ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={6}
            required
            disabled={busy}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value)
            }}
          />

          <button
            className="auth-button auth-button-secondary"
            type="button"
            disabled={busy}
            aria-controls="register-confirm-password"
            aria-pressed={showConfirmation}
            onClick={() => {
              setShowConfirmation((previous) => !previous)
            }}
          >
            {showConfirmation
              ? 'Ocultar confirmação'
              : 'Mostrar confirmação'}
          </button>

          <button
            className="auth-button"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Concluindo cadastro...' : 'Cadastrar academia'}
          </button>

          <button
            className="auth-button auth-button-secondary"
            type="button"
            disabled={busy}
            onClick={onBack}
          >
            Voltar
          </button>
        </form>

        {errorMessage && (
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        )}
      </section>
    </main>
  )
}

export default AcademyRegistrationPage