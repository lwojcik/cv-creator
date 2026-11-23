import Ajv from 'ajv'
import { readFileSync, statSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config, outputDir, outputFileName } from './config.js'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const dataDir = join(root, 'data')
export const distDir = outputDir

const schemaFile = join(root, 'schema/cv.schema.json')
let cached = { mtime: 0 }

const loadSchema = () => {
  const { mtimeMs } = statSync(schemaFile)
  if (mtimeMs !== cached.mtime) {
    const schema = JSON.parse(readFileSync(schemaFile, 'utf8'))
    cached = { mtime: mtimeMs, schema, validator: new Ajv({ allErrors: true }).compile(schema) }
  }
  return cached
}

export const getSchema = () => loadSchema().schema

export const validate = (cv) => {
  const { validator } = loadSchema()
  const valid = validator(cv)
  const errors = (validator.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`)
  return { valid, errors }
}

const namePattern = /^[\w-]+$/

export const cvPath = (name) => {
  if (!namePattern.test(name)) throw new Error(`Invalid CV name: ${name}`)
  return join(dataDir, `${name}.json`)
}

export const pdfPath = (name) => join(distDir, outputFileName(name))

export const listCvs = async () => {
  const files = await readdir(dataDir).catch((error) => (error.code === 'ENOENT' ? [] : Promise.reject(error)))
  return files.filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5)).sort()
}

export const defaultCvName = async () => {
  const names = await listCvs()
  return names.includes(config.defaultCv) ? config.defaultCv : (names.includes('sample') ? 'sample' : names[0] ?? config.defaultCv)
}

export const readCv = async (name) => JSON.parse(await readFile(cvPath(name), 'utf8'))

export const writeCv = async (name, cv) => {
  await mkdir(dataDir, { recursive: true })
  await writeFile(cvPath(name), `${JSON.stringify(cv, null, 2)}\n`)
}

const isFilePath = (arg) => arg.endsWith('.json') || /[\\/]/.test(arg)

export const loadCv = async (arg) => {
  if (!isFilePath(arg)) return { name: arg, file: cvPath(arg), cv: await readCv(arg) }
  const file = resolve(arg)
  let cv
  try {
    cv = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`)
  }
  return { name: basename(file, '.json'), file, cv }
}
