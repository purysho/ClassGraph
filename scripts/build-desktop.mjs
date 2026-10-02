import { chmod, copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const work = resolve(root, '.desktop-build')
const release = resolve(root, 'release')
const bundle = resolve(work, 'classgraph-desktop.cjs')
const blob = resolve(work, 'classgraph-sea.blob')
const configPath = resolve(work, 'sea-config.json')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
}

function npx(packageSpec, args) {
  run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', packageSpec, ...args])
}

function outputName() {
  const platform =
    process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : process.arch
  return `ClassGraph-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`
}

if (!['win32', 'darwin', 'linux'].includes(process.platform)) {
  throw new Error(`Unsupported desktop build platform: ${process.platform}`)
}
if (!['x64', 'arm64'].includes(process.arch)) {
  throw new Error(`Unsupported desktop build architecture: ${process.arch}`)
}

await rm(work, { recursive: true, force: true })
await rm(release, { recursive: true, force: true })
await mkdir(work, { recursive: true })
await mkdir(release, { recursive: true })

npx('esbuild@0.28.2', [
  'src/desktop-main.ts',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  '--target=node22',
  `--outfile=${bundle}`,
])

const seaConfig = {
  main: bundle,
  output: blob,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: {
    'index.html': resolve(root, 'app/index.html'),
    'styles.css': resolve(root, 'app/styles.css'),
    'app.js': resolve(root, 'dist/app-client.js'),
  },
}
await writeFile(configPath, JSON.stringify(seaConfig, null, 2) + '\n')
run(process.execPath, ['--experimental-sea-config', configPath])

const output = resolve(release, outputName())
await copyFile(process.execPath, output)

if (process.platform === 'darwin') {
  run('codesign', ['--remove-signature', output])
}

const postjectArgs = [
  output,
  'NODE_SEA_BLOB',
  blob,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
]
if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA')
}
npx('postject@1.0.0-alpha.6', postjectArgs)

if (process.platform === 'darwin') {
  run('codesign', ['--force', '--sign', '-', output])
}

if (process.platform !== 'win32') {
  await chmod(output, 0o755)
}

console.log(output)
