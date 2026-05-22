// ── Config ──────────────────────────────────────────────────────────────────
const BIN_KEY = "$2a$10$YQtpXheoXVrQaXo3Sch4G..IWw/ZuAWYFnc1XPBxa82aBCieCR6XC";
const BIN_ID  = "6a1007006877513b27b2fcfe";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const CATEGORIES = ["Skole", "Klær", "Fritid", "Gym", "Jobb"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Des"];
const STATUS_ORDER = ["pending","ønske","sparer_til","bestilt","kjøpt"];
const STATUS_NEXT = { ønske:"sparer_til", sparer_til:"bestilt", bestilt:"kjøpt" };
const STATUS_LABELS = { pending:"Henter...", ønske:"Ønske", sparer_til:"Sparer til", bestilt:"Bestilt", kjøpt:"Kjøpt" };

// ── State ────────────────────────────────────────────────────────────────────
let data = { categories: CATEGORIES, items: [] };
let view = "wishlist";   // wishlist | months | archive
let filters = { cat: null, status: null, month: null };
let sort = "newest";     // newest | price_asc | price_desc | name

// ── JSONBin ──────────────────────────────────────────────────────────────────
async function load() {
  try {
    const r = await fetch(`${BIN_URL}/latest`, { headers: { "X-Master-Key": BIN_KEY } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    data = j.record;
    if (!data.items) data.items = [];
  } catch (e) {
    toast("Kan ikke laste data: " + e.message, true);
  }
}
async function save() {
  await fetch(BIN_URL, {
    method: "PUT",
    headers: { "X-Master-Key": BIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ── UUID ─────────────────────────────────────────────────────────────────────
function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background = isError ? "var(--danger)" : "var(--accent)";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

// ── Format ───────────────────────────────────────────────────────────────────
function fmt(price) {
  if (price == null) return null;
  return new Intl.NumberFormat("nb-NO").format(price) + " kr";
}
function priceDrop(item) {
  const h = item.price_history;
  if (!h || h.length < 2) return false;
  return h[h.length - 1].price < h[h.length - 2].price;
}

// ── Render helpers ───────────────────────────────────────────────────────────
function cardImg(item) {
  if (item.status === "pending") {
    const domain = (() => { try { return new URL(item.url).hostname.replace("www.",""); } catch { return "?"; } })();
    return `<div class="card-img">
      <div class="placeholder">${domain[0].toUpperCase()}</div>
      <div class="pending-overlay"><div class="spinner"></div> Henter...</div>
    </div>`;
  }
  if (item.image) {
    return `<div class="card-img"><img src="${item.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=placeholder>?</div>'"></div>`;
  }
  const domain = (() => { try { return new URL(item.url).hostname.replace("www.",""); } catch { return "?"; } })();
  return `<div class="card-img"><div class="placeholder">${domain[0].toUpperCase()}</div></div>`;
}

function renderCard(item) {
  const cats = (item.categories || []).map(c => `<span class="badge badge-cat">${c}</span>`).join("");
  const drop = priceDrop(item);
  const priceHtml = item.price_current
    ? `<div class="card-price">${fmt(item.price_current)}</div>`
    : `<div class="card-price no-price">${item.status === "pending" ? "—" : "Ingen pris"}</div>`;

  const actionBtns = item.status !== "pending" ? `
    <div class="card-actions">
      ${STATUS_NEXT[item.status] ? `<button onclick="nextStatus('${item.id}')">→ ${STATUS_LABELS[STATUS_NEXT[item.status]]}</button>` : ""}
      <button onclick="openEdit('${item.id}')">Rediger</button>
      <button class="btn-delete" onclick="deleteItem('${item.id}')">✕</button>
    </div>` : `
    <div class="card-actions">
      <button class="btn-delete" onclick="deleteItem('${item.id}')">Avbryt</button>
    </div>`;

  return `<div class="card" data-id="${item.id}">
    ${drop ? '<div class="price-drop">↓ Prisfall</div>' : ""}
    <a href="${item.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">
      ${cardImg(item)}
    </a>
    <div class="card-body">
      <div class="card-name">${item.name || item.url}</div>
      ${priceHtml}
      <div class="badges">
        <span class="badge badge-${item.status}">${STATUS_LABELS[item.status] || item.status}</span>
        ${cats}
      </div>
    </div>
    ${actionBtns}
  </div>`;
}

// ── Views ────────────────────────────────────────────────────────────────────
function activeItems() {
  return data.items.filter(i => i.status !== "kjøpt");
}
function filteredItems() {
  const items = activeItems().filter(i => {
    if (filters.cat && !(i.categories || []).includes(filters.cat)) return false;
    if (filters.status && i.status !== filters.status) return false;
    if (filters.month && i.month !== filters.month) return false;
    return true;
  });
  return items.sort((a, b) => {
    if (sort === "price_asc")  return (a.price_current || Infinity) - (b.price_current || Infinity);
    if (sort === "price_desc") return (b.price_current || 0) - (a.price_current || 0);
    if (sort === "name")       return (a.name || "").localeCompare(b.name || "", "nb");
    return new Date(b.added_at || 0) - new Date(a.added_at || 0);
  });
}

function renderWishlist() {
  const items = filteredItems();
  const main = document.getElementById("main");
  if (!items.length) {
    main.innerHTML = `<div class="empty"><div class="empty-icon">🛒</div>
      <p>Ingen varer her ennå.<br>Lim inn en lenke øverst for å legge til.</p></div>`;
    return;
  }
  main.innerHTML = `<div class="grid">${items.map(renderCard).join("")}</div>`;
}

function renderMonths() {
  const items = activeItems().filter(i => i.status !== "pending" && i.month);
  const byMonth = {};
  MONTHS.forEach(m => { byMonth[m] = []; });
  items.forEach(i => { if (byMonth[i.month]) byMonth[i.month].push(i); });

  const html = MONTHS.map(m => {
    const list = byMonth[m];
    if (!list.length) return "";
    const total = list.reduce((s, i) => s + (i.price_current || 0), 0);
    return `<div class="month-block">
      <div class="month-header">
        <span>${m}</span>
        <span class="month-total">${fmt(total)}</span>
      </div>
      <div class="month-grid">${list.map(renderCard).join("")}</div>
    </div>`;
  }).join("");

  document.getElementById("main").innerHTML = html ||
    `<div class="empty"><div class="empty-icon">📅</div><p>Ingen varer med satt måned ennå.</p></div>`;
}

function renderArchive() {
  const items = data.items.filter(i => i.status === "kjøpt");
  const yearTotal = items.reduce((s, i) => s + (i.price_current || 0), 0);

  if (!items.length) {
    document.getElementById("main").innerHTML =
      `<div class="empty"><div class="empty-icon">✅</div><p>Ingen kjøpte varer ennå.</p></div>`;
    return;
  }

  const rows = items.map(i => {
    const thumbHtml = i.image
      ? `<div class="archive-thumb"><img src="${i.image}" alt="" onerror="this.parentNode.innerHTML='?'"></div>`
      : `<div class="archive-thumb">${(i.name || "?")[0].toUpperCase()}</div>`;
    return `<div class="archive-item">
      ${thumbHtml}
      <div class="archive-info">
        <div class="archive-name">${i.name || i.url}</div>
        <div class="archive-date">${i.purchased_at ? i.purchased_at.slice(0,10) : ""}</div>
      </div>
      <div class="archive-price">${fmt(i.price_current) || "—"}</div>
    </div>`;
  }).join("");

  document.getElementById("main").innerHTML = `<div class="archive-view">
    <div class="archive-header">
      <span>Kjøpt i ${new Date().getFullYear()}</span>
      <span style="color:var(--success)">${fmt(yearTotal)}</span>
    </div>
    ${rows}
  </div>`;
}

function renderTotals() {
  const active = activeItems().filter(i => i.status !== "pending");
  const total = active.reduce((s, i) => s + (i.price_current || 0), 0);

  const byCat = {};
  CATEGORIES.forEach(c => { byCat[c] = 0; });
  active.forEach(i => (i.categories || []).forEach(c => { if (byCat[c] != null) byCat[c] += i.price_current || 0; }));

  let html = `<div class="total-chip">Totalt: <span>${fmt(total)}</span></div>`;
  CATEGORIES.forEach(c => {
    if (byCat[c] > 0) html += `<div class="total-chip">${c}: <span>${fmt(byCat[c])}</span></div>`;
  });
  document.getElementById("totals-bar").innerHTML = html;
}

function renderFilters() {
  const bar = document.getElementById("filter-bar");
  const sortBtns = [
    { key: "newest",     label: "Nyeste" },
    { key: "price_asc",  label: "Billigst" },
    { key: "price_desc", label: "Dyreste" },
    { key: "name",       label: "Navn A–Å" },
  ].map(s =>
    `<button class="filter-btn sort-btn ${sort === s.key ? "active" : ""}" onclick="setSort('${s.key}')">${s.label}</button>`
  ).join("");
  const statusBtns = STATUS_ORDER.filter(s => s !== "kjøpt").map(s =>
    `<button class="filter-btn ${filters.status === s ? "active" : ""}" onclick="toggleFilter('status','${s}')">${STATUS_LABELS[s]}</button>`
  ).join("");
  const catBtns = CATEGORIES.map(c =>
    `<button class="filter-btn ${filters.cat === c ? "active" : ""}" onclick="toggleFilter('cat','${c}')">${c}</button>`
  ).join("");
  const monthBtns = MONTHS.map(m =>
    `<button class="filter-btn ${filters.month === m ? "active" : ""}" onclick="toggleFilter('month','${m}')">${m}</button>`
  ).join("");

  bar.innerHTML = `
    <span class="filter-sep">Sorter:</span>${sortBtns}
    <span class="filter-sep">Filter:</span>
    <button class="filter-btn ${!filters.cat && !filters.status && !filters.month ? "active" : ""}" onclick="clearFilters()">Alle</button>
    ${statusBtns}${catBtns}${monthBtns}`;
}

function toggleFilter(key, val) {
  filters[key] = filters[key] === val ? null : val;
  render();
}
function clearFilters() {
  filters = { cat: null, status: null, month: null };
  render();
}
function setSort(key) {
  sort = key;
  render();
}

function render() {
  renderTotals();
  renderFilters();
  if (view === "wishlist") renderWishlist();
  else if (view === "months") renderMonths();
  else renderArchive();

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`nav-${view}`).classList.add("active");
}

// ── Add item ─────────────────────────────────────────────────────────────────
async function addItem(url) {
  url = url.trim();
  if (!url || !url.startsWith("http")) { toast("Lim inn en gyldig URL", true); return; }
  if (data.items.find(i => i.url === url)) { toast("Lenken er allerede i lista"); return; }

  const manualName  = document.getElementById("add-name").value.trim();
  const manualPrice = parseInt(document.getElementById("add-price").value, 10) || null;
  const now         = new Date().toISOString();

  const item = {
    id: uuid(), url,
    status: manualName ? "ønske" : "pending",
    name:   manualName || null,
    image:  null,
    price_current: manualPrice,
    price_history: manualPrice ? [{ date: now.slice(0,10), price: manualPrice }] : [],
    currency: "NOK",
    categories: [], subcategory: "", month: null, notes: "",
    last_error: null, added_at: now, purchased_at: null,
  };
  data.items.unshift(item);
  document.getElementById("add-name").value  = "";
  document.getElementById("add-price").value = "";
  render();
  try {
    await save();
    toast(manualName ? "Lagt til!" : "Lagt til! Henter info automatisk…");
  } catch (e) {
    toast("Lagringsfeil: " + e.message, true);
  }
}

// ── Item actions ─────────────────────────────────────────────────────────────
async function nextStatus(id) {
  const item = data.items.find(i => i.id === id);
  if (!item || !STATUS_NEXT[item.status]) return;
  item.status = STATUS_NEXT[item.status];
  if (item.status === "kjøpt") item.purchased_at = new Date().toISOString();
  render();
  await save();
}

async function deleteItem(id) {
  data.items = data.items.filter(i => i.id !== id);
  render();
  await save();
  toast("Slettet");
}

// ── Edit modal ────────────────────────────────────────────────────────────────
let editId = null;
function openEdit(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  editId = id;

  document.getElementById("edit-name").value = item.name || "";
  document.getElementById("edit-month").value = item.month || "";
  document.getElementById("edit-notes").value = item.notes || "";
  document.getElementById("edit-status").value = item.status;

  CATEGORIES.forEach(c => {
    const cb = document.getElementById("cb-" + c);
    if (cb) cb.checked = (item.categories || []).includes(c);
  });

  document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  editId = null;
}

async function saveEdit() {
  const item = data.items.find(i => i.id === editId);
  if (!item) return;
  item.name       = document.getElementById("edit-name").value.trim() || item.name;
  item.month      = document.getElementById("edit-month").value || null;
  item.notes      = document.getElementById("edit-notes").value.trim();
  item.status     = document.getElementById("edit-status").value;
  item.categories = CATEGORIES.filter(c => document.getElementById("cb-" + c)?.checked);
  if (item.status === "kjøpt" && !item.purchased_at) item.purchased_at = new Date().toISOString();
  closeModal();
  render();
  await save();
  toast("Lagret");
}

// ── Share / URL param ─────────────────────────────────────────────────────────
function handleSharedUrl() {
  const params = new URLSearchParams(location.search);
  const sharedUrl = params.get("add") || params.get("url") || params.get("text");
  if (!sharedUrl) return;
  history.replaceState({}, "", location.pathname);
  const inp = document.getElementById("add-input");
  inp.value = sharedUrl;
  toast("Lenke mottatt — trykk Legg til");
  setTimeout(() => inp.focus(), 300);
}

// ── Auto-refresh ──────────────────────────────────────────────────────────────
function startAutoRefresh() {
  setInterval(async () => {
    await load();
    render();
  }, 2 * 60 * 1000);
}

// ── Paste-knapp ───────────────────────────────────────────────────────────────
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.startsWith("http")) { toast("Ingen lenke i utklippstavlen", true); return; }
    document.getElementById("add-input").value = text;
    toast("Lenke limt inn — trykk Legg til");
  } catch {
    toast("Kunne ikke lese utklippstavlen", true);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  const saved = localStorage.getItem("hl-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  await load();
  render();
  handleSharedUrl();
  startAutoRefresh();
}

document.addEventListener("DOMContentLoaded", boot);
