# CV data model

Top level: `meta`, `header`, `sections`, `footer`. `get_schema` is authoritative.

- `meta`: `title`, `lang`, `maxPages`, `design` (preset name), `fileName` (PDF name without `.pdf`; output goes to `<output dir>/<CV name>/<fileName>.pdf`).
- `header`: `name`, `headline`, `lines` (URLs and e-mails are linked automatically; in the sidebar design lines are split at ` | `).
- `sections[]`, each with `title` and `type`:
  - `text`: `paragraphs[]`
  - `entries`: `entries[]` with `heading`, optional `role`, `period`, `lines[]`, `bullets[]` (string, or `{ "text", "children": [] }` for a nested list)
  - `skills`: `groups[]` of `{ label, items }`
  - any section: `"pageBreakBefore": true`, and in two-column designs `"column": "side" | "main"`
- `footer`: data-processing consent note.

Section order in the array is the order in the PDF.
