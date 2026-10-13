const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { verifyAsarUnpack } = require('./verify-asar-unpack.cjs')
const { verifyOfficeRuntime } = require('./verify-office-runtime.cjs')

const execFileAsync = promisify(execFile)

/**
 * electron-builder afterPack for Linux.
 *
 * Runs the same three gates as scripts/after-pack.cjs. The only platform
 * difference is the executable lookup: Windows uses `<product>.exe`, macOS the
 * Helper app, and Linux the binary named after the package.
 *
 * The Office authoring stack is verified end to end. Its LibreOffice rendering
 * half is not, because @deepseek-ai/libreoffice-kit publishes no Linux build at
 * any version, so this hook asserts that documented unavailability instead of
 * letting the shared gate fail on a capability upstream does not ship here.
 */
module.exports = async function afterPack(context) {
  const resources = path.join(context.appOutDir, 'resources')
  verifyAsarUnpack(resources)

  // productFilename follows productName ("DSH Desktop"); the Linux executable
  // is named after the package instead, so ask the packager rather than guess.
  const executable = path.join(
    context.appOutDir,
    context.packager.executableName || context.packager.appInfo.productFilename
  )
  if (!fs.existsSync(executable)) throw new Error('Cannot locate the packaged Electron executable')

  const appRoot = [path.join(resources, 'app.asar'), path.join(resources, 'app')].find(candidate =>
    fs.existsSync(candidate)
  )
  if (!appRoot) throw new Error('Cannot locate the packaged application runtime')

  await execFileAsync(
    executable,
    [path.join(__dirname, 'verify-packaged-ppt-runtime.cjs'), '--verify-runtime', appRoot],
    {
      cwd: path.dirname(appRoot),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    }
  )
  await verifyOfficeRuntime(resources, executable, undefined, { engine: 'absent' })

  // Pin the known gap: if a Linux LibreOfficeKit build ever ships, this fails and
  // the gate above can be switched back to the full conversion check. The CLI
  // reports an unavailable engine as a non-zero exit with JSON on stderr.
  let capabilities
  try {
    const { stdout } = await execFileAsync(
      executable,
      [path.join(resources, 'office-cli.mjs'), 'capabilities', '--json'],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 120_000 }
    )
    capabilities = JSON.parse(stdout)
  } catch (error) {
    capabilities = JSON.parse(String(error.stderr ?? ''))
  }
  if (capabilities?.code !== 'unavailable' || !/libreoffice-kit-linux/.test(capabilities.error ?? '')) {
    throw new Error(`Unexpected LibreOffice capability on Linux: ${JSON.stringify(capabilities)}`)
  }
  console.log(
    'Linux packaging: asar/native separation, PPT runtime and Office authoring verified; ' +
      'LibreOffice PDF conversion unavailable (no upstream Linux engine)'
  )
}