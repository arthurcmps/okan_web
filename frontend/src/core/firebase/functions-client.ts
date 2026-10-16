import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions'
import type { Functions } from 'firebase/functions'

import { devEnvironment } from '../config/dev-environment'
import { getFirebaseClient } from './firebase-client'

const functionsClients: Map<string, Functions> =
  import.meta.hot?.data.functionsClients ?? new Map<string, Functions>()

function getLocalFunctionsClient(name: string): Functions {
  const { app } = getFirebaseClient()

  const region = name === 'iniciarAssinaturaAcademia' ||
    name === 'cancelarAssinaturaAcademia'
    ? 'us-central1'
    : devEnvironment.functionsRegion

  const existing = functionsClients.get(region)
  if (existing) return existing

  const client = getFunctions(app, region)

  connectFunctionsEmulator(
    client,
    devEnvironment.host,
    devEnvironment.ports.functions,
  )

  functionsClients.set(region, client)
  return client
}

export async function callDevFunction<Request, Response>(
  name: string,
  data: Request,
): Promise<Response> {
  const callable = httpsCallable<Request, Response>(
    getLocalFunctionsClient(name),
    name,
    { timeout: 30000 },
  )

  const response = await callable(data)
  return response.data
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.functionsClients = functionsClients
  })
}