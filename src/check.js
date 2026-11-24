import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import { loadDesign, pageGeometry } from './design.js'

const PT_TO_MM = 25.4 / 72
const MAX_BLANK_MM = 35
const MIN_LAST_PAGE_MM = 40

const round = (value) => Math.round(value * 10) / 10

const readLines = async (page) => {
  const { items } = await page.getTextContent()
  const rows = new Map()
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = Math.round(item.transform[5])
    rows.set(y, `${rows.get(y) ?? ''}${rows.has(y) ? ' ' : ''}${item.str}`.replace(/\s+/g, ' '))
  }
  return [...rows.entries()].sort(([a], [b]) => b - a).map(([y, text]) => ({ y, text }))
}

export const analyzePdf = async (pdf, design) => {
  const { heightMm: PAGE_HEIGHT_MM, bottomMm: BOTTOM_MARGIN_MM, topMm: TOP_MARGIN_MM } = pageGeometry(loadDesign(design))
  const task = getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, verbosity: 0 })
  const doc = await task.promise
  const pages = []
  for (let number = 1; number <= doc.numPages; number++) {
    const lines = await readLines(await doc.getPage(number))
    const lowestMm = PAGE_HEIGHT_MM - lines.at(-1).y * PT_TO_MM
    const bottomLimitMm = PAGE_HEIGHT_MM - BOTTOM_MARGIN_MM
    pages.push({
      page: number,
      firstLine: lines[0]?.text ?? '',
      lastLine: lines.at(-1)?.text ?? '',
      blankAtBottomMm: round(Math.max(0, bottomLimitMm - lowestMm)),
      contentHeightMm: round(lowestMm - TOP_MARGIN_MM)
    })
  }
  await task.destroy()
  return pages
}

export const checkLayout = async (pdf, { maxPages = 2, lastPageFreeMm, footerGapMm, design } = {}) => {
  const pages = await analyzePdf(pdf, design)
  if (lastPageFreeMm !== undefined) pages.at(-1).blankAtBottomMm = round(lastPageFreeMm)
  const warnings = []
  if (pages.length > maxPages) {
    warnings.push(`CV is ${pages.length} pages, limit is ${maxPages}. Shorten content or raise meta.maxPages.`)
  }
  for (const page of pages.slice(0, -1)) {
    if (page.blankAtBottomMm > MAX_BLANK_MM) {
      warnings.push(`Page ${page.page} ends with ~${page.blankAtBottomMm} mm blank space (next block did not fit). Next page starts with "${pages[page.page].firstLine}".`)
    }
  }
  const last = pages.at(-1)
  if (pages.length > 1 && last.contentHeightMm < MIN_LAST_PAGE_MM) {
    warnings.push(`Last page has only ~${last.contentHeightMm} mm of content, starting with "${last.firstLine}".`)
  }
  return { pageCount: pages.length, maxPages, ok: warnings.length === 0, warnings, pages, footerGapMm }
}

export const formatReport = (report) =>
  [
    `${report.pageCount} page(s), limit ${report.maxPages}`,
    ...report.pages.map((p) => `  page ${p.page}: ${p.blankAtBottomMm} mm free at bottom, starts "${p.firstLine}", ends "${p.lastLine}"`),
    ...report.warnings.map((warning) => `  WARNING: ${warning}`)
  ].join('\n')
