import { drizzle } from "@proj-airi/drizzle-duckdb-wasm";

import {
  findResources,
  resources,
  type Database,
  type Resource,
  type ResourceInsert,
} from "./database.ts";

interface ResourcePayload {
  resources: Array<Omit<ResourceInsert, "resourceOrder">>;
}

interface State {
  database: Database | null;
  resources: Resource[];
  selectedTypes: Set<string>;
  search: string;
  availableOnly: boolean;
  queryRevision: number;
}

interface TypeMeta {
  label: string;
  icon: string;
  tone: string;
}

const duckdbAsset = (name: string) =>
  new URL(`./duckdb/${name}`, import.meta.url).href;
const duckdbBundles = {
  mvp: {
    mainModule: duckdbAsset("duckdb-mvp.wasm"),
    mainWorker: duckdbAsset("duckdb-browser-mvp.worker.js"),
  },
  eh: {
    mainModule: duckdbAsset("duckdb-eh.wasm"),
    mainWorker: duckdbAsset("duckdb-browser-eh.worker.js"),
  },
};

const state: State = {
  database: null,
  resources: [],
  selectedTypes: new Set<string>(),
  search: "",
  availableOnly: false,
  queryRevision: 0,
};

const typeMeta: Record<string, TypeMeta> = {
  "Books and book chapters": { label: "Books", icon: "B", tone: "ochre" },
  "Articles and blog posts": { label: "Articles", icon: "A", tone: "blue" },
  "Videos, talks, and slide decks": {
    label: "Videos & talks",
    icon: "V",
    tone: "coral",
  },
  "Courses and exercises": { label: "Courses", icon: "C", tone: "green" },
  "Papers, RFCs, and reference documents": {
    label: "Papers & references",
    icon: "R",
    tone: "violet",
  },
  "Newsletters and conferences": {
    label: "Newsletters",
    icon: "N",
    tone: "teal",
  },
  "Tools, communities, and websites": {
    label: "Tools & websites",
    icon: "T",
    tone: "slate",
  },
  "Social posts, comics, and other media": {
    label: "Social & media",
    icon: "S",
    tone: "pink",
  },
};

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const escapeHtml = (value: unknown) =>
  String(value).replace(/[&<>"]/g, (char) => htmlEntities[char]);
const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown source";
  }
};
const isChecked = (resource: Resource) =>
  resource.status >= 200 && resource.status < 400;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function queryResources() {
  if (!state.database) throw new Error("Database has not been initialized");
  return findResources(state.database, {
    selectedTypes: [...state.selectedTypes],
    availableOnly: state.availableOnly,
    search: state.search,
  });
}

function renderFilters() {
  const counts = state.resources.reduce(
    (map, item) => map.set(item.category, (map.get(item.category) || 0) + 1),
    new Map<string, number>(),
  );
  getElement<HTMLElement>("#type-filters").innerHTML = Object.entries(typeMeta)
    .map(
      ([type, meta]) => `
    <button class="filter-button ${state.selectedTypes.has(type) ? "active" : ""}" type="button" data-type="${escapeHtml(type)}" aria-pressed="${state.selectedTypes.has(type)}">
      <span class="type-icon ${meta.tone}">${meta.icon}</span>
      <span>${meta.label}</span><small>${counts.get(type) || 0}</small>
    </button>`,
    )
    .join("");
}

function renderChapterNav(chapters: string[]) {
  getElement<HTMLElement>("#chapter-links").innerHTML = chapters
    .map(
      (chapter, index) => `
    <a href="#${slugify(chapter)}"><span>${String(index).padStart(2, "0")}</span>${escapeHtml(chapter.replace(/^Chapter \d+: /, ""))}</a>`,
    )
    .join("");
}

function resourceCard(resource: Resource) {
  const meta = typeMeta[resource.category];
  const redirected = resource.originalUrl !== resource.resolvedUrl;
  const checked = isChecked(resource);
  const statusLabel = checked
    ? redirected
      ? "Updated destination"
      : "Link checked"
    : "Check unavailable";
  return `<article class="resource-card">
    <div class="sequence" aria-label="Appearance ${resource.appearance}">${String(resource.appearance).padStart(2, "0")}</div>
    <div class="resource-body">
      <div class="resource-meta">
        <span class="type-pill"><span class="type-icon ${meta.tone}">${meta.icon}</span>${meta.label}</span>
        <span class="link-status ${checked ? "ok" : "warning"}"><i></i>${statusLabel}</span>
      </div>
      <h3><a href="${escapeHtml(resource.resolvedUrl)}" target="_blank" rel="noreferrer">${escapeHtml(resource.title)}<span aria-hidden="true">↗</span></a></h3>
      <div class="destination">
        <span>${escapeHtml(domainOf(resource.resolvedUrl))}</span>
        ${redirected ? `<span class="redirect-note" title="The original book URL redirects here">redirect resolved</span>` : ""}
      </div>
    </div>
  </article>`;
}

