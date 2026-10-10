// Finds research, MCP servers, repos, tools and legal resources relevant to a project.
// Everything fetched here is third-party content: treat the report as leads to vet, not advice.

export type SourceKind = 'awesome-list' | 'reference'
export type Category = 'research' | 'mcp' | 'repos' | 'coding-tools' | 'legal' | 'books' | 'harness'

export interface CatalogSource {
  id: string
  /** GitHub owner/repo whose README is parsed. */
  repo: string
  kind: SourceKind
  categories: Category[]
  note: string
}

export const CATALOG: CatalogSource[] = [
  {
    id: 'opensource-ai',
    repo: 'alvinreal/awesome-opensource-ai',
    kind: 'awesome-list',
    categories: ['repos', 'research'],
    note: 'Open-source AI models, frameworks and projects',
  },
  {
    id: 'ai-coding-tools',
    repo: 'ai-for-developers/awesome-ai-coding-tools',
    kind: 'awesome-list',
    categories: ['coding-tools'],
    note: 'AI coding assistants and developer tools',
  },
  {
    id: 'lit',
    repo: 'camoverride/lit',
    kind: 'awesome-list',
    categories: ['books', 'research'],
    note: 'Technical books for the self-taught AI practitioner',
  },
  {
    id: 'awesome-ai',
    repo: 'owainlewis/awesome-artificial-intelligence',
    kind: 'awesome-list',
    categories: ['research', 'repos'],
    note: 'General AI courses, books, papers and tools',
  },
  {
    id: 'ecc',
    repo: 'affaan-m/ecc',
    kind: 'reference',
    categories: ['harness'],
    note: 'Agent harness configuration: agents, skills, hooks, commands',
  },
  {
    id: 'mcp-servers',
    repo: 'punkpeye/awesome-mcp-servers',
    kind: 'awesome-list',
    categories: ['mcp'],
    note: 'Community MCP server list',
  },
  {
    id: 'lawglance',
    repo: 'lawglance/lawglance',
    kind: 'reference',
    categories: ['legal'],
    note: 'Open-source legal assistant (RAG)',
  },
  {
    id: 'olaw',
    repo: 'harvard-lil/olaw',
    kind: 'reference',
    categories: ['legal'],
    note: 'Harvard LIL Open Legal AI Workbench: tool-based legal RAG',
  },
  {
    id: 'legal-skills',
    repo: 'lawve-ai/awesome-legal-skills',
    kind: 'awesome-list',
    categories: ['legal'],
    note: 'Agent skills for legal work',
  },
  // Additions
  {
    id: 'mcp-reference',
    repo: 'modelcontextprotocol/servers',
    kind: 'awesome-list',
    categories: ['mcp'],
    note: 'Official MCP reference servers and community links',
  },
  {
    id: 'awesome-claude-code',
    repo: 'hesreallyhim/awesome-claude-code',
    kind: 'awesome-list',
    categories: ['harness', 'coding-tools'],
    note: 'Claude Code commands, hooks, skills and workflows',
  },
  {
    id: 'anthropic-skills',
    repo: 'anthropics/skills',
    kind: 'reference',
    categories: ['harness'],
    note: 'Example Agent Skills from Anthropic',
  },
]

export interface Entry {
  name: string
  url: string
  description: string
  section: string
  source: string
  score?: number
}

export interface Lead {
  title: string
  url: string
  detail: string
  source: string
}

export type TextFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<string>

