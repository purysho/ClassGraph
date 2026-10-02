import { createEnvironmentAssistanceProvider } from './assistance-provider.js'
import { createClassGraphServer } from './server.js'

const host = process.env.CLASSGRAPH_HOST ?? '127.0.0.1'
const requestedPort = Number(process.env.CLASSGRAPH_PORT ?? '4317')
const port = Number.isInteger(requestedPort) && requestedPort >= 0 ? requestedPort : 4317

const server = createClassGraphServer({
  assistanceProvider: createEnvironmentAssistanceProvider(),
})

server.listen(port, host, () => {
  const address = server.address()
  const resolvedPort = typeof address === 'object' && address ? address.port : port
  console.log(`ClassGraph is running locally at http://${host}:${resolvedPort}`)
  if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
    console.warn(
      'Warning: CLASSGRAPH_HOST exposes the app beyond this device. Use only on a trusted network.',
    )
  }
})
