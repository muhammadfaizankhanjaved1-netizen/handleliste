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

async function load() {
  try {
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

// ── VareKort ─────────────────────────────────────────────────────────────────
function renderCard(item, index, archived = false) {
  const h = CARD_HEIGHTS[index % CARD_HEIGHTS.length];
  const [tintA, tintB] = tintFor(item.id);
  let imgHtml;
  if (item.image) {
    imgHtml = `<img src="${item.image}" alt="" loading="lazy" onerror="cardImgError(this,'${tintA}','${tintB}')">`;
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
    if (filters.cat && !(i.categories || []).includes(filters.cat)) return false;
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
    if (view === "months") renderMonths(); else renderArchive();
  }
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`nav-${view}`).classList.add("active");
}
function setView(v) { view = v; render(); }

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
    currency: "NOK", saved: 0,
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
      currency: "NOK", saved: 0,
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
