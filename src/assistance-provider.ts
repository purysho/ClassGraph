import {
  parseAssistanceProposal,
  parseAssistanceRequestEnvelope,
  type AssistanceProposal,
  type AssistanceRequestEnvelope,
} from './assistance-contract.js'

export interface AssistanceProviderStatus {
  enabled: boolean
  mode: 'network'
  label?: string
  endpointHost?: string
}

export interface AssistanceProvider {
  readonly label: string
  readonly mode: 'network'
  status(): AssistanceProviderStatus
  execute(
    request: AssistanceRequestEnvelope,
    options: { confirmed: boolean },
  ): Promise<AssistanceProposal>
}

export interface JsonHttpsProviderOptions {
  label: string
  endpoint: string
  token?: string
  timeoutMs?: number
  maxResponseBytes?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024

async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('CG-6009 assistance provider response exceeded the size limit')
  }

  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let output = ''

  while (true) {
    const result = await reader.read()
    if (result.done) break
    total += result.value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('CG-6009 assistance provider response exceeded the size limit')
    }
    output += decoder.decode(result.value, { stream: true })
  }
  output += decoder.decode()
  return output
}

export class JsonHttpsAssistanceProvider implements AssistanceProvider {
  readonly label: string
  readonly mode = 'network' as const
  private readonly endpoint: URL
  private readonly token?: string
  private readonly timeoutMs: number
  private readonly maxResponseBytes: number
  private readonly fetchImpl: typeof fetch

  constructor(options: JsonHttpsProviderOptions) {
    this.label = options.label.trim()
    if (!this.label) throw new Error('CG-6006 assistance provider label is required')

    this.endpoint = new URL(options.endpoint)
    if (this.endpoint.protocol !== 'https:') {
      throw new Error('CG-6006 assistance provider endpoint must use HTTPS')
    }

    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  status(): AssistanceProviderStatus {
    return {
      enabled: true,
      mode: 'network',
      label: this.label,
      endpointHost: this.endpoint.host,
    }
  }

  async execute(
    requestValue: AssistanceRequestEnvelope,
    options: { confirmed: boolean },
  ): Promise<AssistanceProposal> {
    if (!options.confirmed) {
      throw new Error('CG-6007 explicit confirmation is required before sending assistance context')
    }

    const request = parseAssistanceRequestEnvelope(requestValue)
    if (request.disclosure.mode !== 'network') {
      throw new Error('CG-6007 network provider received a non-network assistance request')
    }
    if (request.disclosure.providerLabel !== this.label) {
      throw new Error('CG-6008 assistance request provider label does not match configured provider')
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }
      if (this.token) headers.Authorization = `Bearer ${this.token}`

      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`CG-6009 assistance provider returned HTTP ${response.status}`)
      }

      const text = await readCappedText(response, this.maxResponseBytes)
      let json: unknown
      try {
        json = JSON.parse(text) as unknown
      } catch {
        throw new Error('CG-6008 assistance provider returned invalid JSON')
      }

      const proposal = parseAssistanceProposal(json)
      if (proposal.requestId !== request.requestId || proposal.task !== request.task) {
        throw new Error('CG-6008 assistance provider response does not match the request')
      }
      return proposal
    } catch (error) {
      if (error instanceof Error && /^CG-600[789]/.test(error.message)) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('CG-6009 assistance provider request timed out')
      }
      throw new Error('CG-6009 assistance provider request failed')
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createEnvironmentAssistanceProvider(
  environment: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): AssistanceProvider | undefined {
  const endpoint = environment.CLASSGRAPH_ASSISTANCE_URL?.trim()
  const label = environment.CLASSGRAPH_ASSISTANCE_PROVIDER_LABEL?.trim()
  if (!endpoint || !label) return undefined

  return new JsonHttpsAssistanceProvider({
    endpoint,
    label,
    token: environment.CLASSGRAPH_ASSISTANCE_TOKEN,
    fetchImpl,
  })
}
