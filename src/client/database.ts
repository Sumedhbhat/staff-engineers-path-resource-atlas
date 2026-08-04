import type { DuckDBWasmDrizzleDatabase } from "@proj-airi/drizzle-duckdb-wasm";
import { and, asc, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const resources = pgTable("resources", {
  resourceOrder: integer("resource_order").primaryKey(),
  chapter: text("chapter").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  appearance: integer("appearance").notNull(),
  originalUrl: text("original_url").notNull(),
  resolvedUrl: text("resolved_url").notNull(),
  status: integer("status").notNull(),
});

export type Database = DuckDBWasmDrizzleDatabase<{
  resources: typeof resources;
}>;
export type Resource = typeof resources.$inferSelect;
export type ResourceInsert = typeof resources.$inferInsert;

export interface ResourceFilters {
  selectedTypes?: string[];
  availableOnly?: boolean;
  search?: string;
}

export function findResources(
  database: Database,
  { selectedTypes = [], availableOnly = false, search = "" }: ResourceFilters = {},
) {
  const filters: SQL[] = [];

  if (selectedTypes.length) {
    filters.push(inArray(resources.category, selectedTypes));
  }
  if (availableOnly) {
    filters.push(gte(resources.status, 200), lt(resources.status, 400));
  }
  if (search.trim()) {
    const needle = `%${search.trim()}%`;
    const searchFilter = or(
      ilike(resources.title, needle),
      ilike(resources.category, needle),
      ilike(resources.resolvedUrl, needle),
      ilike(resources.chapter, needle),
    );
    if (searchFilter) filters.push(searchFilter);
  }

  let query = database.select().from(resources).$dynamic();
  const combinedFilter = and(...filters);
  if (combinedFilter) query = query.where(combinedFilter);
  return query.orderBy(asc(resources.resourceOrder));
}
