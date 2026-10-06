import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'

import { connectAuthEmulator, getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'

import {
  assertDevEnvironment,
  devEnvironment,
} from '../config/dev-environment'

export interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
}

let client: FirebaseClient | undefined =
  import.meta.hot?.data.firebaseClient

export function getFirebaseClient(): FirebaseClient {
  assertDevEnvironment(
    import.meta.env.DEV && import.meta.env.MODE === 'development',
    window.location.hostname,
  )

  if (client) {
    return client
  }

  const app = initializeApp(
    {
      apiKey: 'demo-key',
      projectId: devEnvironment.projectId,
      appId: 'demo-okan-web-dev',
    },
    'okan-web-dev',
  )

  const auth = getAuth(app)

  connectAuthEmulator(
    auth,
    `http://${devEnvironment.host}:${devEnvironment.ports.auth}`,
  )

  client = {
    app,
    auth,
  }

  return client
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.firebaseClient = client
  })
}