const linux = require('./electron-builder.linux.cjs')
const dev = require('./electron-builder.dev.cjs')

// The dev overrides carry the shared build block, so they are layered on top of
// the Linux base; the Linux resource filtering and afterPack still win.
module.exports = {
  ...linux,
  ...dev,
  extraResources: linux.extraResources,
  afterPack: linux.afterPack
}