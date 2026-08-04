import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { drizzle } from "@proj-airi/drizzle-duckdb-wasm";

import {
  findResources,
  resources,
  type ResourceInsert,
} from "../src/client/database.ts";

interface ResourcePayload {
  resourceOccurrences: number;
  resources: Array<Omit<ResourceInsert, "resourceOrder">>;
}

const asset = (name: string) =>
  fileURLToPath(
    new URL(`../node_modules/@duckdb/duckdb-wasm/dist/${name}`, import.meta.url),
  );
const bundles = {
  mvp: {
    mainModule: asset("duckdb-mvp.wasm"),
    mainWorker: asset("duckdb-node-mvp.worker.cjs"),
  },
  eh: {
    mainModule: asset("duckdb-eh.wasm"),
    mainWorker: asset("duckdb-node-eh.worker.cjs"),
  },
};

const [payloadText, migration] = await Promise.all([
  readFile(new URL("../data/resource-links.json", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../src/client/migrations/0000_create_resources.sql",
      import.meta.url,
    ),
    "utf8",
  ),
]);
const payload = JSON.parse(payloadText) as ResourcePayload;
const database = drizzle(
  { connection: { bundles } },
  { schema: { resources } },
);

await database.execute(migration);
await database.insert(resources).values(
  payload.resources.map((resource, resourceOrder) => ({
    ...resource,
    resourceOrder,
  })),
);

const allResources = await findResources(database);
const filtered = await findResources(database, {
  selectedTypes: ["Books and book chapters"],
  availableOnly: true,
  search: "staff",
});

if (allResources.length !== payload.resourceOccurrences) {
  throw new Error(
    `Expected ${payload.resourceOccurrences} resources, found ${allResources.length}`,
  );
}
if (filtered.length === 0) {
  throw new Error("Expected the representative Drizzle filter to return rows");
}
for (const resource of filtered) {
  if (
    resource.category !== "Books and book chapters" ||
    resource.status < 200 ||
    resource.status >= 400
  ) {
    throw new Error("Drizzle returned a row outside the requested filters");
  }
}

await (await database.$client).close();
console.log(`Drizzle DuckDB query test passed (${allResources.length} resources).`);
