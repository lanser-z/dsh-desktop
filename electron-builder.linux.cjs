const packageJson = require('./package.json')

// Linux now stages the same payloads as macOS and Windows: the Office runtime
// lock carries a linux-x64 target, and prepare-ppt-runtime.mjs is platform
// independent. The packaged gates stay on because scripts/after-pack.cjs
// resolves the Electron executable as `<product>.exe` or the macOS Helper, which
// never matches the Linux executable named after the package; only that
// executable lookup needs a platform-specific hook.
module.exports = {
  ...packageJson.build,
  afterPack: 'scripts/after-pack-linux.cjs'
}