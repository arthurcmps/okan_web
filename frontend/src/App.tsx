import { getFirebaseClient } from './core/firebase/firebase-client'
import type { FirebaseClient } from './core/firebase/firebase-client'
import DevAuthPage from './features/auth/DevAuthPage'
import './App.css'

type InitializationResult =
  | { success: true; client: FirebaseClient }
  | { success: false; message: string }

function initializeDevFirebase(): InitializationResult {
  try {
    return {
      success: true,
      client: getFirebaseClient(),
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

  return <DevAuthPage auth={initialization.client.auth} />
}

export default App