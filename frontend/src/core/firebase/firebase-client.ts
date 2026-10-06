import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'

import { connectAuthEmulator, getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'

import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

import {
  connectFunctionsEmulator,
  getFunctions,
} from 'firebase/functions'
import type { Functions } from 'firebase/functions'

import {
  assertDevEnvironment,
  devEnvironment,
} from '../config/dev-environment'

export interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
  firestore: Firestore
  functions: Functions
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

  const firestore = getFirestore(app)

  connectFirestoreEmulator(
    firestore,
    devEnvironment.host,
    devEnvironment.ports.firestore,
  )

  const functions = getFunctions(
    app,
    devEnvironment.functionsRegion,
  )

  connectFunctionsEmulator(
    functions,
    devEnvironment.host,
    devEnvironment.ports.functions,
  )

  client = {
    app,
    auth,
    firestore,
    functions,
  }

  return client
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.firebaseClient = client
  })
}