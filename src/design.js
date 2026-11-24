import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const designFile = join(root, 'design.config.json')
export const designsDir = join(root, 'designs')

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

const readJson = (file, label) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new Error(`Invalid ${label}: ${error.message}`)
  }
}

export const listDesigns = () =>
  readdirSync(designsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -5))
    .sort()

export const describeDesigns = () =>
  listDesigns().map((name) => ({ name, description: readJson(join(designsDir, `${name}.json`), name)?.description ?? '' }))

/** Without a name: defaults + design.config.json. With a name: defaults + designs/<name>.json. */
export const loadDesign = (name) => {
  let user
  if (name) {
    if (!/^[\w-]+$/.test(name)) throw new Error(`Invalid design name "${name}"`)
    user = readJson(join(designsDir, `${name}.json`), `design "${name}"`)
    if (!user) throw new Error(`Unknown design "${name}". Available: ${listDesigns().join(', ')}`)
  } else {
    user = readJson(designFile, 'design.config.json') ?? {}
  }
  const design = Object.fromEntries(
    Object.entries(defaults).map(([group, values]) => [group, { ...values, ...user[group] }])
  )
  design.variant = user.variant ?? ''
  design.layout = user.layout?.type === 'two-column' ? { sidebarWidth: '68mm', sidebarColor: '#1f3a5f', sidebarText: '#ffffff', ...user.layout } : undefined
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
  const { layout } = design
  const layoutVars = layout
    ? `;--sidebar-width:${layout.sidebarWidth};--sidebar-color:${layout.sidebarColor};--sidebar-text:${layout.sidebarText}`
    : ''
  return `:root{${rootVars}${layoutVars}}
${layout
    ? `@page{size:${page.size};margin:0 ${page.marginSide};background:${colors.paper}}`
    : `@page{size:${page.size};margin:${page.marginTop} ${page.marginSide} ${page.marginBottom};background:${colors.paper}}
@page :first{margin-top:${page.marginFirstPageTop}}`}`
}
