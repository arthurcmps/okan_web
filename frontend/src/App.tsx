import { getFirebaseClient } from './core/firebase/firebase-client'
import { devEnvironment } from './core/config/dev-environment'
import './App.css'

type InitializationResult =
  | { success: true; projectId: string }
  | { success: false; message: string }

function initializeDevFirebase(): InitializationResult {
  try {
    const { app } = getFirebaseClient()

    return {
      success: true,
      projectId: app.options.projectId ?? devEnvironment.projectId,
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível configurar o ambiente.',
    }
  }
}

const initialization = initializeDevFirebase()

function App() {
  if (!initialization.success) {
    return (
      <main className="dev-page">
        <section className="dev-panel" role="alert">
          <h1>Ambiente indisponível</h1>
          <p>{initialization.message}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="dev-page">
      <section className="dev-panel">
        <p className="dev-label">OKAN · Desenvolvimento</p>

        <h1>Nova base web</h1>

        <p>Firebase configurado para os emuladores locais.</p>

        <dl className="dev-settings">
          <div>
            <dt>Projeto</dt>
            <dd>{initialization.projectId}</dd>
          </div>

          <div>
            <dt>Authentication</dt>
            <dd>
              {devEnvironment.host}:{devEnvironment.ports.auth}
            </dd>
          </div>

          <div>
            <dt>Firestore</dt>
            <dd>
              {devEnvironment.host}:{devEnvironment.ports.firestore}
            </dd>
          </div>

          <div>
            <dt>Functions</dt>
            <dd>
              {devEnvironment.host}:{devEnvironment.ports.functions}
            </dd>
          </div>

          <div>
            <dt>Região das funções</dt>
            <dd>{devEnvironment.functionsRegion}</dd>
          </div>
        </dl>

        <p className="dev-note">
          A disponibilidade dos serviços será verificada na próxima
          etapa, com o login e a consulta de vínculos.
        </p>
      </section>
    </main>
  )
}

export default App