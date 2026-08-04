#!/bin/sh
set -eu

npm run typecheck
npm run build

node --check dist/client/app.js
node --check dist/server/index.js
./node_modules/.bin/tsx scripts/test-duckdb.ts
node -e 'const data = require("./data/resource-links.json"); const resources = data.resources; if (data.resourceOccurrences !== resources.length || data.uniqueOriginalUrls !== new Set(resources.map((item) => item.originalUrl)).size) process.exit(1)'

cmp src/client/index.html dist/client/index.html
cmp src/client/all-resources.html dist/client/all-resources.html
cmp src/client/styles.css dist/client/styles.css
cmp src/client/migrations/0000_create_resources.sql dist/client/migrations/0000_create_resources.sql
cmp data/resource-links.json dist/client/resource-links.json

test -s dist/client/app.js
test -s dist/client/all-resources.html
test -s dist/client/duckdb/duckdb-eh.wasm
test -s dist/client/duckdb/duckdb-mvp.wasm
test -s dist/client/duckdb/duckdb-browser-eh.worker.js
test -s dist/client/duckdb/duckdb-browser-mvp.worker.js
test -f dist/client/.nojekyll
grep -q 'href="styles.css"' dist/client/index.html
grep -q 'type="module" src="app.js"' dist/client/index.html
grep -q '@proj-airi/drizzle-duckdb-wasm' src/client/app.ts
grep -q 'drizzle-orm' src/client/database.ts
grep -q 'duckdb-eh.wasm' dist/client/app.js
grep -q 'CREATE TABLE resources' src/client/migrations/0000_create_resources.sql
if grep -ERq --include='*.ts' 'SELECT |WHERE |\.prepare\(' src/client; then
  printf '%s\n' 'Raw resource queries are not allowed in the application.' >&2
  exit 1
fi
if find src scripts -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \) | grep -q .; then
  printf '%s\n' 'Authored JavaScript files are not allowed; use TypeScript.' >&2
  exit 1
fi

printf '%s\n' 'All site checks passed.'
