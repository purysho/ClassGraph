// Usage: npm run discover -- [--out path] [--offline] [--category mcp,legal] ["project description"]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { discover, renderReport, type Category } from './discovery.js'

function projectDescription(): string {
  const parts: string[] = []
  if (existsSync('package.json')) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      description?: string
      keywords?: string[]
    }
    parts.push(pkg.description ?? '', ...(pkg.keywords ?? []))
  }
  for (const file of ['README.md', 'readme.md', 'pyproject.toml', 'CLAUDE.md']) {
    if (existsSync(file)) {
      parts.push(
        readFileSync(file, 'utf8')
          .replace(/<[^>]+>|!\[[^\]]*\]\([^)]*\)|https?:\S+/g, ' ')
          .slice(0, 1500),
      )
      break
    }
  }
  return parts.join(' ').trim()
}

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args.splice(i, 2)[1] : undefined
}
const out = flag('--out') ?? 'docs/DISCOVERY.md'
const categories = flag('--category')?.split(',') as Category[] | undefined
const offline = args.includes('--offline')
const description = args.filter((a) => !a.startsWith('--')).join(' ') || projectDescription()

if (!description) {
  console.error('No project description: pass one as an argument or add a README/package.json.')
  process.exit(1)
}
const report = await discover({
  description,
  categories,
  offline,
  githubToken: process.env.GITHUB_TOKEN,
})
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, renderReport(report))
const failed =
  report.bySource.filter((s) => s.error).length + report.live.filter((l) => l.error).length
console.log(
  `Discovery report written to ${out}${failed ? ` (${failed} source(s) unavailable)` : ''}`,
)
