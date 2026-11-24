import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { designStyles, loadDesign } from './design.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fontDir = join(root, 'node_modules/@fontsource/dm-sans/files')

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const linkPattern = /(https?:\/\/[^\s<]+[^\s<.,;:!?)]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g

const linkify = (text) =>
  escapeHtml(text).replaceAll(linkPattern, (match) => {
    const href = match.includes('@') && !match.startsWith('http') ? `mailto:${match}` : match
    return `<a href="${href}">${match}</a>`
  })

const filled = (items = []) => items.filter((item) => (typeof item === 'string' ? item.trim() : item.text?.trim()))

const list = (items, className = '') =>
  `<ul${className ? ` class="${className}"` : ''}>${items.join('')}</ul>`

const renderBullet = (bullet) => {
  if (typeof bullet === 'string') return `<li>${linkify(bullet)}</li>`
  const children = filled(bullet.children).length
    ? list(filled(bullet.children).map((child) => `<li>${linkify(child)}</li>`), 'nested')
    : ''
  return `<li>${linkify(bullet.text)}${children}</li>`
}

const renderEntry = (entry) => {
  const subtitle = [entry.role, entry.period].filter(Boolean).join(' | ')
  const lines = filled(entry.lines).map((line) => `<p>${linkify(line)}</p>`).join('')
  const bullets = filled(entry.bullets).length ? list(filled(entry.bullets).map(renderBullet)) : ''
  return `<article class="entry">
    <h3>${escapeHtml(entry.heading)}</h3>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
    ${lines}${bullets}
  </article>`
}

const renderSkills = (groups) =>
  list(groups.map((group) => `<li><strong>${escapeHtml(group.label)}:</strong> ${escapeHtml(group.items)}</li>`))

const renderBody = (section) => {
  switch (section.type) {
    case 'text':
      return filled(section.paragraphs).map((text) => `<p>${linkify(text)}</p>`).join('')
    case 'skills':
      return `<div class="entry">${renderSkills(section.groups)}</div>`
    case 'entries':
      return section.entries.map(renderEntry).join('')
    default:
      return ''
  }
}

const renderSection = (section) => `<section${section.pageBreakBefore ? ' class="break-before"' : ''}>
  <h2>${escapeHtml(section.title)}</h2>
  ${renderBody(section)}
</section>`

const fontFaces = ({ inline }) => {
  const subsets = [
    ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
    ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF']
  ]
  const faces = [
    [300, 'normal'],
    [400, 'normal'],
    [400, 'italic'],
    [600, 'normal'],
    [700, 'normal']
  ]
  return subsets
    .flatMap(([subset, range]) =>
      faces.map(([weight, style]) => {
        const file = `dm-sans-${subset}-${weight}-${style}.woff2`
        const src = inline
          ? `data:font/woff2;base64,${readFileSync(join(fontDir, file)).toString('base64')}`
          : `/fonts/${file}`
        return `@font-face{font-family:'DM Sans';font-style:${style};font-weight:${weight};src:url(${src}) format('woff2');unicode-range:${range}}`
      })
    )
    .join('\n')
}

const renderHeader = (header, { contact = true } = {}) => `<header>
  <h1>${escapeHtml(header.name)}</h1>
  ${header.headline ? `<p class="headline">${escapeHtml(header.headline)}</p>` : ''}
  ${contact ? filled(header.lines).map((line) => `<p class="contact">${linkify(line)}</p>`).join('') : ''}
</header>`

const inSidebar = (section) => (section.column ?? (section.type === 'skills' ? 'side' : 'main')) === 'side'

// Contact lines are usually "a | b | c"; the narrow sidebar reads better with one item per line.
const contactItems = (header) => filled(header.lines).flatMap((line) => line.split(/\s+\|\s+/))

const twoColumnBody = ({ header, sections, footer }) => `<aside>
  <div class="contact-block">${contactItems(header).map((item) => `<p class="contact">${linkify(item)}</p>`).join('')}</div>
  ${sections.filter(inSidebar).map(renderSection).join('\n')}
</aside>
<main>
  ${renderHeader(header, { contact: false })}
  ${sections.filter((section) => !inSidebar(section)).map(renderSection).join('\n')}
  ${footer ? `<footer>${escapeHtml(footer)}</footer>` : ''}
</main>`

export const renderHtml = (cv, { inlineFonts = true, extraHead = '', footerGapMm } = {}) => {
  const { header, sections, footer, meta = {} } = cv
  const design = loadDesign(meta.design)
  const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
  return `<!doctype html>
<html lang="${escapeHtml(meta.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.title ?? header.name)}</title>
<style>${fontFaces({ inline: inlineFonts })}
${designStyles(design)}
${css}${footerGapMm === undefined ? '' : `:root{--footer-gap:${footerGapMm}mm}`}</style>
${extraHead}
</head>
<body class="${[design.variant && `variant-${design.variant}`, design.layout && 'two-column'].filter(Boolean).join(' ')}">
${design.layout ? twoColumnBody(cv) : `${renderHeader(header)}
${sections.map(renderSection).join('\n')}
${footer ? `<footer>${escapeHtml(footer)}</footer>` : ''}`}
</body>
</html>`
}
