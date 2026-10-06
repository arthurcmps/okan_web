import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'
import type { Functions } from 'firebase/functions'

import { devEnvironment } from '../config/dev-environment'
import { getFirebaseClient } from './firebase-client'

let functionsClient: Functions | undefined =
  import.meta.hot?.data.functionsClient

function getLocalFunctionsClient(): Functions {
  const { app } = getFirebaseClient()

  if (functionsClient) {
    return functionsClient
  }

  functionsClient = getFunctions(
    app,
    devEnvironment.functionsRegion,
  )

  connectFunctionsEmulator(
    functionsClient,
    devEnvironment.host,
    devEnvironment.ports.functions,
  )

  return functionsClient
}

export async function callDevFunction<Request, Response>(
  name: string,
  data: Request,
): Promise<Response> {
  const callable = httpsCallable<Request, Response>(
    getLocalFunctionsClient(),
    name,
    { timeout: 30000 },
  )

  const response = await callable(data)

  return response.data
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.functionsClient = functionsClient
  })
}