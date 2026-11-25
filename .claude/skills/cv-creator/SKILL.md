---
name: cv-creator
description: Create, edit, tailor and render PDF CVs/resumes from JSON files in this repo. Use when the user wants to tailor their CV to a job offer, build or rebuild a CV PDF, change a CV's design, fix its page layout, or add a new CV variant.
---

# CV Creator

CVs are JSON files in `data/` (the single source of truth); a PDF is rendered from them.
`data/*.json` is personal and git-ignored. Only `data/sample.json` is tracked, so on a fresh checkout copy it to `data/general.json` first.

## Tools

Prefer the `cv-creator` MCP tools (`list_cvs`, `get_schema`, `get_cv`, `validate_cv`, `save_cv`, `build_pdf`, `check_layout`, `list_designs`).
If they are not available, run from the repo root (`npm install` once):

- `npm run validate -- <name|path.json>`
- `npm run build -- <name|path.json> [--out file.pdf] [--strict]`
- `npm run build:all`

If the MCP server is missing, tell the user it can be registered with
`claude mcp add cv-creator -- node <repo>/src/mcp.js`.

## Tailoring a CV to a job offer

1. `get_schema` (once) and `get_cv` for the base CV (default: the one from `list_cvs`).
2. Extract the offer's must-have skills, responsibilities and keywords.
3. `save_cv` a **new** copy named `<company>-<role>`; never overwrite the base CV.
   - Rewrite headline and summary for the role.
   - Reorder skill groups, skills, bullets and entries so the most relevant come first; trim the least relevant bullets.
   - Use the offer's wording only where it truthfully describes existing experience.
   - Set `meta.fileName` (e.g. `jane-doe-cv`) so the PDF name does not reveal the company.
4. `build_pdf`. Fix every layout warning (shorten text, drop low-value bullets) and rebuild until clean and within `meta.maxPages` (default 2).
5. Reply with the PDF path, a short list of what changed, and any offer requirement the CV does not cover.

## Hard rules

- **Never invent or exaggerate** employers, titles, dates, degrees, skills, numbers or achievements. Only rephrase, reorder and trim what the CV already says.
- If the offer needs something the CV lacks, report it as a gap and ask the user; do not write it in.
- Keep contact details, employment dates and the footer consent note unchanged.
- Do not paste CV contents into external services; the data is personal.

## Other tasks

- **Design**: call `list_designs`, then set `meta.design` (`classic`, `modern`, `minimal`, `serif`, `bold`, `sidebar`). See [references/design.md](references/design.md).
- **Layout problems** (page overflow, big blank gap at a page end): shorten text, or set `"pageBreakBefore": true` on a section. Entries never split across pages.
- **Data model** (sections, entries, skills, nested bullets): see [references/data-model.md](references/data-model.md) or `get_schema`.
- **Live editing**: `npm run dev` serves an editor with preview at http://127.0.0.1:3000.
