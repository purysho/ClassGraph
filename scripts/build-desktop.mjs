import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const work = resolve(root, '.desktop-build')
const release = resolve(root, 'release')
const bundle = resolve(work, 'classgraph-desktop.cjs')
const blob = resolve(work, 'classgraph-sea.blob')
const configPath = resolve(work, 'sea-config.json')
const iconSource = resolve(work, 'classgraph-icon.png')
const windowsIcon = resolve(work, 'classgraph-icon.ico')

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`)
  }
}

function npx(packageSpec, args) {
  const npmExecPath = process.env.npm_execpath
  if (!npmExecPath) {
    throw new Error('npm_execpath is required to locate npx-cli.js')
  }
  const npxCli = resolve(dirname(npmExecPath), 'npx-cli.js')
  run(process.execPath, [npxCli, '--yes', packageSpec, ...args])
}

function outputName() {
  const platform =
    process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : process.arch
  return `ClassGraph-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`
}

async function prepareIconAssets() {
  const encoded = await readFile(resolve(root, 'build/classgraph-icon.png.b64'), 'utf8')
  const png = Buffer.from(encoded.trim(), 'base64')
  if (png.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('ClassGraph icon source is not a valid PNG.')
  }

  await writeFile(iconSource, png)

  // ICO supports PNG-compressed image entries. A single 256×256 entry is enough for
  // Windows Explorer/shortcuts while keeping the checked-in source asset simple.
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header.writeUInt8(0, 6)
  header.writeUInt8(0, 7)
  header.writeUInt8(0, 8)
  header.writeUInt8(0, 9)
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(png.length, 14)
  header.writeUInt32LE(header.length, 18)
  await writeFile(windowsIcon, Buffer.concat([header, png]))
}

async function applyWindowsBranding(output, version) {
  const branded = resolve(work, 'ClassGraph-branded.exe')
  npx('resedit-cli@3.1.1', [
    output,
    branded,
    '--ignore-signed',
    '--icon',
    `1,${windowsIcon}`,
    '--product-name',
    'ClassGraph',
    '--file-description',
    'ClassGraph local-first classroom analysis and planning',
    '--internal-name',
    'ClassGraph',
    '--original-filename',
    'ClassGraph-Windows-x64.exe',
    '--file-version',
    `${version}.0`,
    '--product-version',
    `${version}.0`,
  ])
  await rm(output, { force: true })
  await rename(branded, output)
}

async function setWindowsGuiSubsystem(output) {
  const executable = await readFile(output)
  if (executable.length < 0x100 || executable.readUInt16LE(0) !== 0x5a4d) {
    throw new Error('ClassGraph Windows output is not a valid PE executable.')
  }

  const peOffset = executable.readUInt32LE(0x3c)
  if (executable.subarray(peOffset, peOffset + 4).toString('binary') !== 'PE\0\0') {
    throw new Error('ClassGraph Windows output is missing the PE signature.')
  }

  const optionalHeaderOffset = peOffset + 24
  const magic = executable.readUInt16LE(optionalHeaderOffset)
  if (magic !== 0x10b && magic !== 0x20b) {
    throw new Error('ClassGraph Windows output has an unsupported PE optional header.')
  }

  const subsystemOffset = optionalHeaderOffset + 68
  executable.writeUInt16LE(2, subsystemOffset)
  await writeFile(output, executable)

  const verified = await readFile(output)
  if (verified.readUInt16LE(subsystemOffset) !== 2) {
    throw new Error('ClassGraph Windows GUI subsystem patch did not persist.')
  }
}

if (!['win32', 'darwin', 'linux'].includes(process.platform)) {
  throw new Error(`Unsupported desktop build platform: ${process.platform}`)
}
if (!['x64', 'arm64'].includes(process.arch)) {
  throw new Error(`Unsupported desktop build architecture: ${process.arch}`)
}

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const version = String(packageJson.version)

await rm(work, { recursive: true, force: true })
await rm(release, { recursive: true, force: true })
await mkdir(work, { recursive: true })
await mkdir(release, { recursive: true })
await prepareIconAssets()

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

if (process.platform === 'win32') {
  await applyWindowsBranding(output, version)
}

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

if (process.platform === 'win32') {
  await setWindowsGuiSubsystem(output)
}

if (process.platform === 'darwin') {
  run('codesign', ['--force', '--sign', '-', output])
}

if (process.platform !== 'win32') {
  await chmod(output, 0o755)
}

console.log(output)
