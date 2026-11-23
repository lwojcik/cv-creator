import { listCvs, loadCv, validate } from './store.js'

const names = process.argv.length > 2 ? process.argv.slice(2) : await listCvs()
let failed = false
for (const target of names) {
  let loaded
  try {
    loaded = await loadCv(target)
  } catch (error) {
    console.log(`${target}: ${error.code === 'ENOENT' ? 'not found' : error.message}`)
    failed = true
    continue
  }
  const { name } = loaded
  const { valid, errors } = validate(loaded.cv)
  console.log(`${name}: ${valid ? 'ok' : `invalid\n${errors.map((error) => `  ${error}`).join('\n')}`}`)
  failed ||= !valid
}
process.exit(failed ? 1 : 0)
