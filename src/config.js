import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const defaults = {
  defaultCv: 'general',
  output: { dir: 'dist', filenamePrefix: '' },
  layout: { maxPages: 2 },
  server: { host: '127.0.0.1', port: 3000 }
}

const readUserConfig = () => {
  try {
    return JSON.parse(readFileSync(join(root, 'cv.config.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw new Error(`Invalid cv.config.json: ${error.message}`)
  }
}

const user = readUserConfig()

export const config = {
  defaultCv: user.defaultCv ?? defaults.defaultCv,
  output: { ...defaults.output, ...user.output },
  layout: { ...defaults.layout, ...user.layout },
  server: { ...defaults.server, ...user.server }
}

const sanitize = (value) => value.replace(/[\\/:*?"<>|]+/g, '-')

export const outputDir = isAbsolute(config.output.dir) ? config.output.dir : join(root, config.output.dir)
export const outputFileName = (name) => `${sanitize(config.output.filenamePrefix)}${name}.pdf`
