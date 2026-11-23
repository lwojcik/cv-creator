import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const designFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'design.config.json')

const defaults = {
  colors: { accent: '#1f4e79', rule: '#8eadcf', text: '#262626', paper: '#fafafa' },
  font: {
    family: "'DM Sans', sans-serif",
    size: '10.2pt',
    lineHeight: 1.34,
    nameSize: '20pt',
    headlineSize: '14.2pt',
    contactSize: '12.5pt',
    sectionTitleSize: '12.2pt',
    entryTitleSize: '10.2pt'
  },
  page: { size: 'A4', marginSide: '21mm', marginTop: '21mm', marginFirstPageTop: '13mm', marginBottom: '13mm' },
  spacing: {
    headerBottom: '8mm',
    sectionGap: '6mm',
    sectionTitleGap: '4mm',
    sectionTitlePadding: '2.2mm',
    entryGap: '3.6mm',
    bulletIndent: '6.2mm',
    footerGap: '5mm',
    footerMaxWidth: '135mm',
    ruleThickness: '1.5px'
  }
}

const pageSizes = { A4: [210, 297], Letter: [215.9, 279.4] }
const mmPattern = /^\d+(\.\d+)?mm$/

const readUserDesign = () => {
  try {
    return JSON.parse(readFileSync(designFile, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw new Error(`Invalid design.config.json: ${error.message}`)
  }
}

export const loadDesign = () => {
  const user = readUserDesign()
  const design = Object.fromEntries(
    Object.entries(defaults).map(([group, values]) => [group, { ...values, ...user[group] }])
  )
  if (!pageSizes[design.page.size]) {
    throw new Error(`design.config.json: page.size must be one of ${Object.keys(pageSizes).join(', ')}`)
  }
  for (const key of ['marginSide', 'marginTop', 'marginFirstPageTop', 'marginBottom']) {
    if (!mmPattern.test(design.page[key])) throw new Error(`design.config.json: page.${key} must be in mm, e.g. "20mm"`)
  }
  if (!mmPattern.test(design.spacing.footerGap)) {
    throw new Error('design.config.json: spacing.footerGap must be in mm, e.g. "5mm"')
  }
  return design
}

export const mm = (value) => Number.parseFloat(value)

export const pageGeometry = (design) => {
  const [widthMm, heightMm] = pageSizes[design.page.size]
  return {
    widthMm,
    heightMm,
    topMm: mm(design.page.marginTop),
    firstTopMm: mm(design.page.marginFirstPageTop),
    bottomMm: mm(design.page.marginBottom),
    footerGapMm: mm(design.spacing.footerGap)
  }
}

export const designStyles = (design) => {
  const { colors, font, page, spacing } = design
  const { widthMm } = pageGeometry(design)
  const vars = {
    accent: colors.accent,
    rule: colors.rule,
    text: colors.text,
    paper: colors.paper,
    'font-family': font.family,
    'font-size': font.size,
    'line-height': font.lineHeight,
    'name-size': font.nameSize,
    'headline-size': font.headlineSize,
    'contact-size': font.contactSize,
    'section-title-size': font.sectionTitleSize,
    'entry-title-size': font.entryTitleSize,
    'header-bottom': spacing.headerBottom,
    'section-gap': spacing.sectionGap,
    'section-title-gap': spacing.sectionTitleGap,
    'section-title-padding': spacing.sectionTitlePadding,
    'entry-gap': spacing.entryGap,
    'bullet-indent': spacing.bulletIndent,
    'footer-gap': spacing.footerGap,
    'footer-max-width': spacing.footerMaxWidth,
    'rule-thickness': spacing.ruleThickness,
    'page-width': `${widthMm}mm`,
    'page-side': page.marginSide,
    'page-first-top': page.marginFirstPageTop,
    'page-bottom': page.marginBottom
  }
  const rootVars = Object.entries(vars).map(([key, value]) => `--${key}:${value}`).join(';')
  return `:root{${rootVars}}
@page{size:${page.size};margin:${page.marginTop} ${page.marginSide} ${page.marginBottom};background:${colors.paper}}
@page :first{margin-top:${page.marginFirstPageTop}}`
}
