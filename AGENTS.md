# CV Creator: instructions for AI agents

This repo builds PDF CVs from JSON files (`data/*.json`). Any agent can use it, through MCP tools or the CLI.

- **Workflow, rules and design options**: read [skills/cv-creator/SKILL.md](skills/cv-creator/SKILL.md) before changing a CV. It is plain Markdown and does not depend on any particular assistant.
- **Tools**: the MCP server `node src/mcp.js` (stdio) exposes `list_cvs`, `get_schema`, `get_cv`, `validate_cv`, `save_cv`, `build_pdf`, `check_layout`, `list_designs`, plus the prompt `tailor_cv`.
- **Without MCP**: `npm run validate -- <name>` and `npm run build -- <name>` from the repo root.
- **Hard rule**: never invent or exaggerate experience; only rephrase, reorder and trim what the CV already says. Report gaps instead of filling them.
- **Privacy**: `data/*.json`, `cv.config.json`, `dist/` are personal and git-ignored. Do not commit or upload them.
- **Commits**: Conventional Commits (`feat:`, `fix:`), enforced by a hook.
