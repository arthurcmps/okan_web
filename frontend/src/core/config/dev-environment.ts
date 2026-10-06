export function assertDevEnvironment(
  isDevelopment: boolean,
  hostname: string,
): void {
  const isLocalHost =
    hostname === '127.0.0.1' || hostname === 'localhost'

  if (!isDevelopment || !isLocalHost) {
    throw new Error(
      'Esta configuração Firebase está disponível somente no DEV local.',
    )
  }
}

export const devEnvironment = Object.freeze({
  projectId: 'demo-okan-dev',
  host: '127.0.0.1',
  functionsRegion: 'southamerica-east1',
  ports: Object.freeze({
    auth: 9099,
    firestore: 8080,
    functions: 5001,
  }),
})