# Designs

Pick per CV with `meta.design`. Presets live in `designs/*.json`:

- `classic`: original look, navy accents, rule under section titles
- `modern`: teal accent, accent bar beside titles, airy spacing
- `minimal`: monochrome, sentence-case titles, hairline rule
- `serif`: Georgia, centred header, small-caps titles
- `bold`: section titles as filled accent bands
- `sidebar`: two columns; contact lines and `skills` sections in a coloured sidebar

Without `meta.design`, `design.config.json` applies (colors, font, page size/margins, spacing; read on every render).
A preset replaces `design.config.json` rather than layering on it. Changing fonts or spacing moves page breaks, so rebuild and check the layout report.