async function render() {
  if (!state.database) return;
  const revision = ++state.queryRevision;
  const chaptersElement = getElement<HTMLElement>("#chapters");
  chaptersElement.setAttribute("aria-busy", "true");
  renderFilters();

  try {
    const filtered = await queryResources();
    if (revision !== state.queryRevision) return;

    const allChapters = [
      ...new Set(state.resources.map((item) => item.chapter)),
    ];
    const chapterHtml = allChapters
      .map((chapter, chapterIndex) => {
        const items = filtered.filter((item) => item.chapter === chapter);
        if (!items.length) return "";
        return `<section class="chapter" id="${slugify(chapter)}">
      <header class="chapter-header">
        <span class="chapter-number">${String(chapterIndex).padStart(2, "0")}</span>
        <div><p>${chapter.startsWith("Introduction") ? "Opening" : `Chapter ${chapterIndex}`}</p><h2>${escapeHtml(chapter.replace(/^Chapter \d+: /, ""))}</h2></div>
        <span class="chapter-total">${items.length} ${items.length === 1 ? "reference" : "references"}</span>
      </header>
      <div class="resource-list">${items.map(resourceCard).join("")}</div>
    </section>`;
      })
      .join("");

    chaptersElement.innerHTML = chapterHtml;
    chaptersElement.setAttribute("aria-busy", "false");
    getElement<HTMLElement>("#result-count").textContent =
      `${filtered.length} of ${state.resources.length} references`;
    getElement<HTMLElement>("#empty-state").hidden = filtered.length !== 0;
  } catch (error) {
    if (revision !== state.queryRevision) return;
    chaptersElement.setAttribute("aria-busy", "false");
    chaptersElement.innerHTML =
      `<p class="load-error">${escapeHtml(errorMessage(error))}.</p>`;
  }
}

function clearFilters() {
  state.selectedTypes.clear();
  state.search = "";
  state.availableOnly = false;
  getElement<HTMLInputElement>("#search").value = "";
  getElement<HTMLInputElement>("#available-only").checked = false;
  render();
}

async function init() {
  try {
    const [resourceResponse, migrationResponse] = await Promise.all([
      fetch("resource-links.json"),
      fetch("migrations/0000_create_resources.sql"),
    ]);
    if (!resourceResponse.ok) {
      throw new Error("Resource data could not be loaded");
    }
    if (!migrationResponse.ok) {
      throw new Error("Database migration could not be loaded");
    }

    const data = (await resourceResponse.json()) as ResourcePayload;
    const migration = await migrationResponse.text();
    const database = drizzle(
      { connection: { bundles: duckdbBundles } },
      { schema: { resources } },
    );
    state.database = database;
    await database.execute(migration);
    await database.insert(resources).values(
      data.resources.map((resource, resourceOrder) => ({
        ...resource,
        resourceOrder,
      })),
    );

    state.resources = await queryResources();
    const chapters = [...new Set(state.resources.map((item) => item.chapter))];
    const redirected = new Set(
      state.resources
        .filter((item) => item.originalUrl !== item.resolvedUrl)
        .map((item) => item.originalUrl),
    ).size;
    getElement<HTMLElement>("#resource-count").textContent = String(
      state.resources.length,
    );
    getElement<HTMLElement>("#chapter-count").textContent = String(
      chapters.length,
    );
    getElement<HTMLElement>("#redirect-count").textContent = String(redirected);
    renderChapterNav(chapters);
    await render();
  } catch (error) {
    getElement<HTMLElement>("#chapters").innerHTML =
      `<p class="load-error">${escapeHtml(errorMessage(error))}. Please run this site through a local web server.</p>`;
  }
}

const searchInput = getElement<HTMLInputElement>("#search");
searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  render();
});

const availableOnlyInput = getElement<HTMLInputElement>("#available-only");
availableOnlyInput.addEventListener("change", () => {
  state.availableOnly = availableOnlyInput.checked;
  render();
});

getElement<HTMLElement>("#type-filters").addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>("[data-type]");
  const type = button?.dataset.type;
  if (!type) return;
  state.selectedTypes.has(type)
    ? state.selectedTypes.delete(type)
    : state.selectedTypes.add(type);
  render();
});
getElement<HTMLButtonElement>("#clear-filters").addEventListener(
  "click",
  clearFilters,
);
init();
