#!/usr/bin/env node
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { access } from 'node:fs/promises'
import { z } from 'zod'

import { checkLayout } from './check.js'
import { config } from './config.js'
import { buildPdf, closeBrowser, layoutOptions, renderPdf } from './pdf.js'
import { cvPath, defaultCvName, getSchema, listCvs, pdfPath, readCv, validate, writeCv } from './store.js'

const name = z.string().regex(/^[\w-]+$/, 'Letters, digits, - and _ only').describe('CV name, i.e. the file name in data/ without .json')
const cvBody = z.record(z.string(), z.unknown()).describe('Complete CV object following the schema from get_schema')

const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })
const failure = (message, extra = {}) => ({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message, ...extra }, null, 2) }] })

const tool = (handler) => async (args) => {
  try {
    return await handler(args)
  } catch (error) {
    return failure(error.code === 'ENOENT' ? 'CV not found' : error.message)
  }
}

const exists = (file) => access(file).then(() => true, () => false)

const layoutReport = async (cv, result) => checkLayout(result.pdf, layoutOptions(cv, result))

const server = new McpServer(
  { name: 'cv-creator', version: '1.0.0' },
  {
    instructions: [
      'Builds PDF CVs from JSON files stored in data/.',
      'Call get_schema once to learn the format, get_cv to read a CV, save_cv to store a new or changed one,',
      'and build_pdf to render it. build_pdf returns a layout report: fix every warning (shorten text, remove low-value bullets)',
      'until the CV fits its page limit. Use the tailor_cv prompt for adapting a CV to a job offer.'
    ].join(' ')
  }
)

server.registerTool(
  'list_cvs',
  { title: 'List CVs', description: 'List available CV names (files in data/).', annotations: { readOnlyHint: true } },
  tool(async () => json({ cvs: await listCvs(), default: await defaultCvName() }))
)

server.registerTool(
  'get_schema',
  { title: 'Get CV schema', description: 'JSON Schema describing the CV data format.', annotations: { readOnlyHint: true } },
  tool(async () => json(getSchema()))
)

server.registerTool(
  'get_cv',
  { title: 'Get CV', description: 'Read one CV as JSON.', inputSchema: { name }, annotations: { readOnlyHint: true } },
  tool(async ({ name: cvName }) => json(await readCv(cvName)))
)

server.registerTool(
  'validate_cv',
  {
    title: 'Validate CV',
    description: 'Validate a CV object against the schema without saving it.',
    inputSchema: { cv: cvBody },
    annotations: { readOnlyHint: true }
  },
  tool(async ({ cv }) => json(validate(cv)))
)

server.registerTool(
  'save_cv',
  {
    title: 'Save CV',
    description: 'Validate and save a CV to data/<name>.json. Refuses to replace an existing CV unless overwrite is true; prefer a new name such as <company>-<role> when tailoring.',
    inputSchema: { name, cv: cvBody, overwrite: z.boolean().optional().describe('Allow replacing an existing CV (default false)') },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
  },
  tool(async ({ name: cvName, cv, overwrite = false }) => {
    const { valid, errors } = validate(cv)
    if (!valid) return failure('Schema validation failed', { errors })
    if (!overwrite && (await exists(cvPath(cvName)))) {
      return failure(`${cvName} already exists. Choose another name or pass overwrite: true.`)
    }
    await writeCv(cvName, cv)
    return json({ saved: cvName, file: cvPath(cvName) })
  })
)

server.registerTool(
  'build_pdf',
  {
    title: 'Build PDF',
    description: 'Render a saved CV to PDF in the output folder and return the file path plus a layout report (page count, free space, warnings).',
    inputSchema: { name },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  },
  tool(async ({ name: cvName }) => {
    const cv = await readCv(cvName)
    const { valid, errors } = validate(cv)
    if (!valid) return failure('Schema validation failed', { errors })
    const result = await buildPdf(cv, pdfPath(cvName, cv))
    return json({ file: result.path, layout: await layoutReport(cv, result) })
  })
)

server.registerTool(
  'check_layout',
  {
    title: 'Check layout',
    description: 'Render a saved CV in memory and report page count, free space per page and warnings, without writing a PDF.',
    inputSchema: { name },
    annotations: { readOnlyHint: true }
  },
  tool(async ({ name: cvName }) => {
    const cv = await readCv(cvName)
    return json(await layoutReport(cv, await renderPdf(cv)))
  })
)

const resourceText = (uri, value) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }] })

server.registerResource(
  'schema',
  'cv://schema',
  { title: 'CV JSON Schema', description: 'Schema of the CV data format', mimeType: 'application/json' },
  (uri) => resourceText(uri, getSchema())
)

server.registerResource(
  'cv',
  new ResourceTemplate('cv://cvs/{name}', {
    list: async () => ({
      resources: (await listCvs()).map((cvName) => ({
        uri: `cv://cvs/${cvName}`,
        name: cvName,
        title: `CV: ${cvName}`,
        mimeType: 'application/json'
      }))
    }),
    complete: { name: async (value) => (await listCvs()).filter((cvName) => cvName.startsWith(value)) }
  }),
  { title: 'CV', description: 'A CV from data/ as JSON', mimeType: 'application/json' },
  async (uri, variables) => resourceText(uri, await readCv(String(variables.name)))
)

server.registerPrompt(
  'tailor_cv',
  {
    title: 'Tailor CV to a job offer',
    description: 'Create a new CV variant adapted to a job offer, without inventing experience.',
    argsSchema: {
      job_offer: z.string().describe('Full text of the job offer'),
      base_cv: z.string().regex(/^[\w-]+$/).optional().describe('CV to start from (default: the default CV)'),
      new_name: z.string().regex(/^[\w-]+$/).optional().describe('Name for the tailored CV, e.g. acme-backend-engineer')
    }
  },
  async ({ job_offer: jobOffer, base_cv: baseCv, new_name: newName }) => {
    const base = baseCv ?? (await defaultCvName())
    const target = newName ?? 'tailored-cv'
    const text = `Tailor my CV to the job offer below.

Steps:
1. Call get_schema and get_cv with name "${base}".
2. Identify the offer's must-have skills, responsibilities and keywords.
3. Create a modified copy of the CV and save it with save_cv under the name "${target}" (do not overwrite "${base}"):
   - Rewrite the career summary and headline for this role.
   - Reorder skill groups, skills, bullets and entries so the most relevant ones come first; shorten or drop the least relevant bullets.
   - Reuse the offer's terminology only where it truthfully describes my existing experience.
4. Call build_pdf for "${target}". If the layout report has warnings or exceeds the page limit, shorten text and rebuild until it is clean.
5. Reply with the PDF path, a short list of what you changed, and any requirement in the offer that my CV does not cover.

Rules:
- Never invent or exaggerate employers, titles, dates, degrees, skills, numbers or achievements. Only rephrase, reorder and trim what is already in the CV.
- Keep contact details, employment dates and the footer note unchanged.
- Keep the CV within its page limit (${config.layout.maxPages} pages by default).

Job offer:
"""
${jobOffer}
"""`
    return { messages: [{ role: 'user', content: { type: 'text', text } }] }
  }
)

const shutdown = async () => {
  await closeBrowser().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.stdin.on('end', shutdown)

await server.connect(new StdioServerTransport())
console.error('cv-creator MCP server running on stdio')
