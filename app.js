// ── Config ──────────────────────────────────────────────────────────────────
const BIN_KEY = "$2a$10$YQtpXheoXVrQaXo3Sch4G..IWw/ZuAWYFnc1XPBxa82aBCieCR6XC";
const BIN_ID  = "6a1007006877513b27b2fcfe";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const CATEGORIES = ["Skole", "Klær", "Fritid", "Gym", "Jobb", "Arbeid"];
const MONTHS = ["Jan","Feb","Mar","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Des"];
const CAT_ICONS = { "Skole": "🎓", "Klær": "👕", "Fritid": "🎮", "Gym": "🏋️", "Jobb": "💼", "Arbeid": "🔧" };
const EDITABLE_STATUSES = ["ser_på","ønske","sparer_til","bestilt","kjøpt"];
const STATUS_LABELS = { pending:"Henter...", ser_på:"Ser på", ønske:"Ønske", sparer_til:"Sparer til", bestilt:"Bestilt", kjøpt:"Kjøpt" };
const STATUS_PILL_CLASS = { ser_på:"sp-onske", ønske:"sp-onske", sparer_til:"sp-sparer", bestilt:"sp-bestilt", kjøpt:"sp-kjopt" };
const STATUS_ICONS = { ser_på:"👁", ønske:"♡", sparer_til:"💰", bestilt:"📦", kjøpt:"✓" };
const CARD_HEIGHTS = [188, 152, 214, 164];
const TINTS = [
  ["#e8ddd0","#ddcfbd"], ["#dbe3d6","#c9d6c0"], ["#dce2ea","#c7d2df"],
  ["#e6dbe0","#d8c6cf"], ["#e3ded0","#d3ccb5"], ["#d8e0e3","#c2ced2"],
];
const CURRENCY_CYCLE = ["NOK","EUR","USD","GBP","SEK","DKK"];
const THEME_CYCLE = ["warm","skog","skifer","plomme","dark","bw","navy","oldmoney"];
const THEME_LABELS = { warm:"Varm leire", skog:"Skog", skifer:"Kjølig skifer", plomme:"Plomme", dark:"Mørk antrasitt", bw:"Svart/hvit", navy:"Marineblå", oldmoney:"Old money" };
const SORT_CYCLE = ["newest","month","price_desc","name","oldest"];
const SORT_LABELS = { newest:"Nyeste", month:"Måned", price_desc:"Pris", name:"Navn", oldest:"Gamleste" };
const TIERS = [
  { key: "s", label: "Kjøp ved neste anledning", hue: 25  },
  { key: "a", label: "Kjøp snart",               hue: 55  },
  { key: "b", label: "Kjøp etterhvert",          hue: 95  },
  { key: "c", label: "Kan vente",                hue: 145 },
  { key: "d", label: "Lav prioritet",            hue: 255 },
];

// ── State ────────────────────────────────────────────────────────────────────
let data = { categories: CATEGORIES, items: [] };
let view = "wishlist";
let filters = { cat: null, status: null };
let sort = "newest";
let searchQuery = "";
let displayCurrency = localStorage.getItem("hl-currency") || "NOK";

// ── JSONBin ──────────────────────────────────────────────────────────────────
const CACHE_KEY = "hl-data-cache";

function saveCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
}
function loadCache() {
  try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

const PENDING_KEY = "hl-pending-sync";
function markPending(v) { try { localStorage.setItem(PENDING_KEY, v ? "1" : ""); } catch {} }
function hasPending()   { try { return localStorage.getItem(PENDING_KEY) === "1"; } catch { return false; } }

async function load() {
  try {
    // Endringer gjort offline? Push dem FØR fersk henting — ellers
    // ville sky-data overskrevet det som ble endret uten nett.
    if (hasPending()) {
      const cached = loadCache();
      if (cached) data = cached;
      const ok = await save();
      if (!ok) throw new Error("offline-pending");
    }
    const r = await fetch(`${BIN_URL}/latest`, { headers: { "X-Master-Key": BIN_KEY } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    data = j.record;
    if (!data.items) data.items = [];
    data.items.forEach(i => { if (typeof i.saved !== "number") i.saved = 0; });
    saveCache(data);
    const offlineBanner = document.getElementById("offline-banner");
    if (offlineBanner) offlineBanner.style.display = "none";
  } catch (e) {
    const cached = loadCache();
    if (cached) {
      data = cached;
      if (!data.items) data.items = [];
      data.items.forEach(i => { if (typeof i.saved !== "number") i.saved = 0; });
      const offlineBanner = document.getElementById("offline-banner");
      if (offlineBanner) offlineBanner.style.display = "block";
    } else {
      toast("Kan ikke laste data: " + e.message, true);
    }
  }
}
async function save() {
  // Lokal kopi FØRST — feiler nettet ligger endringen trygt og synkes senere
  saveCache(data);
  try {
    const r = await fetch(BIN_URL, {
      method: "PUT",
      headers: { "X-Master-Key": BIN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(r.status);
    markPending(false);
    return true;
  } catch (e) {
    markPending(true);
    const offlineBanner = document.getElementById("offline-banner");
    if (offlineBanner) offlineBanner.style.display = "block";
    toast("📴 Lagret lokalt — synkes når du får nett");
    return false;
  }
}

// Auto-synk når nettet kommer tilbake
window.addEventListener("online", () => {
  if (hasPending()) {
    save().then(ok => {
      if (ok) {
        toast("✓ Synkronisert etter frakobling");
        const b = document.getElementById("offline-banner");
        if (b) b.style.display = "none";
      }
    });
  }
});

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

// ── Valuta ───────────────────────────────────────────────────────────────────
let exchangeRates = null;
let ratesFetchedAt = 0;

async function getExchangeRates() {
  if (exchangeRates && Date.now() - ratesFetchedAt < 3_600_000) return exchangeRates;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/NOK");
    if (!r.ok) throw new Error();
    const j = await r.json();
    const rates = { NOK: 1 };
    for (const [cur, rate] of Object.entries(j.rates || {})) {
      if (rate) rates[cur] = 1 / rate;
    }
    exchangeRates = rates;
    ratesFetchedAt = Date.now();
  } catch {}
  return exchangeRates;
}

function toNok(amount, currency) {
  if (currency === "NOK") return Math.round(amount);
  if (!exchangeRates?.[currency]) return null;
  return Math.round(amount * exchangeRates[currency]);
}

async function updateCurrencyPreview() {
  const cur    = document.getElementById("edit-currency")?.value || "NOK";
  const amount = parseFloat(document.getElementById("edit-price")?.value);
  const preview = document.getElementById("currency-preview");
  if (!preview) return;
  if (cur === "NOK" || !amount || isNaN(amount)) { preview.textContent = ""; return; }
  const rates = await getExchangeRates();
  if (!rates) { preview.textContent = "Kunne ikke hente kurs — sjekk nett"; return; }
  const nok = toNok(amount, cur);
  if (nok == null) { preview.textContent = "Ukjent valuta"; return; }
  const rate = rates[cur];
  preview.textContent = `≈ ${fmt(nok)} · kurs: 1 ${cur} = ${rate.toFixed(2)} kr`;
}

function cycleCurrency() {
  const idx = CURRENCY_CYCLE.indexOf(displayCurrency);
  displayCurrency = CURRENCY_CYCLE[(idx + 1) % CURRENCY_CYCLE.length];
  localStorage.setItem("hl-currency", displayCurrency);
  document.getElementById("currency-pill").textContent = (displayCurrency === "NOK" ? "kr" : displayCurrency) + " ▾";
  getExchangeRates().then(render);
  render();
}

// ── Tema ─────────────────────────────────────────────────────────────────────
function cycleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const idx = THEME_CYCLE.indexOf(cur);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("hl-theme", next);
  toast(THEME_LABELS[next]);
}

// ── Format ───────────────────────────────────────────────────────────────────
function fmt(nok) {
  if (nok == null) return null;
  let amount = nok, prefix = "kr";
  if (displayCurrency !== "NOK" && exchangeRates?.[displayCurrency]) {
    amount = nok / exchangeRates[displayCurrency];
    prefix = displayCurrency;
  }
  return prefix + " " + new Intl.NumberFormat("nb-NO").format(Math.round(amount));
}
function priceDrop(item) {
  const h = item.price_history;
  if (!h || h.length < 2) return false;
  return h[h.length - 1].price < h[h.length - 2].price;
}
function allCategories() {
  const set = new Set(CATEGORIES);
  data.items.forEach(i => (i.categories || []).forEach(c => set.add(c)));
  return [...set].sort((a, b) => a.localeCompare(b, "nb"));
}
function tintFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
function cardImgError(img, tintA, tintB) {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.style.setProperty("--tintA", tintA);
  div.style.setProperty("--tintB", tintB);
  div.innerHTML = "<span>bilde</span>";
  img.replaceWith(div);
}

// Reserverer eksakt korthøyde før lazy-bildet lastes, så masonryen ikke
// re-balanseres under scrolling (layout-shift-fiksen 2026-07-15).
const IMG_DIMS_KEY = "hl_img_dims";
let imgDims = {};
try { imgDims = JSON.parse(localStorage.getItem(IMG_DIMS_KEY) || "{}") || {}; } catch (e) { imgDims = {}; }
function cacheImgDims(img) {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const key = img.getAttribute("src");
  const cur = imgDims[key];
  if (!cur || cur[0] !== img.naturalWidth || cur[1] !== img.naturalHeight) {
    imgDims[key] = [img.naturalWidth, img.naturalHeight];
    try { localStorage.setItem(IMG_DIMS_KEY, JSON.stringify(imgDims)); } catch (e) {}
  }
  img.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
}

// ── VareKort ─────────────────────────────────────────────────────────────────
function renderCard(item, index, archived = false) {
  const h = CARD_HEIGHTS[index % CARD_HEIGHTS.length];
  const [tintA, tintB] = tintFor(item.id);
  let imgHtml;
  if (item.image) {
    const dims = imgDims[item.image];
    const ratioStyle = dims ? ` style="aspect-ratio:${dims[0]} / ${dims[1]}"` : "";
    imgHtml = `<img src="${item.image}" alt="" loading="lazy"${ratioStyle} onload="cacheImgDims(this)" onerror="cardImgError(this,'${tintA}','${tintB}')">`;
  } else {
    imgHtml = `<div class="placeholder" style="--tintA:${tintA};--tintB:${tintB}"><span>bilde</span></div>`;
  }
  const pillCls = STATUS_PILL_CLASS[item.status] || "sp-onske";
  const cats = (item.categories || []).join(" · ");
  const meta = [cats, item.month].filter(Boolean).join(" · ") || "—";
  const priceHtml = item.price_current
    ? `<div class="card-price">${fmt(item.price_current)}</div>`
    : `<div class="card-price no-price">${item.utsolgt ? "Utsolgt" : "Ingen pris"}</div>`;

  let saveHtml = "";
  if (item.status === "sparer_til" && item.price_current) {
    const pct = Math.min(100, Math.round(((item.saved || 0) / item.price_current) * 100));
    saveHtml = `<div class="save-row">
        <div class="save-track"><div class="save-fill" style="width:${pct}%"></div></div>
        <div class="save-pct">${pct}%</div>
      </div>
      <button type="button" class="btn-spar" onclick="event.stopPropagation();openSpar('${item.id}')">+ Spar</button>`;
  }

  const dropHtml = priceDrop(item) ? `<div class="price-drop-badge">↓</div>` : "";

  return `<div class="card${archived ? " card-archived" : ""}" onclick="openDetail('${item.id}')">
    <div class="card-img-wrap${item.image ? " has-img" : ""}"${item.image ? "" : ` style="height:${h}px"`} onclick="event.stopPropagation();openCardLink('${item.id}')">${imgHtml}</div>
    <div class="status-pill ${pillCls}">${STATUS_LABELS[item.status]}</div>
    ${dropHtml}
    <div class="card-body">
      <div class="card-name">${item.name || item.url}</div>
      <div class="card-meta">${meta}</div>
      ${saveHtml}
      ${priceHtml}
    </div>
  </div>`;
}

function openCardLink(id) {
  const item = data.items.find(i => i.id === id);
  if (item && item.url) window.open(item.url, "_blank", "noopener");
  else openDetail(id);
}

// ── Produktdetalj (bunnark) ─────────────────────────────────────────────────
let detailId = null;

function openDetail(id) {
  const item = data.items.find(i => i.id === id);
  if (!item || item.status === "pending") return;
  detailId = id;

  const [tintA, tintB] = tintFor(item.id);
  const imgWrap = document.getElementById("detail-img-wrap");
  imgWrap.innerHTML = item.image
    ? `<img src="${item.image}" alt="" onerror="cardImgError(this,'${tintA}','${tintB}')">`
    : `<div class="placeholder" style="--tintA:${tintA};--tintB:${tintB}"></div>`;
  imgWrap.onclick = () => { if (item.url) window.open(item.url, "_blank", "noopener"); };

  document.getElementById("detail-name").textContent = item.name || item.url;

  const priceEl = document.getElementById("detail-price");
  if (item.price_current) {
    const h = item.price_history;
    let changeHtml = "";
    if (h && h.length >= 2) {
      const diff = h[h.length - 1].price - h[h.length - 2].price;
      if (diff !== 0) {
        const pct = Math.abs(Math.round((diff / h[h.length - 2].price) * 100));
        changeHtml = `<span class="detail-price-change ${diff < 0 ? "down" : "up"}">${diff < 0 ? "↓" : "↑"} ${pct}%</span>`;
      }
    }
    priceEl.innerHTML = `<span class="detail-price-amount">${fmt(item.price_current)}</span>${changeHtml}`;
  } else {
    priceEl.innerHTML = `<span class="detail-no-price">Ingen pris</span>`;
  }

  const catsEl = document.getElementById("detail-cats");
  const cats = item.categories || [];
  catsEl.innerHTML = cats.map(c => `<span class="detail-cat">${CAT_ICONS[c] ? CAT_ICONS[c] + " " : ""}${c}</span>`).join("");
  catsEl.style.display = cats.length ? "flex" : "none";

  const notesEl = document.getElementById("detail-notes");
  notesEl.textContent = item.notes || "";
  notesEl.style.display = item.notes ? "block" : "none";

  const statusRow = document.getElementById("detail-status-row");
  statusRow.innerHTML = EDITABLE_STATUSES.map(s => {
    const isActive = item.status === s;
    return `<button type="button" class="detail-status-btn${isActive ? " active" : ""}"
      onclick="setItemStatus('${item.id}','${s}')">${STATUS_ICONS[s]} ${STATUS_LABELS[s]}</button>`;
  }).join("");

  const urlBtn = document.getElementById("detail-url-btn");
  if (item.url) { urlBtn.href = item.url; urlBtn.style.display = "block"; }
  else urlBtn.style.display = "none";

  document.getElementById("detail-overlay").classList.add("open");
}

function closeDetail() {
  document.getElementById("detail-overlay").classList.remove("open");
  detailId = null;
}

async function setItemStatus(id, newStatus) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  item.status = newStatus;
  if (newStatus === "kjøpt" && !item.purchased_at) item.purchased_at = new Date().toISOString();

  if (detailId === id) {
    document.querySelectorAll("#detail-status-row .detail-status-btn").forEach((btn, idx) => {
      btn.classList.toggle("active", EDITABLE_STATUSES[idx] === newStatus);
    });
  }

  render();
  await save();
  toast(STATUS_LABELS[newStatus]);
}

function openEditFromDetail() {
  const id = detailId;
  closeDetail();
  setTimeout(() => openEdit(id), 60);
}

async function deleteFromDetail() {
  if (!detailId) return;
  const id = detailId;
  closeDetail();
  await deleteItem(id);
}

// ── Views ────────────────────────────────────────────────────────────────────
function activeItems() {
  return data.items.filter(i => i.status !== "kjøpt" && i.status !== "pending");
}
function filteredItems() {
  const q = searchQuery.trim().toLowerCase();
  const items = activeItems().filter(i => {
    if (filters.cat === "__none__" && (i.categories || []).length) return false;
    if (filters.cat && filters.cat !== "__none__" && !(i.categories || []).includes(filters.cat)) return false;
    if (filters.status && i.status !== filters.status) return false;
    if (q && !((i.name || "") + (i.url || "") + (i.notes || "")).toLowerCase().includes(q)) return false;
    return true;
  });
  return items.sort((a, b) => {
    if (sort === "month") {
      const ai = a.month ? MONTHS.indexOf(a.month) : 99, bi = b.month ? MONTHS.indexOf(b.month) : 99;
      return ai - bi;
    }
    if (sort === "price_desc") return (b.price_current || 0) - (a.price_current || 0);
    if (sort === "name")       return (a.name || "").localeCompare(b.name || "", "nb");
    if (sort === "oldest")     return new Date(a.added_at || 0) - new Date(b.added_at || 0);
    return new Date(b.added_at || 0) - new Date(a.added_at || 0);
  });
}
function cycleSort() {
  const idx = SORT_CYCLE.indexOf(sort);
  sort = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
  render();
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
      <button class="pq-delete" onclick="deleteItem('${item.id}')">&#x2715;</button>
    </div>`;
  }).join("");
  el.innerHTML = `<div class="pending-queue">
    <div class="pq-header">⏳ Henter ${pending.length} vare${pending.length > 1 ? "r" : ""}…</div>
    ${rows}
  </div>`;
}

function renderFilters() {
  const bar = document.getElementById("filter-bar");
  const active = activeItems();
  const catCounts = {};
  allCategories().forEach(c => { catCounts[c] = active.filter(i => (i.categories || []).includes(c)).length; });

  const catChips = [`<button type="button" class="chip ${!filters.cat ? "active" : ""}" onclick="toggleCat(null)">Alle <span class="chip-count">${active.length}</span></button>`]
    .concat(allCategories().filter(c => catCounts[c] > 0 || filters.cat === c).map(c =>
      `<button type="button" class="chip ${filters.cat === c ? "active" : ""}" onclick="toggleCat('${c}')">${CAT_ICONS[c] ? CAT_ICONS[c] + " " : ""}${c} <span class="chip-count">${catCounts[c]}</span></button>`
    )).join("");

  const statusOptions = [
    { key: null,         label: "Alle" },
    { key: "ser_på",     label: "Ser på" },
    { key: "ønske",      label: "Ønske" },
    { key: "sparer_til", label: "Sparer til" },
    { key: "bestilt",    label: "Bestilt" },
  ];
  const statusChips = statusOptions.map(s =>
    `<button type="button" class="chip ${filters.status === s.key ? "active" : ""}" onclick="toggleStatus(${s.key ? `'${s.key}'` : "null"})">${s.label}</button>`
  ).join("");

  bar.innerHTML = `
    <div class="filter-area">
      <div class="search-sort-row">
        <div class="search-bar">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" type="text" placeholder="Søk i ønsker" value="${searchQuery}" oninput="setSearch(this.value)" autocomplete="off" autocorrect="off">
        </div>
        <button type="button" class="sort-toggle" onclick="cycleSort()">${SORT_LABELS[sort]} ▾</button>
      </div>
      <div class="chip-row">${catChips}</div>
      <div class="chip-row chip-row-secondary">${statusChips}</div>
    </div>`;
}
function toggleCat(val) { filters.cat = (val === null || filters.cat === val) ? null : val; render(); }
function toggleStatus(val) { filters.status = (val === null || filters.status === val) ? null : val; render(); }
function setSearch(q) { searchQuery = q; renderWishlist(); }

function renderWishlist() {
  const items = filteredItems();
  const main = document.getElementById("main");
  if (!items.length) {
    main.innerHTML = `<div class="empty"><div class="empty-icon">🛒</div><p>Ingen treff.</p></div>`;
    return;
  }
  main.innerHTML = `<div class="gallery">${items.map((it, idx) => renderCard(it, idx)).join("")}</div>`;
}

function renderMonths() {
  const items = activeItems();
  const byMonth = {};
  MONTHS.forEach(m => { byMonth[m] = []; });
  const noMonth = [];
  items.forEach(i => { if (i.month && byMonth[i.month]) byMonth[i.month].push(i); else if (!i.month) noMonth.push(i); });

  let html = "";
  MONTHS.forEach(m => {
    const list = byMonth[m];
    if (!list.length) return;
    const sorted = list.slice().sort((a, b) => (b.price_current || 0) - (a.price_current || 0));
    const total = sorted.reduce((s, i) => s + (i.price_current || 0), 0);
    html += `<div class="month-group">
      <div class="month-header"><span>${m}</span><span>${fmt(total)}</span></div>
      <div class="gallery">${sorted.map((it, idx) => renderCard(it, idx)).join("")}</div>
    </div>`;
  });
  if (noMonth.length) {
    const sorted = noMonth.slice().sort((a, b) => (b.price_current || 0) - (a.price_current || 0));
    const total = sorted.reduce((s, i) => s + (i.price_current || 0), 0);
    html += `<div class="month-group">
      <div class="month-header"><span>Uten måned</span><span>${fmt(total)}</span></div>
      <div class="gallery">${sorted.map((it, idx) => renderCard(it, idx)).join("")}</div>
    </div>`;
  }
  document.getElementById("main").innerHTML = html ||
    `<div class="empty"><div class="empty-icon">📅</div><p>Ingen planlagte kjøp ennå.</p></div>`;
}

function renderArchive() {
  const items = data.items.filter(i => i.status === "kjøpt");
  if (!items.length) {
    document.getElementById("main").innerHTML =
      `<div class="empty"><div class="empty-icon">✅</div><p>Ingenting kjøpt ennå.</p></div>`;
    return;
  }
  document.getElementById("main").innerHTML =
    `<div class="gallery">${items.map((it, idx) => renderCard(it, idx, true)).join("")}</div>`;
}

function renderTotals() {
  const active = activeItems();
  const total = active.reduce((s, i) => s + (i.price_current || 0), 0);
  const byCat = {};
  allCategories().forEach(c => { byCat[c] = 0; });
  active.forEach(i => (i.categories || []).forEach(c => { if (byCat[c] != null) byCat[c] += i.price_current || 0; }));

  let html = `<div class="total-chip">Totalt: <span>${fmt(total)}</span></div>`;
  allCategories().forEach(c => {
    if (byCat[c] > 0) html += `<div class="total-chip">${c}: <span>${fmt(byCat[c])}</span></div>`;
  });
  document.getElementById("totals-bar").innerHTML = html;
}

// ── Prioriter (tier-brett) ──────────────────────────────────────────────────
// Bestilt/kjøpt er allerede avgjort og skal ikke prioriteres. Kolonnen en vare
// havner i (Ønsker meg/Ser på) speiler status — sparer_til beholder egen status
// uansett kolonne den vises i, siden sparingen lever sitt eget liv.
function tierBoardItems() {
  return activeItems().filter(i => i.status !== "bestilt");
}
function tierPoolItems() {
  return tierBoardItems().filter(i => !i.tier);
}
function tierColumnOf(item) {
  return item.status === "ser_på" ? "ser_på" : "ønske";
}

function catTally(items) {
  const counts = {};
  items.forEach(i => (i.categories || []).forEach(c => { counts[c] = (counts[c] || 0) + 1; }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
}
function catTallyInner(items) {
  return catTally(items).map(([c, n]) => `<span class="cat-tally">${CAT_ICONS[c] || "🏷️"} ${n}</span>`).join("");
}
// Wrapperen rendres alltid (selv tom) slik at drop-patching under kan
// oppdatere innholdet uten å måtte lage/fjerne selve div-en.
function catTallyHtml(items) {
  return `<div class="tier-col-cats">${catTallyInner(items)}</div>`;
}

function tierChip(item) {
  const [tintA, tintB] = tintFor(item.id);
  const img = item.image
    ? `<img src="${item.image}" alt="" loading="lazy" onerror="cardImgError(this,'${tintA}','${tintB}')">`
    : `<div class="placeholder" style="--tintA:${tintA};--tintB:${tintB}"></div>`;
  const saveBadge  = item.status === "sparer_til" ? `<span class="tier-badge tier-badge-save">💰</span>` : "";
  const monthBadge = item.month ? `<span class="tier-badge tier-badge-month">${item.month}</span>` : "";
  const priceHtml  = item.price_current ? `<div class="tier-chip-price">${fmt(item.price_current)}</div>` : "";
  const safeName = (item.name || item.url || "").replace(/"/g, "&quot;");
  return `<div class="tier-chip-wrap">
    <div class="tier-chip" data-id="${item.id}" title="${safeName}">${img}${saveBadge}${monthBadge}</div>
    ${priceHtml}
  </div>`;
}

function tierColHeadHtml(statusVal, items) {
  const label = statusVal === "ønske" ? "Høy ønske" : "Vil ha det";
  const sum = items.reduce((s, i) => s + (i.price_current || 0), 0);
  return `<span>${label} <span class="tier-col-count">${items.length}</span></span>${sum ? `<span class="tier-col-sum">${fmt(sum)}</span>` : ""}`;
}

function tierColHtml(tierKey, statusVal, items) {
  return `<div class="tier-col">
    <div class="tier-col-label">${tierColHeadHtml(statusVal, items)}</div>
    ${catTallyHtml(items)}
    <div class="tier-items" data-tier="${tierKey}" data-status="${statusVal}">${items.map(tierChip).join("")}</div>
  </div>`;
}

// Rad-hodets sammendrag (synlig selv når raden er lukket): antall, sum og
// kategorifordeling for HELE tieren (begge kolonner slått sammen).
function tierRowMetaHtml(items) {
  const sum = items.reduce((s, i) => s + (i.price_current || 0), 0);
  return `<span class="tier-row-count-sum">${items.length}${sum ? " · " + fmt(sum) : ""}</span><span class="tier-row-cats">${catTallyInner(items)}</span>`;
}

function renderTierBoard() {
  const items = tierBoardItems();
  const pool = items.filter(i => !i.tier);

  if (!items.length) {
    return `<div class="empty"><div class="empty-icon">🏆</div><p>Ingen varer å prioritere ennå.</p></div>`;
  }

  let html = `<div class="tier-board">`;
  TIERS.forEach(t => {
    const inTier = items.filter(i => i.tier === t.key);
    const onske  = inTier.filter(i => tierColumnOf(i) === "ønske");
    const serpa  = inTier.filter(i => tierColumnOf(i) === "ser_på");
    html += `<div class="tier-row" data-key="${t.key}">
      <div class="tier-row-head" style="--tierHue:${t.hue}" onclick="toggleTierRow('${t.key}')">
        <span class="tier-dot"></span>
        <span class="tier-row-name">${t.label}</span>
        <span class="tier-row-meta">${tierRowMetaHtml(inTier)}</span>
        <span class="tier-chevron">▾</span>
      </div>
      <div class="tier-row-body-wrap">
        <div class="tier-cols">
          ${tierColHtml(t.key, "ønske", onske)}
          ${tierColHtml(t.key, "ser_på", serpa)}
        </div>
      </div>
    </div>`;
  });
  html += `<div class="tier-row tier-pool-row" data-key="">
      <div class="tier-row-head" onclick="toggleTierRow('')">
        <span class="tier-dot"></span>
        <span class="tier-row-name">Usortert</span>
        <span class="tier-row-meta">${tierRowMetaHtml(pool)}</span>
        <span class="tier-chevron">▾</span>
      </div>
      <div class="tier-row-body-wrap">
        <div class="tier-pool-body">
          <div class="tier-items tier-pool-items" data-tier="" data-status="">${pool.map(tierChip).join("")}</div>
        </div>
      </div>
    </div>`;
  html += `</div>`;
  return html;
}

// Uavhengige seksjoner — flere kan stå åpne samtidig. max-height settes til
// eksakt målt innholdshøyde ved åpning, og til 0 ved lukking, så det aldri
// lekker en sliver av bobler før raden faktisk er åpnet.
function toggleTierRow(key) {
  const row = document.querySelector(`.tier-row[data-key="${key}"]`);
  if (!row) return;
  const wrap = row.querySelector(".tier-row-body-wrap");
  const nowOpen = row.classList.toggle("open");
  wrap.style.maxHeight = nowOpen ? wrap.scrollHeight + "px" : "0px";
}
function refreshTierRowHeight(row) {
  if (!row || !row.classList.contains("open")) return;
  const wrap = row.querySelector(".tier-row-body-wrap");
  if (wrap) wrap.style.maxHeight = wrap.scrollHeight + "px";
}

// ── Kort-modus (rask førstegangssortering av usorterte varer) ──────────────
let cardSorterDismissed = false;

function renderCardSorter() {
  const pool = tierPoolItems();
  if (!pool.length) return "";
  const item = pool[0];
  const [tintA, tintB] = tintFor(item.id);
  const img = item.image
    ? `<img src="${item.image}" alt="" onerror="cardImgError(this,'${tintA}','${tintB}')">`
    : `<div class="placeholder" style="--tintA:${tintA};--tintB:${tintB}"></div>`;
  const rows = TIERS.map(t => `
    <div class="cs-row">
      <span class="cs-row-label" style="--tierHue:${t.hue}">${t.label}</span>
      <button type="button" class="cs-btn" onclick="cardSortPlace('${item.id}','${t.key}','ønske')">Høy ønske</button>
      <button type="button" class="cs-btn cs-btn-secondary" onclick="cardSortPlace('${item.id}','${t.key}','ser_på')">Vil ha det</button>
    </div>`).join("");

  return `<div class="card-sorter">
    <div class="cs-eyebrow">Sorter varer · ${pool.length} igjen</div>
    <div class="cs-card">
      <div class="cs-img">${img}</div>
      <div class="cs-name">${item.name || item.url}</div>
      ${item.price_current ? `<div class="cs-price">${fmt(item.price_current)}</div>` : ""}
    </div>
    <div class="cs-grid">${rows}</div>
    <button type="button" class="cs-skip" onclick="cardSortSkip()">Se hele brettet i stedet →</button>
  </div>`;
}

function cardSortPlace(id, tierKey, statusVal) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  item.tier = tierKey;
  if (item.status !== "sparer_til") item.status = statusVal;

  const main = document.getElementById("main");
  const target = main.querySelector(`.tier-items[data-tier="${tierKey}"][data-status="${statusVal}"]`);
  moveTierChipDom(id, target);

  // Kort-modus sin egen forhåndsvisning bytter uansett til en ny vare (nytt
  // bilde er forventet der) — bare den, ikke resten av brettet, skal fornyes.
  const csWrap = document.querySelector(".card-sorter");
  if (csWrap) {
    const fresh = renderCardSorter();
    if (fresh) csWrap.outerHTML = fresh; else csWrap.remove();
  }
  updateTierBadge();
  save();
  if (navigator.vibrate) navigator.vibrate(6);
}
function cardSortSkip() { cardSorterDismissed = true; render(); }

function renderTier() {
  const pool = tierPoolItems();
  const showCards = pool.length > 0 && !cardSorterDismissed;
  document.getElementById("main").innerHTML = (showCards ? renderCardSorter() : "") + renderTierBoard();
}

// Oppdaterer kun tall/sum/kategori-tekst rundt en .tier-items-beholder, uten å
// røre selve vare-boblene — det er derfor bilder IKKE laster på nytt ved hver
// flytting. Kalles på BÅDE gammel og ny beholder etter en flytting.
function patchTierHeads(itemsEl) {
  if (!itemsEl) return;
  const tierKey = itemsEl.dataset.tier || null;
  const statusVal = itemsEl.dataset.status || null;
  const row = itemsEl.closest(".tier-row");
  if (!row) return;
  const metaEl = row.querySelector(".tier-row-meta");
  if (tierKey) {
    const col = itemsEl.closest(".tier-col");
    const colItems = tierBoardItems().filter(i => i.tier === tierKey && tierColumnOf(i) === statusVal);
    if (col) {
      col.querySelector(".tier-col-label").innerHTML = tierColHeadHtml(statusVal, colItems);
      const catsEl = col.querySelector(".tier-col-cats");
      if (catsEl) catsEl.innerHTML = catTallyInner(colItems);
    }
    const rowItems = tierBoardItems().filter(i => i.tier === tierKey);
    if (metaEl) metaEl.innerHTML = tierRowMetaHtml(rowItems);
  } else {
    const poolItems = tierPoolItems();
    if (metaEl) metaEl.innerHTML = tierRowMetaHtml(poolItems);
  }
  refreshTierRowHeight(row);
}

// Flytter selve chip-elementet i DOM-en (ikke re-render) og patcher kun
// tekst-hodene på gammel+ny beholder — bildet inni blir aldri ødelagt/lastet på nytt.
function moveTierChipDom(itemId, targetItemsEl) {
  const main = document.getElementById("main");
  const chipEl = main.querySelector(`.tier-chip[data-id="${itemId}"]`);
  if (!chipEl || !targetItemsEl) return false;
  const oldItemsEl = chipEl.closest(".tier-items");
  chipEl.classList.remove("tier-chip-dragging");
  const wrap = chipEl.closest(".tier-chip-wrap") || chipEl;
  targetItemsEl.appendChild(wrap);
  if (oldItemsEl && oldItemsEl !== targetItemsEl) patchTierHeads(oldItemsEl);
  patchTierHeads(targetItemsEl);
  return true;
}

function updateTierBadge() {
  const el = document.getElementById("nav-tier-badge");
  if (!el) return;
  const n = tierPoolItems().length;
  el.textContent = n;
  el.style.display = n > 0 ? "flex" : "none";
}

// ── Dra-og-slipp i prioriterings-brettet (pointer events → touch + mus) ────
let tierDrag = null;
let tierScrollRAF = null;

function resolveTierDropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest(".tier-items")) return el.closest(".tier-items");
  const col = el.closest(".tier-col, .tier-pool-row");
  return col ? col.querySelector(".tier-items") : null;
}

function tierAutoScroll() {
  if (!tierDrag || !tierDrag.moved) { tierScrollRAF = null; return; }
  const y = tierDrag.lastY, margin = 70, maxSpeed = 16, vh = window.innerHeight;
  let dy = 0;
  if (y < margin) dy = -maxSpeed * (1 - y / margin);
  else if (y > vh - margin) dy = maxSpeed * (1 - (vh - y) / margin);
  if (dy) window.scrollBy(0, dy);
  tierScrollRAF = requestAnimationFrame(tierAutoScroll);
}

// Rader er lukket som standard, så .tier-items inni en lukket rad har ingen
// synlig piksel å treffe med elementFromPoint. Holder man en vare over en
// lukket rads hode en liten stund under en drag, åpnes den automatisk slik
// at man faktisk kan slippe varen der.
let tierHoverTimer = null, tierHoverKey = null;
function clearTierHover() {
  if (tierHoverTimer) { clearTimeout(tierHoverTimer); tierHoverTimer = null; }
  tierHoverKey = null;
}
function handleTierDragHover(x, y) {
  const el = document.elementFromPoint(x, y);
  const row = el ? el.closest(".tier-row") : null;
  const key = row ? row.dataset.key : null;
  if (key === tierHoverKey) return;
  clearTierHover();
  tierHoverKey = key;
  if (row && !row.classList.contains("open")) {
    tierHoverTimer = setTimeout(() => {
      if (tierDrag && tierHoverKey === key) {
        row.classList.add("open");
        const wrap = row.querySelector(".tier-row-body-wrap");
        if (wrap) wrap.style.maxHeight = wrap.scrollHeight + "px";
      }
    }, 350);
  }
}

function setupTierDrag() {
  const main = document.getElementById("main");

  main.addEventListener("pointerdown", e => {
    if (view !== "tier") return;
    const chip = e.target.closest(".tier-chip");
    if (!chip) return;
    // Kveler native tekst-seleksjon/bilde-drag/callout med en gang — uten dette
    // kan nettleseren "vinne" berøringen før JS-terskelen under rekker å reagere,
    // og du ender med å markere tekst i stedet for å dra boblen.
    e.preventDefault();
    const rect = chip.getBoundingClientRect();
    tierDrag = {
      id: chip.dataset.id, pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, lastY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      w: rect.width, h: rect.height, moved: false, ghost: null,
    };
  }, { passive: false });

  main.addEventListener("pointermove", e => {
    if (!tierDrag || e.pointerId !== tierDrag.pointerId) return;
    tierDrag.lastY = e.clientY;
    const dx = e.clientX - tierDrag.startX, dy = e.clientY - tierDrag.startY;
    if (!tierDrag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      tierDrag.moved = true;
      main.setPointerCapture(e.pointerId);
      const src = main.querySelector(`.tier-chip[data-id="${tierDrag.id}"]`);
      if (!src) { tierDrag = null; return; }
      const ghost = src.cloneNode(true);
      ghost.className = "tier-chip tier-chip-ghost";
      ghost.style.width = tierDrag.w + "px";
      ghost.style.height = tierDrag.h + "px";
      document.body.appendChild(ghost);
      tierDrag.ghost = ghost;
      src.classList.add("tier-chip-dragging");
      if (!tierScrollRAF) tierScrollRAF = requestAnimationFrame(tierAutoScroll);
    }
    e.preventDefault();
    tierDrag.ghost.style.left = (e.clientX - tierDrag.offsetX) + "px";
    tierDrag.ghost.style.top  = (e.clientY - tierDrag.offsetY) + "px";
    document.querySelectorAll(".tier-items.drag-over").forEach(el => el.classList.remove("drag-over"));
    tierDrag.ghost.style.visibility = "hidden";
    handleTierDragHover(e.clientX, e.clientY);
    const target = resolveTierDropTarget(e.clientX, e.clientY);
    tierDrag.ghost.style.visibility = "";
    if (target) target.classList.add("drag-over");
  }, { passive: false });

  function endDrag(e) {
    if (!tierDrag) return;
    document.querySelectorAll(".tier-items.drag-over").forEach(el => el.classList.remove("drag-over"));
    clearTierHover();
    const d = tierDrag; tierDrag = null;
    if (!d.moved) { return; }
    d.ghost.style.visibility = "hidden";
    const target = resolveTierDropTarget(e.clientX, e.clientY);
    d.ghost.style.visibility = "";
    const item = data.items.find(i => i.id === d.id);
    if (target && item) {
      const tRect = target.getBoundingClientRect();
      d.ghost.style.transition = "left .18s cubic-bezier(.22,1,.36,1), top .18s cubic-bezier(.22,1,.36,1)";
      d.ghost.style.left = (tRect.left + 10) + "px";
      d.ghost.style.top  = (tRect.top + 10) + "px";
      const newTier   = target.dataset.tier || null;
      const newStatus = target.dataset.status || null;
      item.tier = newTier;
      if (newStatus && item.status !== "sparer_til") item.status = newStatus;
      if (navigator.vibrate) navigator.vibrate(6);
      setTimeout(() => {
        d.ghost.remove();
        moveTierChipDom(d.id, target);
        updateTierBadge();
        save();
      }, 160);
    } else {
      d.ghost.remove();
    }
  }
  main.addEventListener("pointerup", endDrag);
  main.addEventListener("pointercancel", endDrag);
}

function render() {
  renderTotals();
  const showListChrome = view === "wishlist";
  document.querySelector(".add-bar").style.display = showListChrome ? "flex" : "none";
  document.querySelector(".add-extra").style.display = showListChrome ? "flex" : "none";
  if (showListChrome) {
    renderPendingBar();
    renderFilters();
    renderWishlist();
  } else {
    document.getElementById("pending-bar").innerHTML = "";
    document.getElementById("filter-bar").innerHTML = "";
    if (view === "months") renderMonths();
    else if (view === "tier") renderTier();
    else renderArchive();
  }
  updateTierBadge();
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`nav-${view}`).classList.add("active");
}
function setView(v) {
  view = v;
  if (v === "tier") cardSorterDismissed = false;
  render();
}

// ── Boble-oversikt (klyp for å zoome ut → gruppert etter kategori) ─────────────
let bubblesOpen = false;

function groupByCategory() {
  const groups = {};
  activeItems().forEach(i => {
    const cats = (i.categories && i.categories.length) ? i.categories : ["__none__"];
    cats.forEach(c => { (groups[c] = groups[c] || []).push(i); });
  });
  return groups;
}

function renderBubbles() {
  const bv = document.getElementById("bubble-view");
  const entries = Object.entries(groupByCategory()).sort((a, b) => b[1].length - a[1].length);

  bv.innerHTML = "";

  const topbar = document.createElement("div");
  topbar.className = "bubble-topbar";
  const title = document.createElement("div");
  title.className = "bubble-title";
  title.textContent = "Kategorier";
  const sub = document.createElement("div");
  sub.className = "bubble-sub";
  sub.textContent = "Trykk en boble for å filtrere";
  topbar.append(title, sub);
  bv.appendChild(topbar);

  const cloud = document.createElement("div");
  cloud.className = "bubble-cloud";

  if (!entries.length) {
    cloud.innerHTML = `<div class="empty"><div class="empty-icon">🫧</div><p>Ingenting å gruppere ennå.</p></div>`;
  } else {
    const counts = entries.map(([, list]) => list.length);
    const max = Math.max(...counts), min = Math.min(...counts);
    entries.forEach(([cat, list], idx) => {
      const count = list.length;
      const t = max === min ? 1 : (count - min) / (max - min);
      const size = Math.round(70 + t * (148 - 70));
      const total = list.reduce((s, i) => s + (i.price_current || 0), 0);
      const isNone = cat === "__none__";
      const icon = isNone ? "🗂️" : (CAT_ICONS[cat] || "🏷️");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bubble";
      btn.style.setProperty("--size", size + "px");
      const popDelay = idx * 40;
      btn.style.animationDelay = `${popDelay}ms, ${420 + popDelay}ms`;

      const iconEl = document.createElement("span");
      iconEl.className = "bubble-icon";
      iconEl.textContent = icon;
      const nameEl = document.createElement("span");
      nameEl.className = "bubble-name";
      nameEl.textContent = isNone ? "Uten kategori" : cat;
      const countEl = document.createElement("span");
      countEl.className = "bubble-count";
      countEl.textContent = count + (count === 1 ? " vare" : " varer");
      btn.append(iconEl, nameEl, countEl);
      // Prisraden trenges kun når boblen er stor nok til å vise den pent
      if (total > 0 && size >= 112) {
        const totalEl = document.createElement("span");
        totalEl.className = "bubble-total";
        totalEl.textContent = fmt(total);
        btn.appendChild(totalEl);
      }
      btn.addEventListener("click", () => selectBubble(cat));
      cloud.appendChild(btn);
    });
  }
  bv.appendChild(cloud);
}

// Fryser bakgrunnslisten mens boblene er åpne, så man ikke kan skrolle den ved
// et uhell — og går man ut uten å velge en boble, er man akkurat der man var.
let savedScrollY = 0;
function lockBodyScroll() {
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = "fixed";
  document.body.style.top = (-savedScrollY) + "px";
  document.body.style.left = "0";
  document.body.style.right = "0";
}
function unlockBodyScroll(restore) {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  if (restore) window.scrollTo(0, savedScrollY);
}

function openBubbles() {
  if (bubblesOpen || document.querySelector(".modal-overlay.open")) return;
  bubblesOpen = true;
  renderBubbles();
  document.getElementById("bubble-view").classList.add("open");
  lockBodyScroll();
  if (navigator.vibrate) navigator.vibrate(8);
}

function closeBubbles() {
  if (!bubblesOpen) return;
  bubblesOpen = false;
  document.getElementById("bubble-view").classList.remove("open");
  unlockBodyScroll(true);
}

// Trykk hvor som helst utenom selve boblene (topptekst, bakgrunn) → lukk.
// Festet én gang ved boot, ikke inne i renderBubbles (som kjører på nytt hver åpning).
function setupBubbleOutsideTap() {
  document.getElementById("bubble-view").addEventListener("click", e => {
    if (bubblesOpen && !e.target.closest(".bubble")) closeBubbles();
  });
}

function selectBubble(cat) {
  filters.cat = cat;
  view = "wishlist";
  const bv = document.getElementById("bubble-view");
  bubblesOpen = false;
  // Rendrer med én gang MENS boble-visningen fortsatt dekker skjermen (den er
  // ugjennomsiktig helt til fade-ut-transisjonen kjører) — ingen ventetid,
  // ingen egen kort-animasjon nødvendig. Det eneste du ser er selve fade-ut'en.
  unlockBodyScroll(false); // ikke gjenopprett gammel posisjon — ny liste starter øverst
  render();
  bv.classList.remove("open");
}

// Klyp med to fingre hvor som helst i appen for å zoome ut til boble-oversikten;
// spre fingrene fra hverandre inne i oversikten for å zoome tilbake til vanlig visning.
function touchDist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function setupPinchGestures() {
  const main = document.getElementById("main");
  let inStart = null, inTriggered = false;
  main.addEventListener("touchstart", e => {
    if (e.touches.length === 2 && !bubblesOpen && !document.querySelector(".modal-overlay.open")) {
      inStart = touchDist(e.touches[0], e.touches[1]);
      inTriggered = false;
    } else {
      inStart = null;
    }
  }, { passive: true });
  main.addEventListener("touchmove", e => {
    if (inStart == null || e.touches.length !== 2) return;
    e.preventDefault();
    if (inTriggered) return;
    if (touchDist(e.touches[0], e.touches[1]) / inStart < 0.72) {
      inTriggered = true;
      openBubbles();
    }
  }, { passive: false });
  main.addEventListener("touchend", () => { inStart = null; inTriggered = false; });

  const bv = document.getElementById("bubble-view");
  let outStart = null, outTriggered = false;
  bv.addEventListener("touchstart", e => {
    if (e.touches.length === 2) { outStart = touchDist(e.touches[0], e.touches[1]); outTriggered = false; }
    else outStart = null;
  }, { passive: true });
  bv.addEventListener("touchmove", e => {
    if (outStart == null || e.touches.length !== 2) return;
    e.preventDefault();
    if (outTriggered) return;
    if (touchDist(e.touches[0], e.touches[1]) / outStart > 1.35) {
      outTriggered = true;
      closeBubbles();
    }
  }, { passive: false });
  bv.addEventListener("touchend", () => { outStart = null; outTriggered = false; });
}

// ── Legg til (lim inn lenke) ───────────────────────────────────────────────────
async function addItem(url) {
  url = url.trim();
  if (!url || !url.startsWith("http")) { toast("Lim inn en gyldig URL", true); return; }
  if (data.items.find(i => i.url === url)) { toast("Lenken er allerede i lista"); return; }

  const manualName  = document.getElementById("add-name").value.trim();
  const priceRaw    = parseFloat(document.getElementById("add-price").value) || null;
  const addCur      = document.getElementById("add-currency")?.value || "NOK";
  const manualPrice = priceRaw
    ? (addCur === "NOK" ? Math.round(priceRaw) : (toNok(priceRaw, addCur) ?? Math.round(priceRaw)))
    : null;
  const now = new Date().toISOString();

  const item = {
    id: uuid(), url,
    status: manualName ? "ser_på" : "pending",
    name:   manualName || null,
    image:  null,
    price_current: manualPrice,
    price_history: manualPrice ? [{ date: now.slice(0,10), price: manualPrice }] : [],
    currency: "NOK", saved: 0, tier: null,
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
async function handleAdd() {
  const inp = document.getElementById("add-input");
  const btn = document.getElementById("btn-add");
  const url = inp.value.trim();
  if (!url) return;
  btn.disabled = true;
  btn.textContent = "…";
  await addItem(url);
  inp.value = "";
  btn.disabled = false;
  btn.textContent = "Legg til";
}
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
async function pasteIntoEditUrl() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.startsWith("http")) { toast("Ingen lenke i utklippstavlen", true); return; }
    document.getElementById("edit-url").value = text;
  } catch {
    toast("Kunne ikke lese utklippstavlen", true);
  }
}

async function deleteItem(id) {
  data.items = data.items.filter(i => i.id !== id);
  render();
  await save();
  toast("Slettet");
}

// ── Ny vare / Rediger vare (bunnark) ───────────────────────────────────────────
let editId = null;

function buildCategoryChips(selected) {
  document.getElementById("cat-checkboxes").innerHTML = allCategories().map(c => `
    <input class="cat-cb" type="checkbox" id="cb-${c}" value="${c}" ${selected.includes(c) ? "checked" : ""}>
    <label class="cat-label" for="cb-${c}">${CAT_ICONS[c] ? CAT_ICONS[c] + " " : ""}${c}</label>`).join("");
}
function buildStatusChips(current) {
  document.getElementById("status-checkboxes").innerHTML = EDITABLE_STATUSES.map(s => `
    <input class="status-cb" type="radio" name="status-radio" id="sb-${s}" value="${s}" ${current === s ? "checked" : ""}>
    <label class="status-label" for="sb-${s}">${STATUS_LABELS[s]}</label>`).join("");
}

function openAdd() {
  editId = null;
  document.getElementById("edit-title").textContent = "Ny vare";
  document.getElementById("edit-url").value = "";
  document.getElementById("edit-open-link").style.display = "none";
  document.getElementById("edit-name").value = "";
  document.getElementById("edit-month").value = "";
  document.getElementById("edit-notes").value = "";
  document.getElementById("edit-price").value = "";
  document.getElementById("edit-currency").value = "NOK";
  document.getElementById("currency-preview").textContent = "";
  document.getElementById("edit-image").value = "";
  document.getElementById("edit-image-preview").style.display = "none";
  document.getElementById("btn-delete").style.display = "none";
  buildCategoryChips([]);
  buildStatusChips("ser_på");
  document.getElementById("modal-overlay").classList.add("open");
}

function openEdit(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  editId = id;
  document.getElementById("edit-title").textContent = "Rediger vare";
  document.getElementById("edit-url").value = item.url || "";
  const openLink = document.getElementById("edit-open-link");
  if (item.url) { openLink.href = item.url; openLink.style.display = "flex"; }
  else openLink.style.display = "none";
  document.getElementById("edit-name").value  = item.name || "";
  document.getElementById("edit-price").value = item.price_current || "";
  document.getElementById("edit-month").value = item.month || "";
  document.getElementById("edit-notes").value = item.notes || "";
  document.getElementById("edit-currency").value = "NOK";
  document.getElementById("currency-preview").textContent = "";
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
  document.getElementById("btn-delete").style.display = "block";
  buildCategoryChips(item.categories || []);
  buildStatusChips(item.status === "pending" ? "ser_på" : item.status);
  document.getElementById("modal-overlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  editId = null;
}

async function saveEdit() {
  const name  = document.getElementById("edit-name").value.trim();
  const url   = document.getElementById("edit-url").value.trim();
  const month = document.getElementById("edit-month").value || null;
  const notes = document.getElementById("edit-notes").value.trim();
  const statusEl = document.querySelector('input[name="status-radio"]:checked');
  const status = statusEl ? statusEl.value : "ser_på";
  const rawPrice = parseFloat(document.getElementById("edit-price").value);
  const cur      = document.getElementById("edit-currency")?.value || "NOK";
  const newPrice = rawPrice ? (cur === "NOK" ? Math.round(rawPrice) : toNok(rawPrice, cur)) : null;
  const cats  = allCategories().filter(c => document.getElementById("cb-" + c)?.checked);
  const imgVal = document.getElementById("edit-image").value.trim();

  if (editId == null) {
    if (!name && !url) { closeModal(); return; }
    if (url && data.items.find(i => i.url === url)) { toast("Lenken er allerede i lista"); return; }
    const now = new Date().toISOString();
    const item = {
      id: uuid(), url: url || "",
      status: url && !name ? "pending" : status,
      name: name || null,
      image: imgVal && imgVal.startsWith("http") ? imgVal : null,
      price_current: newPrice,
      price_history: newPrice ? [{ date: now.slice(0,10), price: newPrice }] : [],
      currency: "NOK", saved: 0, tier: null,
      categories: cats, subcategory: "", month, notes,
      last_error: null, added_at: now, purchased_at: status === "kjøpt" ? now : null,
    };
    data.items.unshift(item);
    closeModal();
    render();
    try {
      await save();
      toast(item.status === "pending" ? "Lagt til! Henter info automatisk…" : "Lagt til!");
    } catch (e) {
      toast("Lagringsfeil: " + e.message, true);
    }
    return;
  }

  const item = data.items.find(i => i.id === editId);
  if (!item) return;
  item.name   = name || item.name;
  item.url    = url;
  item.month  = month;
  item.notes  = notes;
  item.status = status;
  if (imgVal && imgVal.startsWith("http")) item.image = imgVal;
  else if (!imgVal) item.image = null;
  if (newPrice && newPrice !== item.price_current) {
    item.price_current = newPrice;
    item.currency = "NOK";
    const today = new Date().toISOString().slice(0, 10);
    item.price_history = [...(item.price_history || []), { date: today, price: newPrice }];
  }
  item.categories = cats;
  if (item.status === "kjøpt" && !item.purchased_at) item.purchased_at = new Date().toISOString();
  closeModal();
  render();
  await save();
  toast("Lagret");
}

async function deleteFromEdit() {
  if (editId == null) return;
  const id = editId;
  closeModal();
  await deleteItem(id);
}

// ── Legg til sparing (bunnark) ─────────────────────────────────────────────────
let sparId = null;

function openSpar(id) {
  const item = data.items.find(i => i.id === id);
  if (!item) return;
  sparId = id;
  document.getElementById("spar-title").textContent = item.name || item.url;
  const saved = item.saved || 0;
  const price = item.price_current || 0;
  const remaining = Math.max(0, price - saved);
  document.getElementById("spar-sub").textContent = `${fmt(saved)} av ${fmt(price)} · mangler ${fmt(remaining)}`;
  document.getElementById("spar-input").value = "";
  document.getElementById("spar-confirm").textContent = "Legg til";
  document.getElementById("spar-overlay").classList.add("open");
}
function closeSpar() {
  document.getElementById("spar-overlay").classList.remove("open");
  sparId = null;
}
function sparQuick(amount) {
  document.getElementById("spar-input").value = amount;
  updateSparConfirmLabel();
}
function updateSparConfirmLabel() {
  const v = parseFloat(document.getElementById("spar-input").value) || 0;
  document.getElementById("spar-confirm").textContent = v > 0 ? `Legg til ${fmt(v)}` : "Legg til";
}
async function sparConfirm() {
  const item = data.items.find(i => i.id === sparId);
  if (!item) return;
  const amount = parseFloat(document.getElementById("spar-input").value) || 0;
  if (amount <= 0) { closeSpar(); return; }
  const price = item.price_current || 0;
  item.saved = Math.min(price, (item.saved || 0) + amount);
  closeSpar();
  render();
  await save();
  toast("Lagt til sparing");
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
async function refreshData() {
  await load();
  render();
  toast("Oppdatert");
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  const savedTheme = localStorage.getItem("hl-theme");
  const migrated = savedTheme === "light" ? "warm" : savedTheme;
  const theme = THEME_CYCLE.includes(migrated) ? migrated : "warm";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("hl-theme", theme);

  document.getElementById("currency-pill").textContent = (displayCurrency === "NOK" ? "kr" : displayCurrency) + " ▾";

  document.getElementById("add-input").addEventListener("keydown", e => { if (e.key === "Enter") handleAdd(); });
  document.getElementById("spar-input").addEventListener("input", updateSparConfirmLabel);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && bubblesOpen) closeBubbles(); });
  setupPinchGestures();
  setupBubbleOutsideTap();
  setupTierDrag();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  }

  getExchangeRates();
  await load();
  render();
  handleSharedUrl();
  startAutoRefresh();
}

document.addEventListener("DOMContentLoaded", boot);
