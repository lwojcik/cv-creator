import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import puppeteer from 'puppeteer'

import { analyzePdf } from './check.js'
import { config } from './config.js'
import { loadDesign, pageGeometry } from './design.js'
import { renderHtml } from './render.js'

let browserPromise

const getBrowser = () => {
  browserPromise ??= puppeteer.launch({ args: ['--no-sandbox'] }).then((browser) => {
    browser.on('disconnected', () => { browserPromise = undefined })
    return browser
  })
  return browserPromise
}

export const closeBrowser = async () => {
  if (!browserPromise) return
  const browser = await browserPromise
  browserPromise = undefined
  await browser.close()
}

const printPdf = async (cv, footerGapMm) => {
  const page = await (await getBrowser()).newPage()
  try {
    await page.setContent(renderHtml(cv, { inlineFonts: true, footerGapMm }), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    return Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
  } finally {
    await page.close()
  }
}

const SAFETY_MM = 1.5

export const renderPdf = async (cv) => {
  const first = await printPdf(cv)
  if (!cv.footer?.trim()) return { pdf: first }
  const freeMm = (await analyzePdf(first, cv.meta?.design)).at(-1).blankAtBottomMm
  const footerGapMm = Math.round((pageGeometry(loadDesign(cv.meta?.design)).footerGapMm + Math.max(0, freeMm - SAFETY_MM)) * 10) / 10
  return { pdf: await printPdf(cv, footerGapMm), footerGapMm, freeMm }
}

export const layoutOptions = (cv, { footerGapMm, freeMm }) => ({
  maxPages: cv.meta?.maxPages ?? config.layout.maxPages,
  lastPageFreeMm: freeMm,
  footerGapMm,
  design: cv.meta?.design
})

export const buildPdf = async (cv, outPath) => {
  const result = await renderPdf(cv)
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, result.pdf)
  return { path: outPath, ...result }
}
