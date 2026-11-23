import { parseArgs } from 'node:util'

import { config } from './config.js'
import { checkLayout, formatReport } from './check.js'
import { buildPdf, closeBrowser, layoutOptions } from './pdf.js'
import { defaultCvName, listCvs, loadCv, pdfPath, validate } from './store.js'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { all: { type: 'boolean' }, out: { type: 'string' }, strict: { type: 'boolean' } }
})

const targets = values.all ? await listCvs() : positionals.length > 0 ? positionals : [await defaultCvName()]

if (values.out && targets.length > 1) {
  console.error('--out can only be used with a single CV')
  process.exit(1)
}

let exitCode = 0
for (const target of targets) {
  let loaded
  try {
    loaded = await loadCv(target)
  } catch (error) {
    console.error(`${target}: ${error.code === 'ENOENT' ? 'not found' : error.message}`)
    exitCode = 1
    continue
  }
  const { name, cv } = loaded
  const { valid, errors } = validate(cv)
  if (!valid) {
    console.error(`${name}: invalid\n${errors.map((error) => `  ${error}`).join('\n')}`)
    exitCode = 1
    continue
  }
  const result = await buildPdf(cv, values.out ?? pdfPath(name))
  const report = await checkLayout(result.pdf, layoutOptions(cv, result))
  console.log(`built ${result.path}\n${formatReport(report)}`)
  if (report.pageCount > report.maxPages || (values.strict && !report.ok)) exitCode = 1
}
await closeBrowser()
process.exit(exitCode)
