// ── Config ──────────────────────────────────────────────────────────────────
const BIN_KEY = "$2a$10$YQtpXheoXVrQaXo3Sch4G..IWw/ZuAWYFnc1XPBxa82aBCieCR6XC";
const BIN_ID  = "6a1007006877513b27b2fcfe";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const CATEGORIES = ["Skole", "Klær", "Fritid", "Gym", "Jobb", "Arbeid"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Des"];
const CAT_CLS = { "Skole": "skole", "Klær": "klar", "Fritid": "fritid", "Gym": "gym", "Jobb": "jobb", "Arbeid": "arbeid" };
const CAT_ICONS = { "Skole": "🎓", "Klær": "👕", "Fritid": "🎮", "Gym": "🏋️", "Jobb": "💼", "Arbeid": "🔧" };
const STATUS_ORDER = ["pending","ønske","sparer_til","bestilt","kjøpt"];
const STATUS_NEXT = { ønske:"sparer_til", sparer_til:"bestilt", bestilt:"kjøpt" };
const STATUS_LABELS = { pending:"Henter...", ønske:"Ønske", sparer_til:"Sparer til", bestilt:"Bestilt", kjøpt:"Kjøpt" };
const STATUS_ICONS  = { pending:"⏳", ønske:"♡", sparer_til:"💰", bestilt:"📦", kjøpt:"✓" };

// ── State ────────────────────────────────────────────────────────────────────
let data = { categories: CATEGORIES, items: [] };
let view = "wishlist";
let filters = { cat: null, status: null, month: null };
let sort = "newest";
let searchQuery = "";
let calSelectedMonth = null;

// ── JSONBin ──────────────────────────────────────────────────────────────────
const CACHE_KEY = "hl-data-cache";

function saveCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
}
function loadCache() {
  try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

async function load() {
  try {
    const r = await fetch(`${BIN_URL}/latest`, { headers: { "X-Master-Key": BIN_KEY } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    data = j.record;
    if (!data.items) data.items = [];
    saveCache(data);
    const offlineBanner = document.getElementById("offline-banner");
    if (offlineBanner) offlineBanner.style.display = "none";
  } catch (e) {
    const cached = loadCache();
    if (cached) {
      data = cached;
      if (!data.items) data.items = [];
      const offlineBanner = document.getElementById("offline-banner");
      if (offlineBanner) offlineBanner.style.display = "block";
    } else {
      toast("Kan ikke laste data: " + e.message, true);
    }
  }
}
async function save() {
  await fetch(BIN_URL, {
    method: "PUT",
    headers: { "X-Master-Key": BIN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  saveCache(data);
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
    return `<div class="card-img-wrap">
      <div class="placeholder">${domain[0].toUpperCase()}</div>
      <div class="pending-overlay"><div class="spinner"></div> Henter...</div>
    </div>`;
  }
  if (item.image) {
    return `<div class="card-img-wrap"><img src="${item.image}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=placeholder>?</div>'"></div>`;
  }
  const domain = (() => { try { return new URL(item.url).hostname.replace("www.",""); } catch { return "?"; } })();
  return `<div class="card-img-wrap"><div class="placeholder">${domain[0].toUpperCase()}</div></div>`;
}

function renderCard(item) {
  const drop = priceDrop(item);
  const priceHtml = item.price_current
    ? `<div class="card-price">${fmt(item.price_current)}</div>`
    : `<div class="card-price no-price">${item.status === "pending" ? "—" : item.utsolgt ? "Utsolgt" : "Ingen pris"}</div>`;
  const monthHtml = item.month
    ? `<div class="card-month">📅 ${item.month}</div>` : "";

  const statusBadge = (item.status !== "kjøpt" && item.status !== "ønske") ? `
    <div class="status-badge">
      ${item.status !== "pending" ? `<span class="status-dot-sm sd-${item.status === "sparer_til" ? "sparer" : item.status}"></span>` : ""}
      ${STATUS_ICONS[item.status] || ""} ${item.status !== "pending" ? STATUS_LABELS[item.status] : "Henter…"}
    </div>` : "";

  const imgHtml = cardImg(item);

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
    ${statusBadge}
    <a href="${item.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">
      ${imgHtml}
    </a>
    <div class="card-body">
      <div class="card-name">${item.name || item.url}</div>
      ${priceHtml}
      ${monthHtml}
    </div>
    ${actionBtns}
  </div>`;
}

// ── Views ────────────────────────────────────────────────────────────────────
function activeItems() {
  return data.items.filter(i => i.status !== "kjøpt");
}
function filteredItems() {
  const q = searchQuery.trim().toLowerCase();
  const items = activeItems().filter(i => {
    if (i.status === "pending") return false;
    if (filters.cat && !(i.categories || []).includes(filters.cat)) return false;
    if (filters.status && i.status !== filters.status) return false;
    if (filters.month && i.month !== filters.month) return false;
    if (q && !((i.name || "") + (i.url || "") + (i.notes || "")).toLowerCase().includes(q)) return false;
    return true;
  });
  return items.sort((a, b) => {
    if (sort === "price_asc")  return (a.price_current || Infinity) - (b.price_current || Infinity);
    if (sort === "price_desc") return (b.price_current || 0) - (a.price_current || 0);
    if (sort === "name")       return (a.name || "").localeCompare(b.name || "", "nb");
    return new Date(b.added_at || 0) - new Date(a.added_at || 0);
  });
}

function renderNextPurchase() {
  const bar = document.getElementById("next-purchase-bar");
  if (!bar) return;
  if (view !== "wishlist") { bar.innerHTML = ""; return; }
  const candidates = activeItems().filter(i => i.month && i.status !== "pending" && i.price_current);
  if (!candidates.length) { bar.innerHTML = ""; return; }
  const sorted = candidates.slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const next = sorted[0];
  const imgHtml = next.image
    ? `<img src="${next.image}" alt="" onerror="this.style.display='none'">`
    : `<span>${(next.name || "?")[0].toUpperCase()}</span>`;
  bar.innerHTML = `<div class="next-purchase" onclick="openPurchasePlan()">
    <div class="next-img">${imgHtml}</div>
    <div class="next-info">
      <div class="next-label">⏳ Neste kjøp — ${next.month}</div>
      <div class="next-name">${next.name || next.url}</div>
      <div class="next-month">${STATUS_LABELS[next.status] || next.status} · ${(next.categories || []).join(" · ")}</div>
    </div>
    <div class="next-price-col">
      <div class="next-price">${fmt(next.price_current)}</div>
    </div>
  </div>`;
}

function renderPendingBar() {
  const pending = data.items.filter(i => i.status === "pending");
  const el = document.getElementById("pending-bar");
  if (!el) return;
  if (!pending.length) { el.innerHTML = ""; return; }
  const rows = pending.map(item => {
    const domain = (() => { try { return new URL(item.url).hostname.replace("www.",""); } catch { return "?"; } })();
    const initial = domain[0].toUpperCase();
    return `<div class="pq-item">
      <div class="pq-avatar">${initial}</div>
      <div class="pq-info">
        <div class="pq-domain">${domain}</div>
        <div class="pq-url">${item.url.replace(/^https?:\/\/(www\.)?/,"").split("?")[0].slice(0,40)}</div>
      </div>
      <div class="pq-spinner"></div>
      <button class="pq-delete" onclick="deleteItem('${item.id}')">✕</button>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="pending-queue">
    <div class="pq-header">⏳ Henter ${pending.length} vare${pending.length > 1 ? "r" : ""}…</div>
    ${rows}
  </div>`;
}

function renderWishlist() {
  const items = filteredItems();
  const main = document.getElementById("main");
  const isFiltered = filters.cat || filters.status || searchQuery.trim();

  if (!items.length) {
    main.innerHTML = `<div class="empty"><div class="empty-icon">🛒</div>
      <p>Ingen varer her ennå.<br>Lim inn en lenke øverst for å legge til.</p></div>`;
    return;
  }

  if (isFiltered) {
    main.innerHTML = `<div class="grid">${items.map(renderCard).join("")}</div>`;
    return;
  }

  // Grouped by category with section headers + totals
  let html = "";
  const shown = new Set();

  CATEGORIES.forEach(cat => {
    const catItems = items.filter(i => (i.categories || []).includes(cat));
    if (!catItems.length) return;
    catItems.forEach(i => shown.add(i.id));
    const total = catItems.reduce((s, i) => s + (i.price_current || 0), 0);
    html += `<div class="section">
      <div class="section-header">
        <div class="section-title"><span class="section-title-icon">${CAT_ICONS[cat]}</span>${cat}</div>
        ${total ? `<div class="section-total">${fmt(total)}</div>` : ""}
      </div>
      <div class="grid">${catItems.map(renderCard).join("")}</div>
    </div>`;
  });

  const rest = items.filter(i => !shown.has(i.id));
  if (rest.length) {
    const total = rest.reduce((s, i) => s + (i.price_current || 0), 0);
    html += `<div class="section">
      <div class="section-header">
        <div class="section-title"><span class="section-title-icon">📦</span>Andre</div>
        ${total ? `<div class="section-total">${fmt(total)}</div>` : ""}
      </div>
      <div class="grid">${rest.map(renderCard).join("")}</div>
    </div>`;
  }

  main.innerHTML = html;
}

function renderMonths() {
  const items = activeItems().filter(i => i.status !== "pending" && i.month);
  const byMonth = {};
  MONTHS.forEach(m => { byMonth[m] = []; });
  items.forEach(i => { if (byMonth[i.month]) byMonth[i.month].push(i); });

  const calCards = MONTHS.map(m => {
    const list = byMonth[m];
    const total = list.reduce((s, i) => s + (i.price_current || 0), 0);
    const hasItems = list.length > 0;
    const isSelected = calSelectedMonth === m && hasItems;

    const thumbs = list.slice(0, 3).map(i =>
      i.image
        ? `<img class="cal-thumb" src="${i.image}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : `<div class="cal-thumb cal-thumb-letter">${(i.name || "?")[0]}</div>`
    ).join("");

    return `<div class="cal-card ${hasItems ? "cal-has" : "cal-empty"}${isSelected ? " cal-selected" : ""}"
      ${hasItems ? `onclick="calSelect('${m}')"` : ""}>
      <div class="cal-mname">${m}</div>
      ${hasItems
        ? `<div class="cal-thumbs">${thumbs}</div>
           <div class="cal-meta">
             <span class="cal-count">${list.length}×</span>
             <span class="cal-total">${fmt(total)}</span>
           </div>`
        : `<div class="cal-none">·</div>`}
    </div>`;
  }).join("");

  const selectedList = calSelectedMonth ? (byMonth[calSelectedMonth] || []) : [];
  const detailHtml = selectedList.length
    ? `<div class="cal-detail">
        <div class="cal-detail-header">
          <span>${calSelectedMonth}</span>
          <span>${fmt(selectedList.reduce((s, i) => s + (i.price_current || 0), 0))}</span>
        </div>
        <div class="cal-detail-grid">${selectedList.map(renderCard).join("")}</div>
      </div>`
    : "";

  document.getElementById("main").innerHTML = `<div class="cal-wrap">
    <div class="cal-grid">${calCards}</div>
    ${detailHtml}
  </div>`;
}

function calSelect(m) {
  calSelectedMonth = calSelectedMonth === m ? null : m;
  renderMonths();
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
  const prevCatScroll = bar.querySelector(".cat-tabs")?.scrollLeft ?? 0;
  const prevRowScroll = bar.querySelector(".filter-row")?.scrollLeft ?? 0;

  const catTabs = [{ key: null, icon: "✨", label: "Alle" }, ...CATEGORIES.map(c => ({ key: c, icon: CAT_ICONS[c], label: c }))]
    .map(t => `<button type="button" class="cat-tab ${filters.cat === t.key ? "active" : ""}" onclick="toggleCat(${t.key ? `'${t.key}'` : 'null'})">
      <span class="cat-tab-icon">${t.icon}</span>${t.label}
    </button>`).join("");

  const statusPills = [
    { key: null,        cls: "pill-all",     label: "Alle" },
    { key: "ønske",     cls: "pill-ønske",   label: "Ønsker" },
    { key: "sparer_til",cls: "pill-sparer",  label: "Sparer til" },
    { key: "bestilt",   cls: "pill-bestilt", label: "Bestilt" },
  ].map(p => `<button type="button" class="fpill ${p.cls} ${filters.status === p.key ? "active" : ""}" onclick="toggleFilter('status',${p.key ? `'${p.key}'` : 'null'})">
    <span class="fpill-dot"></span>${p.label}
  </button>`).join("");

  const sortPills = [
    { key: "newest", label: "Nyeste" }, { key: "price_asc", label: "Billigst" },
    { key: "price_desc", label: "Dyreste" }, { key: "name", label: "A–Å" },
  ].map(s => `<button type="button" class="fpill fpill-sort ${sort === s.key ? "active" : ""}" onclick="setSort('${s.key}')">${sort === s.key ? "✓ " : ""}${s.label}</button>`).join("");

  bar.innerHTML = `
    <div class="filter-area">
      <div class="search-bar">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="search-input" type="text" placeholder="Søk…" value="${searchQuery}" oninput="setSearch(this.value)" autocomplete="off" autocorrect="off">
      </div>
      <div class="cat-tabs">${catTabs}</div>
      <div class="filter-row">${statusPills}<span class="pill-sep">↕</span>${sortPills}</div>
    </div>`;

  bar.querySelector(".cat-tabs").scrollLeft = prevCatScroll;
  bar.querySelector(".filter-row").scrollLeft = prevRowScroll;
}

function toggleFilter(key, val) {
  filters[key] = (val === null || filters[key] === val) ? null : val;
  render();
}
function toggleCat(val) {
  filters.cat = (val === null || filters.cat === val) ? null : val;
  render();
}
function clearFilters() {
  filters = { cat: null, status: null, month: null };
  searchQuery = "";
  render();
}
function setSort(key) {
  sort = key;
  render();
}
function setSearch(q) {
  searchQuery = q;
  renderWishlist();
}

function render() {
  renderTotals();
  renderNextPurchase();
  renderFilters();
  renderPendingBar();
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

// ── Purchase plan panel ───────────────────────────────────────────────────────
function openPurchasePlan() {
  const candidates = activeItems().filter(i => i.month && i.status !== "pending");
  const sorted = candidates.slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const total = sorted.reduce((s, i) => s + (i.price_current || 0), 0);

  const byMonth = {};
  sorted.forEach(i => {
    if (!byMonth[i.month]) byMonth[i.month] = [];
    byMonth[i.month].push(i);
  });

  let html = "";
  Object.keys(byMonth).forEach(m => {
    const list = byMonth[m];
    const mTotal = list.reduce((s, i) => s + (i.price_current || 0), 0);
    html += `<div class="plan-month-header">
      <span>📅 ${m}</span>
      <span class="plan-month-total">${mTotal ? fmt(mTotal) : ""}</span>
    </div>`;
    list.forEach(item => {
      const imgHtml = item.image
        ? `<img src="${item.image}" alt="" onerror="this.parentNode.innerHTML='<span>${(item.name||"?")[0]}</span>'">`
        : `<span>${(item.name || "?")[0].toUpperCase()}</span>`;
      const statusDot = item.status !== "ønske"
        ? `<span class="plan-dot sd-${item.status === "sparer_til" ? "sparer" : item.status}"></span>`
        : "";
      html += `<div class="plan-item" onclick="closePurchasePlan();openEdit('${item.id}')">
        <div class="plan-thumb">${imgHtml}</div>
        <div class="plan-info">
          <div class="plan-name">${item.name || item.url}</div>
          <div class="plan-meta">${statusDot}${STATUS_LABELS[item.status] || item.status}</div>
        </div>
        <div class="plan-price">${item.price_current ? fmt(item.price_current) : "—"}</div>
      </div>`;
    });
  });

  document.getElementById("plan-total").textContent = total ? `Totalt: ${fmt(total)}` : "";
  document.getElementById("plan-list").innerHTML = html ||
    `<div style="text-align:center;padding:40px;color:var(--subtext)">Ingen planlagte kjøp</div>`;
  document.getElementById("plan-overlay").classList.add("open");
}

function closePurchasePlan() {
  document.getElementById("plan-overlay").classList.remove("open");
}

// ── Edit modal ────────────────────────────────────────────────────────────────
let editId = null;
function openEdit(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  editId = id;

  document.getElementById("edit-name").value  = item.name || "";
  document.getElementById("edit-price").value = item.price_current || "";
  document.getElementById("edit-month").value  = item.month || "";
  document.getElementById("edit-notes").value  = item.notes || "";
  document.getElementById("edit-status").value = item.status;
  const imgInput = document.getElementById("edit-image");
  const imgPreview = document.getElementById("edit-image-preview");
  imgInput.value = item.image || "";
  if (item.image) { imgPreview.src = item.image; imgPreview.style.display = "block"; }
  else imgPreview.style.display = "none";
  imgInput.oninput = () => {
    const v = imgInput.value.trim();
    if (v.startsWith("http")) { imgPreview.src = v; imgPreview.style.display = "block"; }
    else imgPreview.style.display = "none";
  };

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
  item.name   = document.getElementById("edit-name").value.trim() || item.name;
  item.month  = document.getElementById("edit-month").value || null;
  item.notes  = document.getElementById("edit-notes").value.trim();
  item.status = document.getElementById("edit-status").value;
  const newImg = document.getElementById("edit-image").value.trim();
  if (newImg && newImg.startsWith("http")) item.image = newImg;
  else if (!newImg) item.image = null;
  const newPrice = parseInt(document.getElementById("edit-price").value, 10);
  if (newPrice && newPrice !== item.price_current) {
    item.price_current = newPrice;
    const today = new Date().toISOString().slice(0, 10);
    item.price_history = [...(item.price_history || []), { date: today, price: newPrice }];
  }
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
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  }

  await load();
  render();
  handleSharedUrl();
  startAutoRefresh();
}

document.addEventListener("DOMContentLoaded", boot);
