# CV Creator

Build a clean, ATS-friendly PDF CV (A4, DM Sans, two pages) from a JSON file.
The JSON file is the single source of truth: edit it in the browser editor with live preview, from the CLI,
or through an HTTP API that other tools and agents can use to tailor a CV to a job offer.

Your CV data stays on your machine: `data/*.json`, `cv.config.json`, `static/` and `dist/` are git-ignored.
The repository ships only a fictional sample, `data/sample.json`.

## Quick start

```sh
npm install
cp data/sample.json data/general.json   # first run: make your own CV from the sample and edit it
npm run dev        # http://127.0.0.1:3000 - editor + live preview
npm run build      # default CV (data/general.json, or data/sample.json when it does not exist)
npm run build -- frontend   # data/frontend.json -> dist/<prefix>frontend.pdf
npm run build -- ~/offers/acme.json              # any JSON file, from any folder
npm run build -- ./acme.json --out ~/Desktop/cv.pdf   # choose the exact output path
npm run build -- general frontend ./acme.json    # several at once
npm run build:all  # every data/*.json
npm run build -- --strict   # also fail on layout warnings
npm run validate -- ./acme.json   # validate a specific file (no argument: every data/*.json)
npm run validate   # check every data/*.json against schema/cv.schema.json
```

`npm run dev` accepts `-- --port 4000 --host 0.0.0.0`.

## Layout of the repo

| Path | Purpose |
| --- | --- |
| `data/sample.json` | Fictional sample CV (the only tracked file in `data/`). Copy it and replace the content with yours |
| `data/*.json` | Your CVs and role variants (git-ignored except the sample). Each file is one entry in the editor's version dropdown |
| `schema/cv.schema.json` | JSON Schema for CV data |
| `src/render.js`, `src/styles.css`, `src/design.js` | JSON -> HTML; print styles driven by `design.config.json` |
| `src/pdf.js` | HTML -> PDF with headless Chrome (Puppeteer) |
| `src/server.js`, `src/editor.html` | Live preview, editor and HTTP API |
| `cv.config.json` | Your project settings (git-ignored); start from `cv.config.example.json` |
| `design.config.json` | Look of the CV: colours, fonts, page margins, spacing (see Design) |
| `dist/` | Generated PDFs (git-ignored) |

## Configuration

`cv.config.json` in the repo root (git-ignored; copy `cv.config.example.json` to create it). It is optional and every key is optional.

| Key | Default | Meaning |
| --- | --- | --- |
| `defaultCv` | `general` | CV built by `npm run build` with no argument, and opened first in the editor. If that file does not exist, `sample` is used |
| `output.dir` | `dist` | Folder for generated PDFs (relative to the repo, or absolute) |
| `output.filenamePrefix` | `""` | Prefix for PDF file names: `jane-doe-cv-` gives `dist/jane-doe-cv-frontend.pdf`. It is also the default download name in the editor |
| `layout.maxPages` | `2` | Page limit for the layout check (a CV can override it with `meta.maxPages`) |
| `server.host`, `server.port` | `127.0.0.1`, `3000` | Preview server address (`--host`, `--port` flags override) |

A build target is either a name from `data/` (`frontend`) or a path to a JSON file (anything ending in `.json`
or containing a slash). A file's PDF is named `<prefix><file name without .json>.pdf` in the output folder unless
`--out` is given (single target only). Exit code is non-zero if a file is missing or invalid, or the CV exceeds
its page limit.

Restart `npm run dev` after changing the config.

## Design

`design.config.json` controls the look. The defaults reproduce the original CV, and every key is optional.

| Group | Keys |
| --- | --- |
| `colors` | `accent` (name, headline, section titles), `rule` (line under section titles), `text`, `paper` (page background) |
| `font` | `family` (CSS font stack; DM Sans is bundled, other families must be installed on the machine), `size`, `lineHeight`, `nameSize`, `headlineSize`, `contactSize`, `sectionTitleSize`, `entryTitleSize` |
| `page` | `size` (`A4` or `Letter`), `marginSide`, `marginTop`, `marginFirstPageTop`, `marginBottom` (margins must be in `mm`) |
| `spacing` | `headerBottom`, `sectionGap`, `sectionTitleGap`, `sectionTitlePadding`, `entryGap`, `bulletIndent`, `footerGap` (in `mm`), `footerMaxWidth`, `ruleThickness` |

Sizes are CSS lengths such as `10.2pt` or `4mm`. The file is read on every render, so no restart is needed:
the editor reloads the preview when it changes, and CLI builds always use the current file.
The layout check uses the page size and margins from this file. Changing spacing or font size moves page breaks,
so check the report afterwards.

## Data model

- `header`: `name`, `headline`, `lines` (URLs and e-mail addresses are linked automatically)
- `sections[]`, each with `title` and a `type`:
  - `text`: `paragraphs[]`
  - `entries`: `entries[]` with `heading`, optional `role`, `period`, `lines[]`, `bullets[]`
    (a bullet is a string or `{ "text", "children": [] }` for a nested list)
  - `skills`: `groups[]` of `{ label, items }`
  - any section may set `"pageBreakBefore": true`
- `footer`: the data-processing consent note

Reorder, add or remove sections freely; the layout follows the array order.

## Layout safety

Page breaks only exist in the final PDF, so every build (CLI, editor, API) runs a layout check on the
real PDF: page count, free space at the bottom of each page, and the first and last line of each page.
It warns when the CV exceeds `meta.maxPages` (default 2), when a page ends with a large blank gap
(an entry was too tall to fit and moved to the next page), or when only a few lines spill onto the last page.
Entries and section headings never split across pages. Fix a warning by shortening text, or set
`"pageBreakBefore": true` on a section to control where a page starts. The editor preview is the paginated PDF itself.

## HTTP API (for other tools and agents)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/config` | Public settings (default CV, file name prefix, page limit) |
| GET | `/api/schema` | JSON Schema of the CV format |
| GET | `/api/cvs` | List CV names |
| GET | `/api/cvs/:name` | Read a CV |
| PUT | `/api/cvs/:name` | Create or replace a CV (validated, 422 with errors if invalid) |
| POST | `/api/validate` | Validate a CV body without saving |
| POST | `/api/cvs/:name/build` | Build PDF, saved to the output folder (`<prefix><name>.pdf`) and returned |
| GET | `/api/cvs/:name/check` | Render and return the layout report |
| POST | `/api/render` | Render a CV body to PDF without saving (report in the `x-cv-report` header, URL-encoded JSON) |
| GET | `/pdf/:name` | Render PDF on the fly |
| GET | `/preview/:name` | HTML preview |

The server binds to `127.0.0.1` and has no authentication. Do not expose it publicly without adding some.

### Suggested workflow for tailoring to a job offer

1. `GET /api/schema` and `GET /api/cvs/general` (or another name from `GET /api/cvs`) to read the base CV.
2. Produce a modified copy: reword the summary, reorder or trim bullets and skills to match the offer.
   Do not invent experience; only rephrase and emphasise what the base CV already states.
3. `PUT /api/cvs/<company>-<role>` with the new JSON.
4. `POST /api/cvs/<company>-<role>/build` and check the page count (the base CV is 2 pages).

The same can be done on disk: copy `data/general.json`, edit, run `npm run validate` and `npm run build -- <name>`.

## License

[MIT](LICENSE)
