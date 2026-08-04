import { readFile, writeFile } from "node:fs/promises";

interface ResourceRow {
  chapter: string;
  category: string;
  title: string;
  appearance: number;
  originalUrl: string;
  resolvedUrl: string;
  status: number;
}

interface ResourcePayload {
  resources: ResourceRow[];
}

const projectRoot = new URL("../", import.meta.url);
const payload = JSON.parse(
  await readFile(new URL("data/resource-links.json", projectRoot), "utf8"),
) as ResourcePayload;

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const chapters = [...new Set(payload.resources.map(({ chapter }) => chapter))];
const categories = [
  ...new Set(payload.resources.map(({ category }) => category)),
].sort();
const successful = payload.resources.filter(
  ({ status }) => status >= 200 && status < 400,
).length;
const redirected = payload.resources.filter(
  ({ originalUrl, resolvedUrl }) => originalUrl !== resolvedUrl,
).length;

const option = (value: string) =>
  `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;

const rows = payload.resources
  .map(
    (resource, resourceOrder) => `
      <tr>
        <td class="number" data-value="${resourceOrder}">${resourceOrder}</td>
        <td>${escapeHtml(resource.chapter)}</td>
        <td>${escapeHtml(resource.category)}</td>
        <td class="title">${escapeHtml(resource.title)}</td>
        <td class="number" data-value="${resource.appearance}">${resource.appearance}</td>
        <td class="url"><a href="${escapeHtml(resource.originalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(resource.originalUrl)}</a></td>
        <td class="url"><a href="${escapeHtml(resource.resolvedUrl)}" target="_blank" rel="noreferrer">${escapeHtml(resource.resolvedUrl)}</a></td>
        <td class="number status status-${Math.floor(resource.status / 100)}xx" data-value="${resource.status}">${resource.status}</td>
      </tr>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Complete DuckDB resources table for The Staff Engineer's Path Resource Atlas.">
  <title>All Resources — The Staff Engineer’s Path</title>
  <style>
    :root { --ink:#17201c; --muted:#66706a; --paper:#f5f1e8; --card:#fffdf8; --line:#d9d5ca; --forest:#1f4a38; --lime:#d9ee73; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--paper); font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    a { color:var(--forest); text-underline-offset:3px; }
    header { padding:48px clamp(20px,5vw,72px) 38px; color:white; background:var(--forest); }
    header a { color:var(--lime); }
    .back { display:inline-block; margin-bottom:28px; font-size:13px; }
    h1 { margin:0; max-width:900px; font-family:Georgia,serif; font-size:clamp(38px,6vw,72px); line-height:1; letter-spacing:-.035em; }
    .intro { max-width:720px; margin:22px 0 0; color:#cfdbd4; font-size:17px; }
    .stats { display:flex; flex-wrap:wrap; gap:12px 34px; margin-top:28px; color:#cfdbd4; }
    .stats strong { color:var(--lime); font-size:20px; }
    main { padding:32px clamp(14px,3vw,48px) 64px; }
    .controls { display:grid; grid-template-columns:minmax(240px,2fr) repeat(3,minmax(160px,1fr)); gap:12px; margin-bottom:18px; }
    label { display:flex; flex-direction:column; gap:6px; color:var(--muted); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    input, select { width:100%; min-height:44px; padding:10px 12px; color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:7px; font:14px inherit; }
    input:focus, select:focus { outline:3px solid rgba(217,238,115,.8); border-color:var(--forest); }
    .table-meta { display:flex; justify-content:space-between; gap:16px; margin:0 2px 10px; color:var(--muted); font-size:13px; }
    .table-wrap { overflow:auto; max-height:72vh; background:var(--card); border:1px solid var(--line); border-radius:10px; box-shadow:0 10px 30px rgba(25,36,30,.06); }
    table { width:100%; min-width:1380px; border-collapse:collapse; }
    th { position:sticky; top:0; z-index:1; padding:12px 10px; color:white; background:var(--forest); border-right:1px solid rgba(255,255,255,.12); text-align:left; font-size:11px; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
    th button { width:100%; padding:0; color:inherit; background:none; border:0; cursor:pointer; font:inherit; letter-spacing:inherit; text-align:left; text-transform:inherit; }
    th button::after { content:" ↕"; color:var(--lime); }
    td { max-width:320px; padding:11px 10px; border-top:1px solid var(--line); vertical-align:top; }
    tbody tr:hover { background:#f4f7e5; }
    .number { text-align:right; font-variant-numeric:tabular-nums; }
    .title { min-width:210px; font-weight:650; }
    .url { font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; overflow-wrap:anywhere; }
    .status { font-weight:750; }
    .status-2xx, .status-3xx { color:#17613b; }
    .status-4xx, .status-5xx { color:#a02f2f; }
    .empty { padding:48px; text-align:center; color:var(--muted); }
    footer { padding:0 clamp(20px,5vw,72px) 42px; color:var(--muted); }
    @media (max-width:900px) { .controls { grid-template-columns:1fr 1fr; } }
    @media (max-width:560px) { header { padding-top:30px; } .controls { grid-template-columns:1fr; } .table-meta { flex-direction:column; } }
    @media print { header { color:var(--ink); background:white; } header a,.intro,.stats { color:var(--ink); } .controls,.back,footer { display:none; } main { padding:0; } .table-wrap { max-height:none; overflow:visible; border:0; box-shadow:none; } table { min-width:0; font-size:8px; } th { position:static; color:white; } td { max-width:none; padding:4px; } }
  </style>
</head>
<body>
  <header>
    <a class="back" href="index.html">← Back to Resource Atlas</a>
    <h1>Complete resources table</h1>
    <p class="intro">Every row and column loaded into the local DuckDB <code>resources</code> table, presented as a searchable standalone HTML document.</p>
    <div class="stats">
      <span><strong>${payload.resources.length}</strong> rows</span>
      <span><strong>${chapters.length}</strong> chapters</span>
      <span><strong>${categories.length}</strong> categories</span>
      <span><strong>${successful}</strong> checked links</span>
      <span><strong>${redirected}</strong> redirects</span>
    </div>
  </header>
  <main>
    <section class="controls" aria-label="Table filters">
      <label>Search all fields<input id="search" type="search" placeholder="Title, URL, chapter…" autocomplete="off"></label>
      <label>Chapter<select id="chapter"><option value="">All chapters</option>${chapters.map(option).join("")}</select></label>
      <label>Category<select id="category"><option value="">All categories</option>${categories.map(option).join("")}</select></label>
      <label>Link status<select id="status"><option value="">All statuses</option><option value="available">Available (200–399)</option><option value="unavailable">Unavailable (other)</option><option value="redirected">Redirected URL</option></select></label>
    </section>
    <div class="table-meta"><span id="result-count" aria-live="polite">Showing all ${payload.resources.length} rows</span><span>Click a column heading to sort · Print to save as PDF</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${["Order","Chapter","Category","Title","Appearance","Original URL","Resolved URL","Status"].map((heading, index) => `<th scope="col"><button type="button" data-column="${index}">${heading}</button></th>`).join("")}
        </tr></thead>
        <tbody id="rows">${rows}
        </tbody>
      </table>
      <div id="empty" class="empty" hidden>No resources match these filters.</div>
    </div>
  </main>
  <footer>Generated from <code>data/resource-links.json</code> · Source data checked August 2026</footer>
  <script>
    const body = document.querySelector("#rows");
    const rows = [...body.rows];
    const search = document.querySelector("#search");
    const chapter = document.querySelector("#chapter");
    const category = document.querySelector("#category");
    const status = document.querySelector("#status");
    const count = document.querySelector("#result-count");
    const empty = document.querySelector("#empty");
    let sortColumn = 0;
    let sortDirection = 1;

    function filterRows() {
      const needle = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      for (const row of rows) {
        const code = Number(row.cells[7].dataset.value);
        const redirected = row.cells[5].textContent !== row.cells[6].textContent;
        const statusMatch = !status.value ||
          (status.value === "available" && code >= 200 && code < 400) ||
          (status.value === "unavailable" && (code < 200 || code >= 400)) ||
          (status.value === "redirected" && redirected);
        const show = (!needle || row.textContent.toLocaleLowerCase().includes(needle)) &&
          (!chapter.value || row.cells[1].textContent === chapter.value) &&
          (!category.value || row.cells[2].textContent === category.value) && statusMatch;
        row.hidden = !show;
        if (show) visible++;
      }
      count.textContent = visible === rows.length
        ? "Showing all " + rows.length + " rows"
        : "Showing " + visible + " of " + rows.length + " rows";
      empty.hidden = visible !== 0;
    }

    function sortRows(column) {
      sortDirection = sortColumn === column ? -sortDirection : 1;
      sortColumn = column;
      rows.sort((a, b) => {
        const aCell = a.cells[column];
        const bCell = b.cells[column];
        const aValue = aCell.dataset.value ?? aCell.textContent.trim();
        const bValue = bCell.dataset.value ?? bCell.textContent.trim();
        return aValue.localeCompare(bValue, undefined, { numeric:true, sensitivity:"base" }) * sortDirection;
      });
      body.append(...rows);
    }

    [search, chapter, category, status].forEach((control) => control.addEventListener("input", filterRows));
    document.querySelectorAll("th button").forEach((button) => button.addEventListener("click", () => sortRows(Number(button.dataset.column))));
  </script>
</body>
</html>
`;

await writeFile(
  new URL("src/client/all-resources.html", projectRoot),
  html,
  "utf8",
);

console.log(`Generated all-resources.html with ${payload.resources.length} rows.`);
