#!/bin/sh
set -eu
mkdir -p dist/server dist/client
cp worker/index.js dist/server/index.js
cp index.html app.js styles.css resource-links.json dist/client/
