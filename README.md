# The Staff Engineer’s Path — Resource Atlas

A filterable, chapter-by-chapter index of resources referenced by Tanya Reilly’s *The Staff Engineer’s Path*.

## Repository structure

```text
.
├── src/
│   ├── client/          # Static site source (HTML, CSS, and TypeScript)
│   └── worker/          # Server-side asset fallback worker
├── data/                # Resource data loaded into DuckDB-Wasm
├── docs/                # Generated and supporting Markdown documents
├── scripts/             # Build and validation tools
├── dist/                # Generated deployable output (not committed)
├── .github/workflows/   # GitHub Pages deployment
└── .openai/             # OpenAI hosting configuration
```

Source files belong in `src/` and `data/`. Do not edit `dist/` directly; `npm run build` recreates it from those authoritative sources.

## Requirements

- Node.js and npm
- POSIX shell utilities

Install the pinned DuckDB-Wasm and build dependencies before building:

```sh
npm ci
```

## Build

```sh
npm run build
```

This creates:

- `dist/client/`: the GitHub Pages artifact, including the bundled application, DuckDB Wasm modules, and DuckDB workers
- `dist/server/`: the worker entry point used by server-backed hosting

## Browser database

GitHub Pages serves only static files, so DuckDB runs in each visitor’s browser. During startup, `src/client/app.ts`:

1. Selects the best compatible local DuckDB-Wasm bundle (`eh` or `mvp`).
2. Starts DuckDB in a Web Worker.
3. Applies `src/client/migrations/0000_create_resources.sql` and inserts `resource-links.json` through Drizzle ORM.
4. Uses the schema in `src/client/database.ts` and Drizzle query-builder operators when search and filter controls change.

No database server, API key, CDN, or cross-origin-isolation headers are required. The Wasm runtime has a larger initial download than the previous JSON-only implementation; browser caching avoids downloading it again on subsequent visits.

## Validate

```sh
npm run check
```

The check runs strict TypeScript validation, performs a clean build, checks the resource-data invariants, runs a real Drizzle/DuckDB-Wasm query test, confirms generated files match their sources, and verifies the bundled DuckDB application and runtime assets.

## Deployment

Pushes to `main` run `.github/workflows/pages.yml`, which validates the project and deploys `dist/client/` to GitHub Pages. The build also retains `dist/server/` for hosting environments configured through `.openai/hosting.json`.
