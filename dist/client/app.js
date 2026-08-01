const state = { resources: [], selectedTypes: new Set(), search: "", availableOnly: false };

const typeMeta = {
  "Books and book chapters": { label: "Books", icon: "B", tone: "ochre" },
  "Articles and blog posts": { label: "Articles", icon: "A", tone: "blue" },
  "Videos, talks, and slide decks": { label: "Videos & talks", icon: "V", tone: "coral" },
  "Courses and exercises": { label: "Courses", icon: "C", tone: "green" },
  "Papers, RFCs, and reference documents": { label: "Papers & references", icon: "R", tone: "violet" },
  "Newsletters and conferences": { label: "Newsletters", icon: "N", tone: "teal" },
  "Tools, communities, and websites": { label: "Tools & websites", icon: "T", tone: "slate" },
  "Social posts, comics, and other media": { label: "Social & media", icon: "S", tone: "pink" },
};

const slugify = (value) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Unknown source"; } };
const isChecked = (resource) => resource.status >= 200 && resource.status < 400;

function filteredResources() {
  const needle = state.search.trim().toLowerCase();
  return state.resources.filter((resource) => {
    const matchesType = state.selectedTypes.size === 0 || state.selectedTypes.has(resource.category);
    const matchesAvailability = !state.availableOnly || isChecked(resource);
    const haystack = `${resource.title} ${resource.category} ${domainOf(resource.resolvedUrl)} ${resource.chapter}`.toLowerCase();
    return matchesType && matchesAvailability && (!needle || haystack.includes(needle));
  });
}

function renderFilters() {
  const counts = state.resources.reduce((map, item) => map.set(item.category, (map.get(item.category) || 0) + 1), new Map());
  document.querySelector("#type-filters").innerHTML = Object.entries(typeMeta).map(([type, meta]) => `
    <button class="filter-button ${state.selectedTypes.has(type) ? "active" : ""}" type="button" data-type="${escapeHtml(type)}" aria-pressed="${state.selectedTypes.has(type)}">
      <span class="type-icon ${meta.tone}">${meta.icon}</span>
      <span>${meta.label}</span><small>${counts.get(type) || 0}</small>
    </button>`).join("");
}

function renderChapterNav(chapters) {
  document.querySelector("#chapter-links").innerHTML = chapters.map((chapter, index) => `
    <a href="#${slugify(chapter)}"><span>${String(index).padStart(2, "0")}</span>${escapeHtml(chapter.replace(/^Chapter \d+: /, ""))}</a>`).join("");
}

function resourceCard(resource) {
  const meta = typeMeta[resource.category];
  const redirected = resource.originalUrl !== resource.resolvedUrl;
  const checked = isChecked(resource);
  const statusLabel = checked ? (redirected ? "Updated destination" : "Link checked") : "Check unavailable";
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

function render() {
  const filtered = filteredResources();
  const allChapters = [...new Set(state.resources.map((item) => item.chapter))];
  const chapterHtml = allChapters.map((chapter, chapterIndex) => {
    const items = filtered.filter((item) => item.chapter === chapter).sort((a, b) => a.appearance - b.appearance);
    if (!items.length) return "";
    return `<section class="chapter" id="${slugify(chapter)}">
      <header class="chapter-header">
        <span class="chapter-number">${String(chapterIndex).padStart(2, "0")}</span>
        <div><p>${chapter.startsWith("Introduction") ? "Opening" : `Chapter ${chapterIndex}`}</p><h2>${escapeHtml(chapter.replace(/^Chapter \d+: /, ""))}</h2></div>
        <span class="chapter-total">${items.length} ${items.length === 1 ? "reference" : "references"}</span>
      </header>
      <div class="resource-list">${items.map(resourceCard).join("")}</div>
    </section>`;
  }).join("");

  document.querySelector("#chapters").innerHTML = chapterHtml;
  document.querySelector("#chapters").setAttribute("aria-busy", "false");
  document.querySelector("#result-count").textContent = `${filtered.length} of ${state.resources.length} references`;
  document.querySelector("#empty-state").hidden = filtered.length !== 0;
  renderFilters();
}

function clearFilters() {
  state.selectedTypes.clear(); state.search = ""; state.availableOnly = false;
  document.querySelector("#search").value = "";
  document.querySelector("#available-only").checked = false;
  render();
}

async function init() {
  try {
    const response = await fetch("resource-links.json");
    if (!response.ok) throw new Error("Resource data could not be loaded");
    const data = await response.json();
    state.resources = data.resources;
    const chapters = [...new Set(state.resources.map((item) => item.chapter))];
    const redirected = new Set(state.resources.filter((item) => item.originalUrl !== item.resolvedUrl).map((item) => item.originalUrl)).size;
    document.querySelector("#resource-count").textContent = state.resources.length;
    document.querySelector("#chapter-count").textContent = chapters.length;
    document.querySelector("#redirect-count").textContent = redirected;
    renderChapterNav(chapters);
    render();
  } catch (error) {
    document.querySelector("#chapters").innerHTML = `<p class="load-error">${escapeHtml(error.message)}. Please run this site through a local web server.</p>`;
  }
}

document.querySelector("#search").addEventListener("input", (event) => { state.search = event.target.value; render(); });
document.querySelector("#available-only").addEventListener("change", (event) => { state.availableOnly = event.target.checked; render(); });
document.querySelector("#type-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]"); if (!button) return;
  const type = button.dataset.type;
  state.selectedTypes.has(type) ? state.selectedTypes.delete(type) : state.selectedTypes.add(type);
  render();
});
document.querySelector("#clear-filters").addEventListener("click", clearFilters);
init();