export const defaultFetch: TextFetch = async (url, init) => {
  const response = await fetch(url, {
    headers: { 'user-agent': 'agent-discovery', ...init?.headers },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  return response.text()
}

/** Parses `- [Name](url) - description` style lines, remembering the nearest heading. */
export function parseAwesomeList(markdown: string, source: string): Entry[] {
  const entries: Entry[] = []
  let section = ''
  for (const line of markdown.split('\n')) {
    const heading = /^#{1,6}\s+(.+)$/.exec(line)
    if (heading) {
      section = heading[1]!.replace(/[*_`]|<[^>]+>|\[([^\]]*)\]\([^)]*\)/g, '$1').trim()
      continue
    }
    const item = /^\s*[-*+]\s+(?:\*\*)?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(?:\*\*)?\s*(.*)$/.exec(
      line,
    )
    if (!item) continue
    const description = item[3]!
      .replace(/^[\s\-–—:]+/, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim()
    if (/table of contents|contents|contributing|license/i.test(section) && !description) continue
    entries.push({ name: item[1]!.trim(), url: item[2]!, description, section, source })
  }
  return entries
}

const STOP = new Set(
  'the a an and or of to in for on with is it this that by from as at be are your you our we tool tools app project'.split(
    ' ',
  ),
)

export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/\.+$/, ''))
  return [...new Set(words.filter((w) => w.length > 2 && !STOP.has(w)))]
}

/** Scores entries by keyword overlap; name and section matches weigh more than descriptions. */
export function rankEntries(entries: Entry[], terms: string[], limit = 15): Entry[] {
  const seen = new Set<string>()
  return entries
    .map((entry) => {
      const name = entry.name.toLowerCase()
      const section = entry.section.toLowerCase()
      const description = entry.description.toLowerCase()
      let score = 0
      for (const term of terms) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        if (re.test(name)) score += 3
        if (re.test(section)) score += 2
        if (re.test(description)) score += 1
      }
      return { ...entry, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .filter((e) => {
      const key = e.url.replace(/\/$/, '').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

async function fetchReadme(repo: string, fetchText: TextFetch): Promise<string> {
  let lastError: unknown
  for (const file of ['README.md', 'readme.md', 'Readme.md', 'README.MD']) {
    try {
      return await fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/${file}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`No README for ${repo}`)
}

/** arXiv API (Atom). Free, no key. */
export async function searchArxiv(query: string, fetchText: TextFetch, limit = 8): Promise<Lead[]> {
  const q = encodeURIComponent(
    query
      .split(/\s+/)
      .slice(0, 6)
      .map((w) => `all:${w}`)
      .join(' AND '),
  )
  const xml = await fetchText(
    `https://export.arxiv.org/api/query?search_query=${q}&sortBy=relevance&max_results=${limit}`,
  )
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, body]) => {
    const tag = (name: string) =>
      (new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body!)?.[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim()
    return {
      title: tag('title'),
      url: tag('id'),
      detail: tag('published').slice(0, 10),
      source: 'arXiv',
    }
  })
}

/** Official MCP Registry. Free, no key. */
export async function searchMcpRegistry(
  query: string,
  fetchText: TextFetch,
  limit = 10,
): Promise<Lead[]> {
  const json = JSON.parse(
    await fetchText(
      `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(query)}&limit=${limit}`,
    ),
  ) as {
    servers?: Array<{
      server: { name: string; description?: string; repository?: { url?: string } }
    }>
  }
  return (json.servers ?? []).map(({ server }) => ({
    title: server.name,
    url:
      server.repository?.url ??
      `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(server.name)}`,
    detail: server.description ?? '',
    source: 'MCP Registry',
  }))
}

/** GitHub repository search. Uses GITHUB_TOKEN when set (unauthenticated calls are tightly rate limited). */
export async function searchGithub(
  query: string,
  fetchText: TextFetch,
  token?: string,
  limit = 10,
): Promise<Lead[]> {
  const json = JSON.parse(
    await fetchText(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`,
      {
        headers: {
          accept: 'application/vnd.github+json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
    ),
  ) as {
    items?: Array<{
      full_name: string
      html_url: string
      description: string | null
      stargazers_count: number
      pushed_at: string
    }>
  }
  return (json.items ?? []).map((r) => ({
    title: r.full_name,
    url: r.html_url,
    detail: `★${r.stargazers_count} · pushed ${r.pushed_at.slice(0, 10)} · ${r.description ?? ''}`,
    source: 'GitHub',
  }))
}

export interface DiscoveryOptions {
  description: string
  categories?: Category[]
  perSource?: number
  fetchText?: TextFetch
  githubToken?: string
  /** Skip the live search APIs (arXiv, MCP Registry, GitHub). */
  offline?: boolean
}

export interface DiscoveryReport {
  description: string
  terms: string[]
  bySource: Array<{ source: CatalogSource; entries: Entry[]; error?: string }>
  live: Array<{ name: string; leads: Lead[]; error?: string }>
}

export async function discover(options: DiscoveryOptions): Promise<DiscoveryReport> {
  const fetchText = options.fetchText ?? defaultFetch
  const terms = keywords(options.description)
  const sources = CATALOG.filter(
    (s) => !options.categories || s.categories.some((c) => options.categories!.includes(c)),
  )
  const settle = async <T>(work: () => Promise<T>): Promise<{ value?: T; error?: string }> => {
    try {
      return { value: await work() }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }

  const bySource = await Promise.all(
    sources.map(async (source) => {
      const result = await settle(() => fetchReadme(source.repo, fetchText))
      if (result.error !== undefined) return { source, entries: [], error: result.error }
      const parsed = parseAwesomeList(result.value!, source.id)
      return { source, entries: rankEntries(parsed, terms, options.perSource ?? 10) }
    }),
  )

  const query = terms.slice(0, 5).join(' ')
  const live: DiscoveryReport['live'] = []
  if (!options.offline && query) {
    const searches: Array<[string, () => Promise<Lead[]>]> = [
      ['Papers (arXiv)', () => searchArxiv(query, fetchText)],
      ['MCP Registry', () => searchMcpRegistry(terms.slice(0, 2).join(' '), fetchText)],
      [
        'GitHub repositories',
        () => searchGithub(terms.slice(0, 4).join(' '), fetchText, options.githubToken),
      ],
    ]
    for (const [name, run] of searches) {
      const result = await settle(run)
      live.push({ name, leads: result.value ?? [], error: result.error })
    }
  }
  return { description: options.description, terms, bySource, live }
}

const clean = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 200)

export function renderReport(report: DiscoveryReport, generatedAt = new Date()): string {
  const lines = [
    '# Discovery report',
    '',
    `Generated ${generatedAt.toISOString().slice(0, 10)} for: _${clean(report.description)}_`,
    '',
    `Keywords: ${report.terms.slice(0, 15).join(', ') || '(none)'}`,
    '',
    '> Third-party listings, not endorsements. Before adopting anything, check its licence, maintenance,',
    '> security (especially MCP servers, which run with your credentials) and terms of use.',
    '',
  ]
  for (const { name, leads, error } of report.live) {
    lines.push(`## ${name}`, '')
    if (error) lines.push(`_Unavailable: ${clean(error)}_`, '')
    else if (!leads.length) lines.push('_No matches._', '')
    else for (const l of leads) lines.push(`- [${clean(l.title)}](${l.url}) ${clean(l.detail)}`)
    lines.push('')
  }
  lines.push('## Curated lists', '')
  for (const { source, entries, error } of report.bySource) {
    lines.push(
      `### [${source.repo}](https://github.com/${source.repo}) (${source.categories.join(', ')})`,
      '',
      source.note,
      '',
    )
    if (error) lines.push(`_Could not fetch: ${clean(error)}_`)
    else if (!entries.length)
      lines.push(
        source.kind === 'reference'
          ? '_Reference project: browse directly._'
          : '_No keyword matches._',
      )
    else
      for (const e of entries)
        lines.push(
          `- [${clean(e.name)}](${e.url})${e.section ? ` (${clean(e.section)})` : ''}${e.description ? `: ${clean(e.description)}` : ''}`,
        )
    lines.push('')
  }
  return lines.join('\n')
}
