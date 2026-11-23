import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, dirname, join } from 'node:path'
import { parseArgs } from 'node:util'

import { config, outputFileName } from './config.js'
import { checkLayout } from './check.js'
import { buildPdf, layoutOptions, renderPdf } from './pdf.js'
import { renderHtml } from './render.js'
import { designFile } from './design.js'
import { dataDir, defaultCvName, listCvs, pdfPath, readCv, root, getSchema, validate, writeCv } from './store.js'

const { values } = parseArgs({ options: { port: { type: 'string', default: process.env.PORT ?? String(config.server.port) }, host: { type: 'string', default: config.server.host } } })

const fontDir = join(root, 'node_modules/@fontsource/dm-sans/files')
const clients = new Set()

const broadcast = (message) => { for (const client of clients) client.write(`data: ${message}\n\n`) }

watch(dataDir, (_, file) => {
  if (file?.endsWith('.json')) broadcast(file.slice(0, -5))
})

watch(dirname(designFile), (_, file) => {
  if (file === basename(designFile)) broadcast('@design')
})

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

const parseCv = (text) => {
  let cv
  try {
    cv = JSON.parse(text)
  } catch (error) {
    throw Object.assign(new Error(`Invalid JSON: ${error.message}`), { status: 400 })
  }
  const { valid, errors } = validate(cv)
  if (!valid) throw Object.assign(new Error(`Schema validation failed: ${errors.join('; ')}`), { status: 422, errors })
  return cv
}

const livePreviewHead = (name) =>
  `<script>new EventSource('/events').onmessage=e=>{if(e.data==='${name}'||e.data==='@design')location.reload()}</script>`

const routes = [
  ['GET', /^\/$/, async (req, res) => send(res, 200, await readFile(join(root, 'src/editor.html'), 'utf8'), 'text/html; charset=utf-8')],
  ['GET', /^\/fonts\/([\w.-]+\.woff2)$/, async (req, res, [file]) => send(res, 200, await readFile(join(fontDir, file)), 'font/woff2')],
  ['GET', /^\/events$/, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
    res.write('retry: 1000\n\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
  }],
  ['GET', /^\/api\/config$/, async (req, res) => send(res, 200, { defaultCv: await defaultCvName(), filenamePrefix: config.output.filenamePrefix, maxPages: config.layout.maxPages })],
  ['GET', /^\/api\/schema$/, (req, res) => send(res, 200, getSchema())],
  ['GET', /^\/api\/cvs$/, async (req, res) => send(res, 200, await listCvs())],
  ['GET', /^\/api\/cvs\/([\w-]+)$/, async (req, res, [name]) => send(res, 200, await readCv(name))],
  ['PUT', /^\/api\/cvs\/([\w-]+)$/, async (req, res, [name]) => {
    await writeCv(name, parseCv(await readBody(req)))
    send(res, 200, { ok: true, name })
  }],
  ['POST', /^\/api\/validate$/, async (req, res) => {
    try {
      parseCv(await readBody(req))
      send(res, 200, { valid: true, errors: [] })
    } catch (error) {
      send(res, error.status ?? 500, { valid: false, error: error.message, errors: error.errors ?? [] })
    }
  }],
  ['POST', /^\/api\/cvs\/([\w-]+)\/build$/, async (req, res, [name]) => {
    const cv = await readCv(name)
    const result = await buildPdf(cv, pdfPath(name, cv))
    const { pdf } = result
    const report = await checkLayout(pdf, layoutOptions(cv, result))
    res.writeHead(200, { 'content-type': 'application/pdf', 'x-cv-report': encodeURIComponent(JSON.stringify(report)), 'cache-control': 'no-store' })
    res.end(pdf)
  }],
  ['GET', /^\/api\/cvs\/([\w-]+)\/check$/, async (req, res, [name]) => {
    const cv = await readCv(name)
    const result = await renderPdf(cv)
    send(res, 200, await checkLayout(result.pdf, layoutOptions(cv, result)))
  }],
  ['POST', /^\/api\/render$/, async (req, res) => {
    const cv = parseCv(await readBody(req))
    const result = await renderPdf(cv)
    const { pdf } = result
    const report = await checkLayout(pdf, layoutOptions(cv, result))
    res.writeHead(200, { 'content-type': 'application/pdf', 'x-cv-report': encodeURIComponent(JSON.stringify(report)), 'cache-control': 'no-store' })
    res.end(pdf)
  }],
  ['GET', /^\/preview\/([\w-]+)$/, async (req, res, [name]) =>
    send(res, 200, renderHtml(await readCv(name), { inlineFonts: false, extraHead: livePreviewHead(name) }), 'text/html; charset=utf-8')],
  ['POST', /^\/preview\/([\w-]+)$/, async (req, res) =>
    send(res, 200, renderHtml(parseCv(await readBody(req)), { inlineFonts: false }), 'text/html; charset=utf-8')],
  ['GET', /^\/pdf\/([\w-]+)$/, async (req, res, [name]) => {
    const cv = await readCv(name)
    const { pdf } = await renderPdf(cv)
    res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${outputFileName(name, cv)}"` })
    res.end(pdf)
  }]
]

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  for (const [method, pattern, handler] of routes) {
    const match = method === req.method && pathname.match(pattern)
    if (!match) continue
    try {
      return await handler(req, res, match.slice(1))
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : 500)
      return send(res, status, { error: error.code === 'ENOENT' ? 'Not found' : error.message, errors: error.errors })
    }
  }
  send(res, 404, { error: 'Not found' })
}).listen(Number(values.port), values.host, () => {
  console.log(`CV Creator running at http://${values.host}:${values.port}`)
})
