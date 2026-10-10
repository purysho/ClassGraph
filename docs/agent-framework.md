# Agent framework (`src/agent`)

A small, dependency-light agent framework (only `zod`, already a project dependency). Every
module is independent and tested with a scripted provider, so nothing needs network or keys.

| Area           | Module                                | What it gives you                                                                                                                                                                                                                |
| -------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Harness        | `harness.ts`                          | `Agent.run()`: model ↔ tool loop, input validation, timeouts, parallel read-only tools, stop reasons, events                                                                                                                     |
| Providers      | `providers.ts`                        | `AnthropicProvider` (fetch, prompt caching), `withRetry` (429/5xx backoff), `ScriptedProvider` for tests                                                                                                                         |
| Tools          | `tools.ts`                            | `defineTool` with zod schemas → JSON Schema, `ToolRegistry`, `selectTools` (send only relevant schemas)                                                                                                                          |
| Multi-agent    | `orchestrator.ts`, `concurrency.ts`   | planner → workers in dependency waves with a concurrency cap → synthesizer                                                                                                                                                       |
| Cost cutting   | `budget.ts`, `cache.ts`, `context.ts` | shared `Budget` ceilings (cost/tokens/turns/time), `ModelRouter` (cheap-first, escalate on failure, downshift under budget pressure), exact response cache, prompt caching, model-free context compaction, tool-subset selection |
| Research       | `research.ts`                         | `webSearchTool` / `fetchUrlTool` adapters for any backend, SSRF and host allow/deny checks, researcher prompt, `uncitedSources` citation check                                                                                   |
| Legal & safety | `safety.ts`                           | per-tool allow/ask/deny policy by risk level, human approval hook, audit log, prompt-injection flagging and `<untrusted>` wrapping, secret/PII redaction                                                                         |
| Auto-review    | `review.ts`                           | generate → review → revise loop with JSON verdicts, cheap deterministic checks first, optional model escalation                                                                                                                  |
| Observability  | `trace.ts`                            | `Tracer` collecting events: model calls, tool latency and failures, usage per agent                                                                                                                                              |
| Evals          | `evals.ts`                            | regression suite to confirm an optimisation is cheaper _without_ being worse                                                                                                                                                     |

## Example

```ts
import {
  Agent,
  AnthropicProvider,
  Budget,
  ModelRouter,
  SafetyGuard,
  ToolRegistry,
  Tracer,
  webSearchTool,
  fetchUrlTool,
  withResponseCache,
  withRetry,
  RESEARCHER_SYSTEM,
  reviewLoop,
  REVIEWER_SYSTEM,
} from './agent/index.js'

const provider = withResponseCache(
  withRetry(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })),
)
const budget = new Budget(
  { maxCostUsd: 2, maxTurns: 60 },
  PRICES /* USD per MTok, from the pricing page */,
)
const router = new ModelRouter([
  { model: 'claude-haiku-5-5', rank: 1 },
  { model: 'claude-sonnet-5-5', rank: 2 },
  { model: 'claude-opus-5-5', rank: 3 },
])
const tracer = new Tracer()
const guard = new SafetyGuard({ approve: async (req) => askHuman(req) })

const researcher = new Agent({
  name: 'researcher',
  system: RESEARCHER_SYSTEM,
  provider,
  model: router,
  budget,
  guard,
  tools: new ToolRegistry([webSearchTool(mySearch), fetchUrlTool(myFetch)]),
  redactOutbound: true,
  compaction: { maxTokens: 60_000 },
  onEvent: tracer.handle,
})
const reviewer = new Agent({
  name: 'reviewer',
  system: REVIEWER_SYSTEM,
  provider,
  model: 'claude-haiku-5-5',
  budget,
})

const result = await reviewLoop('Compare X and Y', { worker: researcher, reviewer, escalate: true })
console.log(result.final.text, budget.costUsd, tracer.summary())
```

## Credit-cutting checklist

1. **Route by difficulty**: most steps don't need the largest model.
2. **Prompt caching**: stable system prompt and tool list first (on by default).
3. **Send fewer tool schemas**: `selectTools` picks the top-k relevant tools.
4. **Compact context**: clip old tool output before dropping turns.
5. **Cache identical calls**: `withResponseCache`, which suits evals and retries.
6. **Hard ceilings**: one `Budget` shared across every agent in a run.
7. **Cheap checks before LLM review**: `checks` in `reviewLoop`.
8. **Measure**: `runEvals` before and after each change.

## Not built yet (suggested next steps)

- Persistent memory / vector store and an embedding-based `selectTools`
- Streaming responses and token-level cancellation
- Durable run state (checkpoint / resume) and a job queue for long multi-agent runs
- MCP client adapter so MCP servers register as `Tool`s
- Sandboxed code-execution tool (container or VM)
- Batch API path for non-urgent work (large discount on cost)
- robots.txt / site terms checks for `fetch_url`, audit log retention and export, licence tracking for sources
- A model-based injection classifier to back up the regex heuristics
- CLI / UI to inspect traces and approve `ask` decisions

## Discovery: finding research, MCP servers, repos and tools

`discovery.ts` builds a report of resources that fit a project. It ranks entries from curated
lists by keyword match against the project's README and `package.json`, and also queries live
sources.

- **Curated lists** (`CATALOG`):
  - alvinreal/awesome-opensource-ai
  - ai-for-developers/awesome-ai-coding-tools
  - camoverride/lit
  - owainlewis/awesome-artificial-intelligence
  - affaan-m/ecc
  - punkpeye/awesome-mcp-servers
  - lawglance/lawglance
  - harvard-lil/olaw
  - lawve-ai/awesome-legal-skills
  - Also added: modelcontextprotocol/servers, hesreallyhim/awesome-claude-code, anthropics/skills
- **Live search:**
  - arXiv API for papers
  - the official MCP Registry
  - GitHub repository search (set `GITHUB_TOKEN`; unauthenticated calls are heavily rate limited)

How it runs:

- **Automatically:** `.claude/settings.json` registers a `SessionStart` hook. On a project's first
  session, if `docs/DISCOVERY.md` doesn't exist, the hook builds the report in the background.
- **Manually:** `/discover [categories | description]` refreshes the report and asks Claude to add
  vetted recommendations.
- **From the CLI:** `npm run discover -- [--category mcp,legal] [--offline] [--out path] ["description"]`.

To use it in every new project, copy `.claude/` and `src/agent/` into your project template.
You can also point a user-level `SessionStart` hook in `~/.claude/settings.json` at the bundled
`dist/discover.mjs`; that file is a single self-contained bundle with no dependencies.

Everything in the report is third-party content. Vet licences, maintenance and security before
adopting anything, and take particular care with MCP servers.
