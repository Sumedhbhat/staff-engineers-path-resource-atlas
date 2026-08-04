#!/bin/sh
set -eu

rm -rf dist
mkdir -p dist/client/duckdb dist/client/migrations dist/server

./node_modules/.bin/tsx scripts/generate-resources-html.ts
cp src/client/index.html src/client/all-resources.html src/client/styles.css dist/client/
cp src/client/migrations/0000_create_resources.sql dist/client/migrations/
cp data/resource-links.json dist/client/

cp node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm dist/client/duckdb/
cp node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm dist/client/duckdb/
cp node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js dist/client/duckdb/
cp node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js dist/client/duckdb/
./node_modules/.bin/esbuild src/client/app.ts \
  --bundle \
  --format=esm \
  --platform=browser \
  --external:@proj-airi/duckdb-wasm/bundles/* \
  --external:./bundles/* \
  --external:node:* \
  --external:web-worker \
  --target=es2022 \
  --outfile=dist/client/app.js
./node_modules/.bin/esbuild src/worker/index.ts \
  --bundle \
  --format=esm \
  --platform=browser \
  --target=es2022 \
  --outfile=dist/server/index.js
touch dist/client/.nojekyll
