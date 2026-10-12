/* Zaijabolical interface (no build step, no framework). Talks to js/api.js, which runs in the browser. */
"use strict";

const S = {
  data: null,           // /api/bootstrap payload
  view: "plan",
  planTab: "week",
  week: null,           // current week plan (from optimizer or saved)
  weekName: null,
  selDay: null,         // index of selected day, null = week average
  combos: null,
  builder: [],          // [{recipe_id, servings}]
  builderEval: null,
  shopDone: {},
  anchors: [],          // recipe ids to "build around"
  weekOptions: null,    // alternative weeks from the last planning run
  weekChoice: 0,
  weekRecommended: 0,
  weekError: null,
  recipeFilter: { q: "", cat: "All" },
  pantryQ: "",
  busy: false,
};
const CATS = ["Breakfast", "Main", "Side", "Snack", "Add-on"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AISLES = ["Produce", "Tofu & Plant Protein", "Beans & Legumes", "Grains & Pasta", "Nuts & Seeds",
  "Dairy-Free & Fridge", "Frozen", "Pantry & Spices", "Other"];

/* ---------------- tiny DOM helper ---------------- */
// let append()/replaceChildren() skip null/false so conditional children are easy
for (const P of [Element.prototype, DocumentFragment.prototype]) {
  for (const m of ["append", "prepend", "replaceChildren"]) {
    const orig = P[m];
    P[m] = function (...a) { return orig.apply(this, a.filter(x => x != null && x !== false)); };
  }
}
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list" && k !== "type") { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const svg = (name, cls) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = ICONS[name] || "";
  return s;
};
const ICONS = {
  plan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 17h6"/>',
  recipes: '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h11M8 8h6"/>',
  pantry: '<path d="M6 3h12M7 3v3a5 5 0 0 0-2 4v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a5 5 0 0 0-2-4V3"/><path d="M5 13h14"/>',
  prep: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 13 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  fridge: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M9 5v2M9 13v3"/>',
  freezer: '<path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
};

/* ---------------- api ---------------- */
async function api(method, url, body) {
  return Z.api.request(method, url, body ? JSON.parse(JSON.stringify(body)) : undefined);
}
let toastTimer;
function toast(msg, err) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = h("div", { class: "toast" + (err ? " err" : ""), role: "status" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), err ? 6000 : 2600);
}
async function reload() { S.data = await api("GET", "/api/bootstrap"); }
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ---------------- formatting ---------------- */
function fmt(v, unit) {
  if (v == null || isNaN(v)) return "–";
  const a = Math.abs(v);
  const s = a >= 100 ? Math.round(v).toLocaleString() : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : v.toFixed(2);
  return unit ? `${s} ${unit}` : s;
}
const fmtServ = s => (s === 0.5 ? "½" : Number.isInteger(s) ? String(s) : (s % 1 === 0.5 ? `${Math.floor(s)}½` : s.toFixed(2)));
const recipeById = id => S.data.recipes.find(r => r.id === id);
const ingById = id => S.data.ingredients.find(i => i.id === id);
const nutMeta = k => S.data.nutrients.find(n => n.key === k);
function targetKcal() {
  const t = S.data.settings.targets;
  return (t.protein.target || 0) * 4 + (t.carbs.target || 0) * 4 + (t.fat.target || 0) * 9;
}
function rowsFor(per) {
  // build evaluate-like rows client-side from a per-serving nutrient dict (for recipe previews)
  const T = S.data.settings.targets;
  return S.data.nutrients.map(n => {
    const target = n.key === "kcal" ? targetKcal() : (T[n.key] || {}).target;
    const total = per[n.key] || 0;
    const pct = target ? total / target * 100 : null;
    return { key: n.key, name: n.name, unit: n.unit, group: n.group, kind: n.kind, target, food: total, supp: 0,
      total, pct, enabled: (T[n.key] || {}).enabled !== false, status: "info", ul: n.ul, ul_scope: n.ul_scope, note: n.note };
  });
}

/* ---------------- nutrient visuals ---------------- */
function fingerprint(rows, lg) {
  const el = h("div", { class: "fp" + (lg ? " lg" : ""), role: "img",
    "aria-label": "Nutrient coverage: " + summaryText(rows) });
  for (const r of rows) {
    if (!r.enabled || r.kind === "info" || !r.target) continue;
    let pct = r.kind === "limit" ? (r.total <= r.target ? 100 : 100) : Math.min(r.pct || 0, 100);
    const i = h("i", { class: r.status, title: `${r.name}: ${Math.round(r.pct || 0)}%` });
    i.style.height = Math.max(12, pct) + "%";
    el.append(i);
  }
  return el;
}
function summaryText(rows) {
  const used = rows.filter(r => r.enabled && r.kind !== "info" && r.target);
  const good = used.filter(r => r.status === "good").length;
  const low = used.filter(r => r.status === "low").map(r => r.name);
  return `${good} of ${used.length} targets met` + (low.length ? `; low: ${low.join(", ")}` : "");
}
function bars(rows, opts = {}) {
  const groups = S.data.groups;
  const wrap = h("div", { class: "bars-groups" + (opts.oneCol ? " one" : "") });
  for (const g of groups) {
    const gr = h("div", { class: "bars-group" }, h("h3", null, g));
    for (const r0 of rows.filter(r => r.group === g)) {
      const r = { ...r0 };
      if (r.key === "kcal" && !r.target) { r.target = targetKcal(); r.pct = r.total / r.target * 100; }
      if (!r.target && r.key !== "kcal") continue;
      if (opts.hideDisabled && !r.enabled) continue;
      gr.append(barRow(r, opts));
    }
    wrap.append(gr);
  }
  const legend = h("div", { class: "legend" },
    h("span", null, h("i", { style: { background: "var(--leaf)" } }), "Met (90%+)"),
    h("span", null, h("i", { style: { background: "var(--squash)" } }), "Close"),
    h("span", null, h("i", { style: { background: "var(--tomato)" } }), "Low"),
    h("span", null, h("i", { style: { background: "var(--eggplant)" } }), "Over a limit"),
    h("span", null, h("i", { style: { background: "repeating-linear-gradient(135deg,var(--teal) 0 3px,transparent 3px 6px)" } }), "From supplements"),
    h("span", null, h("i", { style: { width: "2px", background: "var(--ink)" } }), "Target"),
    rows.some(r => r.incomplete) ? h("span", null, h("b", { style: { color: "var(--squash)", marginRight: "4px" } }, "*"), "Incomplete USDA data") : null);
  return h("div", null, wrap, opts.noLegend ? null : legend);
}
function barRow(r, opts) {
  const SCALE = 150;
  let status = r.status;
  if (opts.preview) status = r.kind === "limit" ? "info" : "good";
  const foodPct = r.target ? Math.min(r.food / r.target * 100, SCALE) : 0;
  const suppPct = r.target ? Math.min(r.supp / r.target * 100, SCALE - foodPct) : 0;
  const fill = h("div", { class: "fill" });
  fill.style.width = (foodPct + suppPct) / SCALE * 100 + "%";
  if (foodPct > 0) fill.append(h("div", { class: "f", style: { width: foodPct / (foodPct + suppPct) * 100 + "%" } }));
  if (suppPct > 0) fill.append(h("div", { class: "s", style: { width: suppPct / (foodPct + suppPct) * 100 + "%" } }));
  const track = h("div", { class: "track" }, fill, h("div", { class: "target", style: { left: `calc(${100 / SCALE * 100}% - 1px)` } }));
  if (r.ul && r.ul_scope === "total" && r.target) {
    const ulPct = r.ul / r.target * 100;
    if (ulPct <= SCALE) track.append(h("div", { class: "ul", style: { left: `${ulPct / SCALE * 100}%` }, title: `Upper limit ${fmt(r.ul, r.unit)}` }));
  }
  if (r.target && r.total / r.target * 100 > SCALE) track.append(h("span", { class: "more" }, "›"));
  const pct = r.pct != null ? Math.round(r.pct) : null;
  const flag = r.incomplete ? h("span", { class: "flag", title: "Some ingredients have no USDA data for this nutrient, so the real amount is likely higher" }, "*") : null;
  const tip = [r.note, r.supp ? `Food ${fmt(r.food, r.unit)} + supplements ${fmt(r.supp, r.unit)}` : null,
    r.ul ? `Upper limit ${fmt(r.ul, r.unit)}${r.ul_scope === "supplement" ? " (from supplements)" : ""}` : null].filter(Boolean).join("\n");
  const valText = opts.preview
    ? h("span", { class: "val" }, h("b", null, fmt(r.total, r.unit)), pct != null ? ` · ${pct}% of day` : "")
    : h("span", { class: "val", title: r.unit }, h("b", null, pct != null ? pct + "%" : ""), ` ${fmt(r.total)} / ${fmt(r.target)} ${r.unit.split(" ")[0]}`);
  return h("div", { class: `bar st-${status}${r.enabled ? "" : " disabled"}`, title: tip || null },
    h("span", { class: "lbl" }, r.name, r.kind === "limit" ? h("span", { class: "muted small", title: "Stay under this" }, " max") : null, flag),
    valText, track);
}
function macroLine(rows) {
  const g = k => rows.find(r => r.key === k) || {};
  return h("div", { class: "macro-line" },
    h("span", null, h("b", null, fmt(g("kcal").total)), " kcal"),
    h("span", null, h("b", null, fmt(g("protein").total)), " g protein"),
    h("span", null, h("b", null, fmt(g("carbs").total)), " g carbs"),
    h("span", null, h("b", null, fmt(g("fat").total)), " g fat"));
}
function adviceList(recs, { compact } = {}) {
  const wrap = h("div", { class: "advice" });
  if (!recs || !recs.length) {
    wrap.append(h("p", { class: "muted" }, "Every target is covered. Nothing to add."));
    return wrap;
  }
  const iconFor = { supplement: "pill", food: "leaf", warning: "alert", data: "info" };
  for (const r of compact ? recs.filter(x => x.kind !== "data").slice(0, 6) : recs) {
    const t = h("div", { class: "tip " + r.kind },
      h("div", { class: "tip-h" }, svg(iconFor[r.kind] || "info"), r.title),
      r.gap_text ? h("div", { class: "gap" }, r.gap_text) : null,
      r.text ? h("p", null, r.text) : null);
    if (r.kind === "supplement" && r.dose && !compact) {
      t.append(h("button", { class: "btn sm add-supp", onclick: () => addSupplementFromDose(r) },
        svg("plus"), `Add “${r.dose.label}” to her supplements`));
    }
    wrap.append(t);
  }
  return wrap;
}
async function addSupplementFromDose(r) {
  const supps = [...(S.data.settings.supplements || [])];
  supps.push({ name: r.dose.label, nutrients: { [r.key]: r.dose.amount }, active: true });
  await saveSetting("supplements", supps);
  toast(`Added ${r.dose.label} (${r.dose.amount} ${r.unit}/day)`);
  await refreshAfterSupplementChange();
}
async function refreshAfterSupplementChange() {
  if (S.week) { S.week = { ...S.week, ...(await api("POST", "/api/week/rescore", { days: S.week.days })) }; persistWeek(); }
  if (S.builder.length) S.builderEval = await api("POST", "/api/evaluate", { items: S.builder });
  if (S.combos) S.combos = null;
  render();
}
async function persistWeek() {
  try { await api("PUT", "/api/week/current", { value: S.week ? { name: S.weekName, data: S.week, choice: S.weekOptions ? S.weekChoice : null } : null }); }
  catch { /* best effort */ }
}
async function persistWeekOptions() {
  const value = S.weekOptions ? { options: S.weekOptions, recommended: S.weekRecommended, anchors: S.anchors } : null;
  try { await api("PUT", "/api/week/options", { value }); } catch { /* best effort */ }
}
async function saveSetting(key, value) {
  const res = await api("PUT", `/api/settings/${key}`, { value });
  S.data.settings[key] = res.value;
}

/* ---------------- navigation ---------------- */
const VIEWS = [
  ["plan", "Plan", "plan"], ["recipes", "Recipes", "recipes"], ["pantry", "Pantry", "pantry"],
  ["prep", "Prep day", "prep"], ["settings", "Settings", "settings"],
];
function renderNav() {
  const nav = document.getElementById("nav");
  nav.querySelectorAll("a, .spacer, .theme-toggle, .sync-badge").forEach(n => n.remove());
  for (const [id, label, icon] of VIEWS) {
    nav.append(h("a", { href: "#" + id, class: S.view === id ? "active" : "", "aria-current": S.view === id ? "page" : null },
      svg(icon), label));
  }
  nav.append(h("div", { class: "spacer" }));
  nav.querySelectorAll(".sync-badge").forEach(n => n.remove());
  nav.append(syncBadge());
  nav.append(h("button", { class: "btn ghost sm theme-toggle", onclick: toggleTheme }, svg("moon"), "Theme"));
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  store.set("theme", next);
}
function route() {
  document.querySelectorAll(".scrim").forEach(x => x.remove());
  if (!Z.store.S.github && !Z.store.S.localOnly && !S.data.recipes.length && !S.data.ingredients.length) {
    renderNav(); showConnect(false); return;
  }
  const v = (location.hash || "#plan").slice(1);
  S.view = VIEWS.some(x => x[0] === v) ? v : "plan";
  render();
}
function render() {
  renderNav();
  const app = document.getElementById("app");
  app.replaceChildren();
  const fn = { plan: viewPlan, recipes: viewRecipes, pantry: viewPantry, prep: viewPrep, settings: viewSettings }[S.view];
  app.append(fn());
}
function pageHead(title, sub, ...actions) {
  return h("div", { class: "page-head" },
    h("div", null, h("h1", null, title), sub ? h("p", null, sub) : null),
    actions.length ? h("div", { class: "row" }, ...actions) : null);
}
function loading(msg) {
  const fp = h("div", { class: "fp lg" });
  for (let i = 0; i < 30; i++) fp.append(h("i", { style: { animationDelay: (i * 0.04) + "s" } }));
  return h("div", { class: "loading" }, fp, h("div", null, msg));
}

/* ================================================================
   PLAN
   ================================================================ */
function viewPlan() {
  const root = h("div");
  const usable = S.data.recipes.filter(r => r.active && r.ingredients.length);
  root.append(pageHead("Plan", "Make combinations of our recipes that best cover your daily nutritional targets."));
  if (!usable.length) {
    root.append(h("div", { class: "empty" },
      h("h2", null, "Add a few recipes to start planning"),
      h("p", null, "Import the starter pantry (USDA nutrient data plus 16 high-protein vegan prep recipes), or build your own recipes."),
      h("div", { class: "row", style: { justifyContent: "center" } },
        h("a", { class: "btn primary", href: "#pantry" }, "Set up the pantry"),
        h("a", { class: "btn", href: "#recipes" }, "Write a recipe"))));
    return root;
  }
  const seg = h("div", { class: "seg", role: "tablist" });
  for (const [id, label] of [["week", "Week plan"], ["ideas", "Day ideas"], ["build", "Build a day"]]) {
    seg.append(h("button", { class: S.planTab === id ? "on" : "", role: "tab", "aria-selected": S.planTab === id,
      onclick: () => { S.planTab = id; render(); } }, label));
  }
  root.append(h("div", { style: { marginBottom: "16px" } }, seg));
  root.append({ week: planWeek, ideas: planIdeas, build: planBuild }[S.planTab]());
  return root;
}

/* ---- week ---- */
/* "Build around" picker, shared by Week plan and Day ideas */
function anchorPicker(label) {
  const wrap = h("div", { class: "anchors" }, h("span", { class: "lbl" }, label));
  for (const id of S.anchors) {
    const r = recipeById(id);
    if (!r) continue;
    wrap.append(h("span", { class: "chip" }, r.name,
      h("button", { "aria-label": "Stop building around " + r.name, title: "Remove",
        onclick: () => { S.anchors = S.anchors.filter(x => x !== id); render(); } }, svg("x"))));
  }
  const pick = h("select", { "aria-label": "Choose a dish to build around", onchange: e => {
    const id = e.target.value; if (!id) return;
    if (!S.anchors.includes(id)) S.anchors.push(id);
    render();
  } }, h("option", { value: "" }, S.anchors.length ? "+ Add another" : "+ Choose a dish"),
    CATS.map(c => h("optgroup", { label: c }, S.data.recipes
      .filter(r => r.category === c && r.active && r.ingredients.length && !S.anchors.includes(r.id))
      .map(r => h("option", { value: r.id }, r.name)))));
  wrap.append(pick);
  return wrap;
}

function planWeek() {
  const wk = S.data.settings.week;
  const root = h("div");
  const opts = { ...wk };
  const saveWk = (key, val) => { opts[key] = val; saveSetting("week", { ...S.data.settings.week, [key]: val }); };
  const sel = (label, key) => h("label", { class: "field" }, h("span", null, label),
    h("select", { onchange: e => saveWk(key, e.target.value) },
      DAYS.map(d => h("option", { value: d, selected: opts[key] === d }, d))));
  const dishCount = key => h("input", { type: "number", min: 1, max: 10, value: opts[key], style: { width: "64px" },
    "aria-label": key === "min_recipes" ? "Fewest dishes to cook" : "Most dishes to cook",
    onchange: e => saveWk(key, Math.max(1, +e.target.value || 1)) });
  const planBtn = () => h("button", { class: "btn primary", onclick: () => runWeek() }, svg("sparkle"),
    S.weekOptions || S.week ? "Plan a new week" : "Plan my week");
  const saved = S.data.plans;
  root.append(h("div", { class: "panel no-print" },
    h("div", { class: "options" },
      h("div", { class: "field", style: { width: "auto" } }, h("span", null, "Dishes to cook"),
        h("div", { class: "row", style: { flexWrap: "nowrap", gap: "6px" } }, dishCount("min_recipes"), h("span", { class: "muted" }, "to"), dishCount("max_recipes"))),
      sel("Prep day", "prep_day"),
      sel("Week starts", "start_day"),
      h("div", { class: "row", style: { marginLeft: "auto" } },
        saved.length ? h("select", { style: { width: "auto" }, "aria-label": "Open a saved week",
          onchange: async e => { if (!e.target.value) return; const p = await api("GET", `/api/plans/${e.target.value}`); S.week = p.data; S.weekName = p.name; S.weekOptions = null; S.selDay = null; persistWeek(); persistWeekOptions(); render(); } },
          h("option", { value: "" }, "Open saved week…"), saved.map(p => h("option", { value: p.id }, p.name))) : null,
        planBtn())),
    h("div", { style: { marginTop: "14px" } }, anchorPicker("Build around"))));

  if (S.busy) { root.append(loading("Comparing sets of dishes… this takes about 10 seconds.")); return root; }
  if (S.weekError) root.append(h("div", { class: "banner", style: { marginTop: "16px" } }, svg("alert"), S.weekError));
  if (!S.week) {
    if (S.weekError) return root;
    const b = planBtn();
    root.append(h("div", { class: "empty", style: { marginTop: "16px" } },
      h("h2", null, "Plan a week from a few big batches"),
      h("p", null, "The planner finds small sets of dishes (3 to 4 by default) that you can cook on prep day and eat all week while hitting her targets. You'll get a few options to choose from. Pick a dish under Build around to plan the week around it."),
      b));
    return root;
  }
  if (S.weekOptions && S.weekOptions.length) root.append(weekOptionsPanel());
  const W = S.week;
  const sel_ = S.selDay;
  const rows = sel_ == null ? W.average : W.days[sel_].rows;
  const cooked = (W.prep ? W.prep.batches.filter(b => b.minutes > 5) : []).map(b => b.name);
  const grid = h("div", { class: "week" });
  W.days.forEach((d, i) => grid.append(dayColumn(d, i)));
  const head = h("div", { class: "panel-head" },
    h("div", null, h("h2", null, S.weekName || "This week"),
      h("div", { class: "muted small" }, `${cooked.length} dish${cooked.length === 1 ? "" : "es"} to cook: ${cooked.join(", ")}. Tap a day to see its numbers.`)),
    h("div", { class: "row no-print" },
      h("span", { class: "score", title: "Average coverage of all enabled targets" }, Math.round(W.score), h("small", null, "/100 coverage")),
      h("button", { class: "btn", onclick: saveWeek }, "Save week"),
      h("a", { class: "btn", href: "#prep" }, svg("prep"), "Prep sheet")));
  root.append(h("div", { class: "panel", style: { marginTop: "16px" } }, head, grid));
  const barsPanel = h("div", { class: "panel" },
    h("div", { class: "panel-head" },
      h("h2", null, sel_ == null ? "Weekly average" : `${W.days[sel_].day}`),
      sel_ != null ? h("button", { class: "btn sm", onclick: () => { S.selDay = null; render(); } }, "Show weekly average") : null),
    macroLine(rows), h("div", { style: { margin: "10px 0 14px" } }, fingerprint(rows, true)), bars(rows));
  const right = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "12px" } }, "Fill the gaps"),
    h("p", { class: "muted small" }, "Based on the weekly average, including any supplements in Settings."),
    adviceList(W.advice));
  root.append(h("div", { class: "plan-layout", style: { marginTop: "16px" } }, barsPanel, right));
  return root;
}
function weekOptionsPanel() {
  const grid = h("div", { class: "week-options" });
  S.weekOptions.forEach((o, i) => {
    const names = o.prep_set.map(id => recipeById(id)).filter(Boolean);
    grid.append(h("button", { class: "wopt" + (S.weekChoice === i ? " on" : ""), "aria-pressed": S.weekChoice === i,
      onclick: () => chooseWeekOption(i) },
      h("div", { class: "wopt-h" }, h("b", null, `${o.n_dishes} dish${o.n_dishes === 1 ? "" : "es"}`),
        h("span", { class: "score" }, Math.round(o.score), h("small", null, "/100"))),
      i === S.weekRecommended ? h("span", { class: "rec" }, "Recommended") : null,
      h("ul", null, names.map(r => h("li", null, r.name, S.anchors.includes(r.id) ? h("span", { class: "anchor-mark", title: "You're building around this" }, " ★") : null))),
      fingerprint(o.average)));
  });
  return h("div", { class: "panel no-print", style: { marginTop: "16px" } },
    h("div", { class: "panel-head" }, h("h2", null, "Choose a week"),
      h("span", { class: "muted small" }, "Fewest dishes first. No-cook staples like fruit and soy milk are extra and don't count.")),
    grid);
}
function chooseWeekOption(i) {
  S.weekChoice = i;
  S.week = JSON.parse(JSON.stringify(S.weekOptions[i]));
  S.weekName = null; S.selDay = null;
  persistWeek();
  render();
}
function dayColumn(d, i) {
  const col = h("div", { class: "day" + (S.selDay === i ? " sel" : "") });
  col.append(h("div", { class: "day-head", onclick: () => { S.selDay = S.selDay === i ? null : i; render(); }, tabindex: 0,
    onkeydown: e => { if (e.key === "Enter") { S.selDay = S.selDay === i ? null : i; render(); } } },
    h("b", null, d.day.slice(0, 3)), h("span", { class: "muted small" }, Math.round(d.score) + "%")));
  col.append(fingerprint(d.rows));
  const order = it => { const r = recipeById(it.recipe_id); return r ? CATS.indexOf(r.category) : 9; };
  const sorted = d.items.map((it, j) => [it, j]).sort((a, b) => order(a[0]) - order(b[0]));
  for (const [it, j] of sorted) {
    const r = recipeById(it.recipe_id);
    const src = it.source === "freezer" ? "From the freezer (thaw the night before)" : "From the fridge";
    col.append(h("div", { class: "dish" },
      h("span", { class: "nm" }, it.name),
      h("span", { class: "meta" },
        h("span", { title: src, class: "srcwrap" }, svg(it.source === "freezer" ? "freezer" : "fridge", "src " + it.source)),
        h("span", { class: "mini-step" },
          h("button", { title: "Less", "aria-label": "Less " + it.name, onclick: () => editDay(i, j, -0.5) }, "−"),
          h("span", { title: "Servings" }, fmtServ(it.servings) + "×"),
          h("button", { title: "More", "aria-label": "More " + it.name, onclick: () => editDay(i, j, 0.5) }, "+"))),
      it.warning || (r && it.source === "freezer" && !r.freezes) ? h("span", { class: "warn" }, it.warning || "Doesn't freeze well") : null));
  }
  const add = h("select", { "aria-label": "Add a dish to " + d.day, onchange: e => { if (e.target.value) addToDay(i, e.target.value); } },
    h("option", { value: "" }, "+ Add dish"),
    CATS.map(c => h("optgroup", { label: c }, S.data.recipes.filter(r => r.category === c && r.ingredients.length)
      .map(r => h("option", { value: r.id }, r.name)))));
  col.append(h("div", { class: "add no-print" }, add));
  return col;
}
async function runWeek() {
  S.busy = true; S.weekError = null; render();
  try {
    const res = await api("POST", "/api/optimize/week", { require: S.anchors });
    if (res.message || !res.options.length) {
      S.weekError = res.message || "No week found.";
    } else {
      S.weekOptions = res.options;
      S.weekRecommended = res.recommended;
      S.busy = false;
      persistWeekOptions();
      chooseWeekOption(res.recommended);
      return;
    }
  } catch (e) { toast(e.message, true); }
  S.busy = false; render();
}
async function rescoreWeek() {
  const res = await api("POST", "/api/week/rescore", { days: S.week.days });
  S.week = { ...S.week, ...res };
  persistWeek();
  render();
}
function editDay(di, j, delta) {
  const it = S.week.days[di].items[j];
  it.servings = Math.max(0, it.servings + delta);
  if (it.servings === 0) S.week.days[di].items.splice(j, 1);
  rescoreWeek();
}
function addToDay(di, rid) {
  const d = S.week.days[di];
  const ex = d.items.find(x => x.recipe_id === rid);
  if (ex) ex.servings += 1; else d.items.push({ recipe_id: rid, servings: 1 });
  rescoreWeek();
}
async function saveWeek() {
  const name = prompt("Name this week", S.weekName || `Week of ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
  if (!name) return;
  const res = await api("POST", "/api/plans", { name, data: S.week });
  S.data.plans = res.plans; S.weekName = name;
  persistWeek();
  toast("Week saved");
  render();
}

/* ---- day ideas ---- */
function planIdeas() {
  const root = h("div");
  const variety = store.get("variety", 1);
  root.append(h("div", { class: "panel no-print" }, h("div", { class: "options" },
    h("p", { class: "muted", style: { margin: 0, flex: "1 1 300px" } },
      "The best single-day combinations, each one using a different mix of recipes. Use them for inspiration or open one in the day builder to tweak."),
    h("label", { class: "field" }, h("span", null, "Each idea differs by"),
      h("select", { onchange: e => store.set("variety", +e.target.value) },
        [1, 2, 3].map(n => h("option", { value: n, selected: n === variety }, `${n}+ recipe${n > 1 ? "s" : ""}`)))),
    h("button", { class: "btn primary", onclick: runIdeas }, svg("sparkle"), S.combos ? "Find again" : "Find combinations")),
    h("div", { style: { marginTop: "14px" } }, anchorPicker("Build around"))));
  if (S.busy) { root.append(loading("Searching combinations…")); return root; }
  if (!S.combos) return root;
  if (S.combos.message) { root.append(h("div", { class: "banner", style: { marginTop: "16px" } }, svg("alert"), S.combos.message)); return root; }
  const grid = h("div", { class: "combos", style: { marginTop: "16px" } });
  S.combos.combos.forEach((c, n) => {
    const details = h("div", { class: "hidden" }, bars(c.rows, { noLegend: true }),
      h("h3", { style: { margin: "14px 0 8px" } }, "Fill the gaps"), adviceList(c.advice, { compact: true }));
    grid.append(h("div", { class: "combo" },
      h("div", { class: "combo-head" }, h("h2", null, `Idea ${n + 1}`),
        h("span", { class: "score" }, Math.round(c.score), h("small", null, "/100"))),
      fingerprint(c.rows, true),
      h("ul", null, c.items.map(it => h("li", null, h("span", null, it.name, S.anchors.includes(it.recipe_id) ? h("span", { class: "anchor-mark", title: "You're building around this" }, " ★") : null),
        h("span", { class: "q" }, `${fmtServ(it.servings)} × `, h("span", { class: "tag cat-" + it.category }, it.category))))),
      macroLine(c.rows),
      h("div", { class: "row" },
        h("button", { class: "btn sm", onclick: e => { details.classList.toggle("hidden"); e.target.textContent = details.classList.contains("hidden") ? "Show nutrients" : "Hide nutrients"; } }, "Show nutrients"),
        h("button", { class: "btn sm", onclick: () => openInBuilder(c.items) }, "Open in day builder")),
      details));
  });
  root.append(grid);
  return root;
}
async function runIdeas() {
  S.busy = true; render();
  try { S.combos = await api("POST", "/api/optimize/days", { n: 6, min_new: store.get("variety", 1), require: S.anchors }); }
  catch (e) { toast(e.message, true); }
  S.busy = false; render();
}
function openInBuilder(items) {
  S.builder = items.map(i => ({ recipe_id: i.recipe_id, servings: i.servings }));
  S.planTab = "build";
  evalBuilder();
}

/* ---- build a day ---- */
const evalBuilder = debounce(async () => {
  S.builderEval = S.builder.length ? await api("POST", "/api/evaluate", { items: S.builder }) : null;
  if (S.view === "plan" && S.planTab === "build") render();
}, 150);
function planBuild() {
  const root = h("div", { class: "plan-layout" });
  const list = h("div", { class: "builder-items" });
  S.builder.forEach((it, idx) => {
    const r = recipeById(it.recipe_id);
    if (!r) return;
    list.append(h("div", { class: "builder-item" },
      h("div", null, h("div", { style: { fontWeight: 500 } }, r.name), h("span", { class: "tag cat-" + r.category }, r.category)),
      h("div", { class: "row" },
        h("div", { class: "stepper" },
          h("button", { "aria-label": "Less", onclick: () => { it.servings = Math.max(0, it.servings - 0.5); if (!it.servings) S.builder.splice(idx, 1); render(); evalBuilder(); } }, "−"),
          h("span", null, fmtServ(it.servings)),
          h("button", { "aria-label": "More", onclick: () => { it.servings += 0.5; render(); evalBuilder(); } }, "+")),
        h("button", { class: "icon-btn", "aria-label": "Remove", onclick: () => { S.builder.splice(idx, 1); render(); evalBuilder(); } }, svg("x")))));
  });
  const add = h("select", { onchange: e => {
    const id = e.target.value; if (!id) return;
    const ex = S.builder.find(x => x.recipe_id === id);
    if (ex) ex.servings += 1; else S.builder.push({ recipe_id: id, servings: 1 });
    render(); evalBuilder();
  } }, h("option", { value: "" }, "+ Add a recipe"),
    CATS.map(c => h("optgroup", { label: c }, S.data.recipes.filter(r => r.category === c && r.ingredients.length).map(r => h("option", { value: r.id }, r.name)))));
  const ev = S.builderEval;
  const left = h("div", null,
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", null, "Her day"),
        ev ? h("span", { class: "score" }, Math.round(ev.score), h("small", null, "/100")) : null),
      S.builder.length ? list : h("p", { class: "muted" }, "Add recipes and adjust servings to see how a day adds up."),
      h("div", { style: { marginTop: "10px", maxWidth: "340px" } }, add),
      S.builder.length ? h("button", { class: "btn sm ghost", style: { marginTop: "8px" }, onclick: () => { S.builder = []; S.builderEval = null; render(); } }, "Clear") : null),
    ev ? h("div", { class: "panel" }, macroLine(ev.rows), h("div", { style: { margin: "10px 0 14px" } }, fingerprint(ev.rows, true)), bars(ev.rows)) : null);
  root.append(left, h("div", { class: "panel" }, h("h2", { style: { marginBottom: "12px" } }, "Fill the gaps"),
    ev ? adviceList(ev.advice) : h("p", { class: "muted" }, "Suggestions appear once the day has food in it.")));
  return root;
}

/* ================================================================
   RECIPES
   ================================================================ */
function viewRecipes() {
  const root = h("div");
  root.append(pageHead("Recipes", "Her cookbook. Numbers are per serving; the strip shows how much of her day one serving covers.",
    h("button", { class: "btn primary", onclick: () => openRecipe(null) }, svg("plus"), "New recipe")));
  const f = S.recipeFilter;
  const seg = h("div", { class: "seg" });
  for (const c of ["All", ...CATS]) seg.append(h("button", { class: f.cat === c ? "on" : "", onclick: () => { f.cat = c; render(); } }, c));
  const search = h("input", { type: "search", placeholder: "Search recipes", value: f.q, "aria-label": "Search recipes",
    oninput: debounce(e => { f.q = e.target.value; render(); document.querySelector(".toolbar input").focus(); }, 250) });
  root.append(h("div", { class: "toolbar" }, search, seg));
  const list = S.data.recipes.filter(r => (f.cat === "All" || r.category === f.cat) &&
    (!f.q || r.name.toLowerCase().includes(f.q.toLowerCase()) || (r.tags || []).join(" ").toLowerCase().includes(f.q.toLowerCase())));
  if (!S.data.recipes.length) {
    root.append(h("div", { class: "empty" }, h("h2", null, "No recipes yet"),
      h("p", null, "Write your first one, or import the 16 starter recipes from the Pantry page."),
      h("div", { class: "row", style: { justifyContent: "center" } },
        h("button", { class: "btn primary", onclick: () => openRecipe(null) }, "New recipe"),
        h("a", { class: "btn", href: "#pantry" }, "Import starters"))));
    return root;
  }
  if (!list.length) { root.append(h("p", { class: "muted" }, "No recipes match.")); return root; }
  const cards = h("div", { class: "cards" });
  for (const r of list) {
    const per = r.nutrition.per_serving;
    const rows = rowsFor(per).map(x => ({ ...x, status: x.kind === "limit" ? (x.pct > 50 ? "ok" : "good") : (x.pct >= 33 ? "good" : x.pct >= 15 ? "ok" : "low") }));
    cards.append(h("button", { class: "rcard" + (r.active ? "" : " inactive"), onclick: () => openRecipe(r) },
      h("div", { class: "rcard-top" }, h("h3", null, r.name), r.favorite ? svg("star", "star") : null),
      h("div", { class: "tags" },
        h("span", { class: "tag cat-" + r.category }, r.category),
        h("span", { class: "tag" }, `${fmtServ(r.servings)} servings`),
        r.freezes ? h("span", { class: "tag" }, svg("freezer"), "freezes") : h("span", { class: "tag" }, svg("fridge"), `${r.fridge_days} days`),
        r.active ? null : h("span", { class: "tag" }, "not in plans")),
      h("div", { class: "macros" },
        h("span", null, h("b", null, fmt(per.kcal)), "kcal"), h("span", null, h("b", null, fmt(per.protein)), "protein"),
        h("span", null, h("b", null, fmt(per.carbs)), "carbs"), h("span", null, h("b", null, fmt(per.fat)), "fat")),
      fingerprint(rows)));
  }
  root.append(cards);
  return root;
}

function openRecipe(r) {
  const R = r ? JSON.parse(JSON.stringify(r)) : {
    name: "", category: "Main", servings: 4, ingredients: [], steps: "", prep_min: 15, cook_min: 30,
    fridge_days: 4, freezes: true, max_per_day: 2, tags: [], notes: "", active: true, favorite: false,
  };
  delete R.nutrition;
  const live = h("div", { class: "panel live" });
  const lines = h("div", { class: "ing-lines" });
  const refresh = debounce(async () => {
    const nut = await api("POST", "/api/recipes/preview", R);
    const rows = rowsFor(nut.per_serving);
    live.replaceChildren(
      h("div", { class: "panel-head" }, h("h2", null, "One serving"), h("span", { class: "muted small" }, `${fmt(nut.grams_per_serving)} g`)),
      macroLine(rows), h("div", { style: { margin: "10px 0 12px" } }, fingerprint(rows.map(x => ({ ...x, status: x.pct >= 33 ? "good" : x.pct >= 15 ? "ok" : "low" })), true)),
      h("p", { class: "muted small" }, "Bars show the share of her full day's target in one serving; the tick marks 100% of the day."),
      bars(rows, { preview: true, noLegend: true, hideDisabled: true, oneCol: true }),
      ...(nut.problems.length ? [h("div", { class: "banner" }, svg("alert"), nut.problems.join("; "))] : []));
  });
  const ingOptions = () => S.data.ingredients;
  const drawLines = () => {
    lines.replaceChildren(h("div", { class: "ing-line muted small" }, h("span", null, "Ingredient"), h("span", null, "Amount"), h("span", null, "Unit"), h("span", { class: "note" }, "Note"), h("span")));
    R.ingredients.forEach((line, idx) => lines.append(ingLine(line, idx)));
  };
  const ingLine = (line, idx) => {
    const ing = ingById(line.ingredient_id);
    const units = ["g", "oz", "lb", ...(ing ? ing.portions.map(p => p.label) : [])];
    const unitSel = h("select", { onchange: e => { line.unit = e.target.value; refresh(); } },
      units.map(u => h("option", { value: u, selected: (line.unit || "g") === u }, u)));
    return h("div", { class: "ing-line" },
      ingPicker(ing, picked => { line.ingredient_id = picked.id; line.unit = picked.portions[0] ? picked.portions[0].label : "g"; drawLines(); refresh(); }),
      h("input", { type: "number", step: "any", min: 0, value: line.amount ?? "", "aria-label": "Amount", oninput: e => { line.amount = +e.target.value; refresh(); } }),
      unitSel,
      h("input", { type: "text", class: "note", value: line.note || "", placeholder: "diced…", "aria-label": "Note", oninput: e => { line.note = e.target.value; } }),
      h("button", { class: "icon-btn", "aria-label": "Remove ingredient", onclick: () => { R.ingredients.splice(idx, 1); drawLines(); refresh(); } }, svg("x")));
  };
  const ingPicker = (current, onPick) => {
    const wrap = h("div", { class: "ing-pick" });
    const input = h("input", { type: "text", value: current ? current.name : "", placeholder: "Search pantry…", "aria-label": "Ingredient" });
    const menu = h("div", { class: "menu hidden" });
    const show = () => {
      const q = input.value.toLowerCase().trim();
      const hits = ingOptions().filter(i => !q || i.name.toLowerCase().includes(q)).slice(0, 30);
      menu.replaceChildren(...hits.map(i => h("button", { type: "button", onmousedown: e => { e.preventDefault(); input.value = i.name; menu.classList.add("hidden"); onPick(i); } }, i.name)),
        h("button", { type: "button", class: "new", onmousedown: e => { e.preventDefault(); menu.classList.add("hidden"); openAddIngredient(q, ing => onPick(ing)); } },
          q ? `+ Add “${input.value}” to pantry` : "+ Add a new ingredient"));
      menu.classList.remove("hidden");
    };
    input.addEventListener("focus", show);
    input.addEventListener("input", show);
    input.addEventListener("blur", () => setTimeout(() => menu.classList.add("hidden"), 120));
    wrap.append(input, menu);
    return wrap;
  };
  drawLines();
  const fld = (label, el) => h("label", { class: "field" }, h("span", null, label), el);
  const bind = (key, type = "text", extra = {}) => h(type === "textarea" ? "textarea" : "input", {
    type: type === "textarea" ? null : type, value: R[key] ?? "", ...extra,
    oninput: e => { R[key] = type === "number" ? +e.target.value : e.target.value; if (key === "servings") refresh(); } });
  const form = h("div", null,
    h("div", { class: "panel" },
      fld("Name", bind("name", "text", { placeholder: "e.g. Smoky lentil stew" })),
      h("div", { class: "grid4", style: { marginTop: "12px" } },
        fld("Category", h("select", { onchange: e => { R.category = e.target.value; } }, CATS.map(c => h("option", { selected: R.category === c }, c)))),
        fld("Servings (batch)", bind("servings", "number", { min: 0.5, step: 0.5 })),
        fld("Prep (min)", bind("prep_min", "number", { min: 0 })),
        fld("Cook (min)", bind("cook_min", "number", { min: 0 }))),
      h("div", { class: "grid4", style: { marginTop: "12px" } },
        fld("Fridge life (days)", bind("fridge_days", "number", { min: 0, max: 30 })),
        fld("Max servings/day", bind("max_per_day", "number", { min: 0.5, step: 0.5 })),
        h("label", { class: "check", style: { alignSelf: "end", paddingBottom: "8px" } },
          h("input", { type: "checkbox", checked: R.freezes, onchange: e => { R.freezes = e.target.checked; } }), "Freezes well"),
        h("label", { class: "check", style: { alignSelf: "end", paddingBottom: "8px" } },
          h("input", { type: "checkbox", checked: R.favorite, onchange: e => { R.favorite = e.target.checked; } }), "Favorite"))),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", null, "Ingredients"),
        h("button", { class: "btn sm", onclick: () => { R.ingredients.push({ ingredient_id: null, amount: 100, unit: "g", note: "" }); drawLines(); lines.querySelector(".ing-line:last-child input").focus(); } }, svg("plus"), "Add ingredient")),
      lines,
      h("p", { class: "muted small", style: { marginTop: "10px" } }, "Units come from each ingredient's portion sizes (edit them on the Pantry page). Grams are always most accurate.")),
    h("div", { class: "panel" },
      fld("Steps", bind("steps", "textarea", { placeholder: "1. …\n2. …", rows: 8 })),
      h("div", { class: "grid2", style: { marginTop: "12px" } },
        fld("Tags (comma separated)", h("input", { type: "text", value: (R.tags || []).join(", "), oninput: e => { R.tags = e.target.value.split(",").map(s => s.trim()).filter(Boolean); } })),
        fld("Notes", bind("notes"))),
      h("label", { class: "check", style: { marginTop: "12px" } },
        h("input", { type: "checkbox", checked: R.active, onchange: e => { R.active = e.target.checked; } }), "Use this recipe in plans")));

  const close = () => scrim.remove();
  const save = async () => {
    if (!R.name.trim()) { toast("Give the recipe a name", true); return; }
    R.ingredients = R.ingredients.filter(l => l.ingredient_id);
    try {
      await api(R.id ? "PUT" : "POST", R.id ? `/api/recipes/${R.id}` : "/api/recipes", R);
      await reload(); close(); toast(R.id ? "Recipe saved" : "Recipe added"); render();
    } catch (e) { toast(e.message, true); }
  };
  const scrim = h("div", { class: "scrim", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Recipe editor" },
      h("div", { class: "drawer-head" }, h("h2", null, r ? "Edit recipe" : "New recipe"),
        h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      h("div", { class: "drawer-body" }, h("div", { class: "editor" }, form, live)),
      h("div", { class: "drawer-foot" },
        h("div", { class: "row" },
          r ? h("button", { class: "btn danger", onclick: async () => {
            if (!confirm(`Delete “${r.name}”?`)) return;
            await api("DELETE", `/api/recipes/${r.id}`); await reload(); close(); toast("Recipe deleted"); render();
          } }, "Delete") : null,
          r && r.ingredients.length ? h("button", { class: "btn", title: "Find days and weeks built around this dish", onclick: () => {
            close(); S.anchors = [r.id]; S.planTab = "ideas"; S.combos = null;
            if (location.hash === "#plan") render(); else location.hash = "#plan";
            runIdeas();
          } }, svg("sparkle"), "Plan around this") : null,
          r ? h("button", { class: "btn", onclick: () => { close(); const c = JSON.parse(JSON.stringify(r)); delete c.id; delete c.seed_key; c.name += " (copy)"; openRecipe({ ...c, nutrition: r.nutrition }); } }, svg("copy"), "Duplicate") : null),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: close }, "Cancel"),
          h("button", { class: "btn primary", onclick: save }, r ? "Save recipe" : "Add recipe")))));
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  document.body.append(scrim);
  refresh();
}

/* ================================================================
   PANTRY
   ================================================================ */
function viewPantry() {
  const root = h("div");
  const s = S.data.settings;
  root.append(pageHead("Pantry", "Ingredients and their nutrients per 100 g. Pull them from the USDA database or enter them from a package label.",
    h("button", { class: "btn primary", onclick: () => openAddIngredient("") }, svg("plus"), "Add ingredient")));
  if (!s.usda_api_key) root.append(apiKeyBanner());
  if (S.data.seeded < S.data.starter_count) {
    root.append(h("div", { class: "panel", style: { marginBottom: "16px" } },
      h("div", { class: "panel-head" },
        h("div", null, h("h2", null, "Starter pantry"),
          h("p", { class: "muted", style: { margin: "4px 0 0", maxWidth: "70ch" } },
            `${S.data.starter_count} vegan staples (tofu, tempeh, lentils, fortified soy milk…) looked up in USDA, plus 16 high-protein prep recipes built from them. You review each USDA match before anything is saved.`)),
        h("button", { class: "btn primary", disabled: !s.usda_api_key, onclick: openStarterWizard },
          S.data.seeded ? "Finish importing starters" : "Import starters"))));
  }
  const q = S.pantryQ.toLowerCase();
  const list = S.data.ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || (i.usda_description || "").toLowerCase().includes(q));
  const usage = {};
  for (const r of S.data.recipes) for (const l of r.ingredients) usage[l.ingredient_id] = (usage[l.ingredient_id] || 0) + 1;
  root.append(h("div", { class: "toolbar" }, h("input", { type: "search", placeholder: "Search pantry", value: S.pantryQ, "aria-label": "Search pantry",
    oninput: debounce(e => { S.pantryQ = e.target.value; render(); document.querySelector(".toolbar input").focus(); }, 250) })));
  if (!S.data.ingredients.length) {
    root.append(h("div", { class: "empty" }, h("h2", null, "The pantry is empty"),
      h("p", null, "Import the starters above, or add ingredients one by one from USDA or a nutrition label.")));
    return root;
  }
  const tbl = h("table", { class: "table" },
    h("thead", null, h("tr", null, ["Ingredient", "Aisle", "Source", "kcal", "Protein", "Used in"].map(t => h("th", null, t)))),
    h("tbody", null, list.map(i => h("tr", { class: "click", onclick: () => openIngredient(i) },
      h("td", null, h("div", { style: { fontWeight: 500 } }, i.name), i.usda_description ? h("div", { class: "muted small" }, i.usda_description) : null),
      h("td", { class: "muted" }, i.aisle),
      h("td", null, h("span", { class: "tag" }, i.source === "usda" ? "USDA" : "Label"),
        i.verify ? h("span", { class: "tag warn", title: "Brands vary (fortification especially). Compare with your package label." }, "check label") : null),
      h("td", null, fmt(i.nutrients.kcal)), h("td", null, fmt(i.nutrients.protein, "g")),
      h("td", { class: "muted" }, usage[i.id] ? `${usage[i.id]} recipe${usage[i.id] > 1 ? "s" : ""}` : "–")))));
  root.append(h("div", { class: "panel table-wrap" }, tbl));
  return root;
}
function apiKeyBanner() {
  const input = h("input", { type: "text", placeholder: "Paste your USDA API key", style: { maxWidth: "340px" } });
  return h("div", { class: "banner" }, svg("info"),
    h("div", { style: { flex: 1 } },
      h("b", null, "Connect the USDA nutrient database"),
      h("p", { class: "small", style: { margin: "4px 0 8px" } }, "It's free and instant: sign up at ",
        h("a", { href: "https://fdc.nal.usda.gov/api-key-signup", target: "_blank", rel: "noopener" }, "fdc.nal.usda.gov/api-key-signup"),
        ", then paste the key from the email here."),
      h("div", { class: "row" }, input, h("button", { class: "btn primary sm", onclick: async () => {
        if (!input.value.trim()) return;
        await saveSetting("usda_api_key", input.value.trim()); toast("USDA key saved"); render();
      } }, "Save key"))));
}

function openAddIngredient(query, onDone) {
  let tab = "usda";
  const body = h("div", { class: "drawer-body" });
  const tabs = h("div", { class: "seg" });
  const draw = () => {
    tabs.replaceChildren(
      h("button", { class: tab === "usda" ? "on" : "", onclick: () => { tab = "usda"; draw(); } }, "Search USDA"),
      h("button", { class: tab === "label" ? "on" : "", onclick: () => { tab = "label"; draw(); } }, "From a nutrition label"));
    body.replaceChildren(tab === "usda" ? usdaSearchPane(query, done) : ingredientForm({ name: query, source: "manual", nutrients: {}, portions: [], aisle: "Other" }, done, { labelMode: true }));
  };
  const close = () => scrim.remove();
  const done = ing => { close(); if (onDone) onDone(ing); };
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Add ingredient" },
      h("div", { class: "drawer-head" }, h("h2", null, "Add ingredient"), tabs, h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      body));
  document.body.append(scrim);
  draw();
}
function usdaSearchPane(query, done) {
  const wrap = h("div");
  if (!S.data.settings.usda_api_key) { wrap.append(apiKeyBanner()); }
  const types = { "Foundation,SR Legacy": "Whole foods", "Branded": "Brand-name products" };
  let type = "Foundation,SR Legacy";
  const results = h("div", { class: "usda-results" });
  const input = h("input", { type: "search", value: query || "", placeholder: "e.g. chickpeas cooked, firm tofu, Silk soy milk" });
  const sel = h("select", { style: { width: "auto" }, onchange: e => { type = e.target.value; go(); } },
    Object.entries(types).map(([v, l]) => h("option", { value: v }, l)));
  const go = async () => {
    if (!input.value.trim()) return;
    results.replaceChildren(h("p", { class: "muted" }, "Searching USDA…"));
    try {
      const res = await api("GET", `/api/usda/search?q=${encodeURIComponent(input.value)}&types=${encodeURIComponent(type)}`);
      if (!res.length) { results.replaceChildren(h("p", { class: "muted" }, "No matches. Try fewer words, or switch to brand-name products.")); return; }
      results.replaceChildren(...res.map(f => h("div", { class: "usda-item" },
        h("div", null, h("div", { class: "d" }, f.description, f.brand ? h("span", { class: "muted" }, ` · ${f.brand}`) : null),
          h("div", { class: "m" }, `${f.data_type} · per 100 g: ${fmt(f.nutrients.kcal)} kcal, ${fmt(f.nutrients.protein)} g protein · ${f.n_nutrients} nutrients`)),
        h("button", { class: "btn sm", onclick: () => pickUsda(f) }, "Use this"))));
    } catch (e) { results.replaceChildren(h("div", { class: "banner" }, svg("alert"), e.message)); }
  };
  const pickUsda = async f => {
    let detail = f;
    try { detail = await api("GET", `/api/usda/food/${f.fdc_id}`); } catch { /* fall back to search data */ }
    const nice = f.description.split(",").slice(0, 2).join(",").trim();
    wrap.replaceChildren(ingredientForm({
      name: nice, source: "usda", fdc_id: f.fdc_id, usda_description: f.description + (f.brand ? ` (${f.brand})` : ""),
      data_type: f.data_type, nutrients: { ...f.nutrients, ...(detail.nutrients || {}) },
      portions: detail.portions || [], aisle: "Other", verify: f.data_type === "Branded",
    }, done));
  };
  input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  wrap.append(h("div", { class: "row" }, h("div", { style: { flex: 1 } }, input), sel, h("button", { class: "btn primary", onclick: go }, svg("search"), "Search")),
    h("p", { class: "muted small", style: { marginTop: "8px" } }, "Whole foods (Foundation & SR Legacy) have the most complete micronutrient data. Use brand-name products for fortified items like a specific soy milk or nutritional yeast."),
    results);
  if (query) setTimeout(go, 0);
  return wrap;
}
function openIngredient(i) {
  const close = () => scrim.remove();
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Edit ingredient" },
      h("div", { class: "drawer-head" }, h("h2", null, i.name), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      h("div", { class: "drawer-body" }, ingredientForm(JSON.parse(JSON.stringify(i)), () => close()))));
  document.body.append(scrim);
}
function ingredientForm(I, done, { labelMode } = {}) {
  // nutrient values are edited per `basis` grams, stored per 100 g
  let basis = labelMode ? 30 : 100;
  const vals = {};
  for (const n of S.data.nutrients) if (I.nutrients[n.key] != null) vals[n.key] = I.nutrients[n.key] * basis / 100;
  const form = h("div");
  const fld = (label, el) => h("label", { class: "field" }, h("span", null, label), el);
  const portions = h("div", { class: "ing-lines" });
  const drawPortions = () => {
    portions.replaceChildren(...I.portions.map((p, idx) => h("div", { class: "row" },
      h("input", { type: "text", value: p.label, placeholder: "cup, tbsp, block…", style: { flex: 1 }, "aria-label": "Portion name", oninput: e => { p.label = e.target.value; } }),
      h("input", { type: "number", step: "any", value: p.grams, style: { width: "100px" }, "aria-label": "Grams", oninput: e => { p.grams = +e.target.value; } }),
      h("span", { class: "muted" }, "g"),
      h("button", { class: "icon-btn", "aria-label": "Remove portion", onclick: () => { I.portions.splice(idx, 1); drawPortions(); } }, svg("x")))));
  };
  drawPortions();
  const nutInputs = h("div");
  const drawNut = () => {
    nutInputs.replaceChildren();
    for (const g of S.data.groups) {
      const grid = h("div", { class: "grid3", style: { marginBottom: "12px" } });
      for (const n of S.data.nutrients.filter(x => x.group === g)) {
        grid.append(fld(`${n.name} (${n.unit})`, h("input", { type: "number", step: "any", min: 0, value: vals[n.key] != null ? +(+vals[n.key]).toFixed(3) : "",
          placeholder: "unknown", oninput: e => { if (e.target.value === "") delete vals[n.key]; else vals[n.key] = +e.target.value; } })));
      }
      nutInputs.append(h("h3", { style: { margin: "8px 0" } }, g), grid);
    }
  };
  drawNut();
  const basisInput = h("input", { type: "number", min: 1, step: "any", value: basis, style: { width: "100px" },
    onchange: e => {
      const nb = +e.target.value || 100;
      for (const k in vals) vals[k] = vals[k] * nb / basis;
      basis = nb; drawNut();
    } });
  form.append(
    I.usda_description ? h("p", { class: "muted small" }, `USDA: ${I.usda_description} (#${I.fdc_id})`) : null,
    I.verify ? h("div", { class: "banner" }, svg("alert"), h("div", null, "Fortification differs between brands. Check these numbers against your package label (especially B12, calcium and vitamin D) and edit if needed.")) : null,
    h("div", { class: "grid2" },
      fld("Name", h("input", { type: "text", value: I.name || "", oninput: e => { I.name = e.target.value; } })),
      fld("Aisle", h("select", { onchange: e => { I.aisle = e.target.value; } }, AISLES.map(a => h("option", { selected: I.aisle === a }, a))))),
    h("div", { class: "panel-head", style: { marginTop: "18px" } }, h("h2", null, "Portion sizes"),
      h("button", { class: "btn sm", onclick: () => { I.portions.push({ label: "", grams: "" }); drawPortions(); } }, svg("plus"), "Add portion")),
    h("p", { class: "muted small" }, "Lets recipes say “2 cups” instead of grams."),
    portions,
    h("div", { class: "panel-head", style: { marginTop: "18px" } }, h("h2", null, "Nutrients"),
      h("label", { class: "row small" }, "Values per", basisInput, "g")),
    labelMode ? h("p", { class: "muted small" }, "Copy from the label: set the serving size in grams, then type each value it lists. Leave anything not on the label blank (blank means unknown, not zero).") : null,
    nutInputs);
  const save = async () => {
    if (!(I.name || "").trim()) { toast("Name is required", true); return; }
    I.nutrients = {};
    for (const k in vals) I.nutrients[k] = vals[k] * 100 / basis;
    I.portions = I.portions.filter(p => p.label && +p.grams > 0).map(p => ({ label: p.label.trim(), grams: +p.grams }));
    try {
      const saved = await api(I.id ? "PUT" : "POST", I.id ? `/api/ingredients/${I.id}` : "/api/ingredients", I);
      await reload(); toast(I.id ? "Ingredient saved" : `${saved.name} added to pantry`);
      done(saved); render();
    } catch (e) { toast(e.message, true); }
  };
  form.append(h("div", { class: "row", style: { justifyContent: "space-between", marginTop: "12px" } },
    I.id ? h("button", { class: "btn danger", onclick: async () => {
      if (!confirm(`Delete ${I.name}?`)) return;
      try { await api("DELETE", `/api/ingredients/${I.id}`); await reload(); toast("Deleted"); done(null); render(); }
      catch (e) { toast(e.message, true); }
    } }, "Delete") : h("span"),
    h("button", { class: "btn primary", onclick: save }, I.id ? "Save ingredient" : "Add to pantry")));
  return form;
}

/* ---- starter import wizard ---- */
async function openStarterWizard() {
  const items = await api("GET", "/api/seed/pantry");
  const todo = items.filter(i => !i.done);
  const results = {};
  const body = h("div", { class: "drawer-body" });
  const foot = h("div", { class: "drawer-foot" });
  const close = () => scrim.remove();
  let stopped = false;
  const draw = (progress) => {
    const tbl = h("table", { class: "table" }, h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "Starter"), h("th", null, "USDA match"))),
      h("tbody", null, todo.map(it => {
        const r = results[it.key];
        let cell;
        if (!r) cell = h("span", { class: "muted" }, "waiting…");
        else if (r.error) cell = h("span", { style: { color: "var(--tomato)" } }, r.error);
        else {
          const opts = [r.chosen, ...r.alternatives].filter(Boolean);
          cell = h("div", null, h("select", { onchange: e => { r.pick = opts.find(o => String(o.fdc_id) === e.target.value); } },
            opts.map(o => h("option", { value: o.fdc_id, selected: r.pick && o.fdc_id === r.pick.fdc_id }, `${o.description}${o.brand ? " · " + o.brand : ""} (${o.data_type})`))),
            !r.confident ? h("div", { class: "small", style: { color: "var(--squash)" } }, "No exact match. Pick the closest or untick.") : null);
        }
        return h("tr", null,
          h("td", null, r && !r.error ? h("input", { type: "checkbox", checked: r.use, "aria-label": "Import " + it.name, onchange: e => { r.use = e.target.checked; } }) : null),
          h("td", null, h("div", { style: { fontWeight: 500 } }, it.name), h("div", { class: "muted small" }, it.aisle)),
          h("td", null, cell));
      })));
    body.replaceChildren(
      h("p", { class: "muted" }, "Each starter ingredient is looked up in USDA. Check the matches (the dropdown has alternatives), then import. Brand-name items like nutritional yeast and pea protein vary a lot, so compare them with your own labels afterwards."),
      progress != null ? h("p", null, h("b", null, `Looking up ${progress} of ${todo.length}…`)) : null,
      h("div", { class: "table-wrap" }, tbl));
    const ready = Object.values(results).filter(r => r.use && r.pick).length;
    foot.replaceChildren(h("button", { class: "btn", onclick: () => { stopped = true; close(); } }, "Cancel"),
      h("button", { class: "btn primary", disabled: progress != null || !ready, onclick: commit }, `Import ${ready} ingredients & recipes`));
  };
  const commit = async () => {
    const sels = Object.entries(results).filter(([, r]) => r.use && r.pick)
      .map(([key, r]) => ({ key, fdc_id: r.pick.fdc_id, description: r.pick.description + (r.pick.brand ? ` (${r.pick.brand})` : ""), data_type: r.pick.data_type, nutrients: r.pick.nutrients }));
    try {
      const res = await api("POST", "/api/seed/commit", { selections: sels });
      await reload(); close(); render();
      toast(`Imported ${sels.length} ingredients and ${res.added.length} recipes` + (res.skipped.length ? ` (${res.skipped.length} recipes skipped: missing ingredients)` : ""));
    } catch (e) { toast(e.message, true); }
  };
  const scrim = h("div", { class: "scrim" },
    h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Import starters" },
      h("div", { class: "drawer-head" }, h("h2", null, "Import starter pantry"), h("button", { class: "icon-btn", "aria-label": "Close", onclick: () => { stopped = true; close(); } }, svg("x"))),
      body, foot));
  document.body.append(scrim);
  draw(1);
  for (let n = 0; n < todo.length && !stopped; n++) {
    const it = todo[n];
    try {
      const m = await api("POST", "/api/seed/match", { key: it.key });
      results[it.key] = { ...m, pick: m.chosen, use: !!m.chosen };
    } catch (e) {
      results[it.key] = { error: e.message };
      if (/rate limit|API key/i.test(e.message)) { toast(e.message, true); break; }
    }
    draw(n + 2 <= todo.length ? n + 2 : null);
  }
  draw(null);
}

/* ================================================================
   PREP DAY
   ================================================================ */
function viewPrep() {
  const root = h("div");
  const W = S.week;
  if (!W || !W.prep) {
    root.append(pageHead("Prep day", "Approximate prep and cook time with instructions. Shopping list included!"));
    root.append(h("div", { class: "empty" }, h("h2", null, "Plan a week first"),
      h("p", null, "The prep sheet is built from the current week plan."),
      h("a", { class: "btn primary", href: "#plan" }, "Go to Plan")));
    return root;
  }
  const P = W.prep;
  const hrs = P.total_minutes >= 60 ? `${Math.floor(P.total_minutes / 60)} h ${P.total_minutes % 60} min` : `${P.total_minutes} min`;
  root.append(pageHead(`Prep day${S.weekName ? ": " + S.weekName : ""}`,
    "Approximate prep and cook time with instructions. Shopping list included!",
    h("button", { class: "btn no-print", onclick: () => print() }, svg("print"), "Print")));
  const key = "shop-" + (S.weekName || "current");
  S.shopDone = store.get(key, {});
  const shop = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "12px" } }, "Shopping list"));
  for (const a of P.shopping) {
    const box = h("div", { class: "aisle" }, h("h3", null, a.aisle));
    for (const it of a.items) {
      const id = it.name;
      const row = h("label", { class: "shop" + (S.shopDone[id] ? " done" : "") },
        h("input", { type: "checkbox", checked: !!S.shopDone[id], onchange: e => { S.shopDone[id] = e.target.checked; store.set(key, S.shopDone); row.classList.toggle("done", e.target.checked); } }),
        h("span", { class: "n" }, it.name, it.verify ? h("span", { class: "muted small" }, " · check label") : null),
        h("span", { class: "q" }, it.pretty),
        h("span", { class: "sub" }, [it.portion, it.recipes.join(", ")].filter(Boolean).join(" · ")));
      box.append(row);
    }
    shop.append(box);
  }
  const cook = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "12px" } }, "Cook"));
  const staples = P.batches.filter(b => b.minutes <= 5);
  for (const b of P.batches.filter(b => b.minutes > 5)) {
    const mult = b.multiplier === 1 ? "1 batch" : `${b.multiplier}× batch`;
    cook.append(h("div", { class: "batch" },
      h("div", { class: "batch-h" }, h("b", null, b.name), h("span", { class: "muted small" }, `${mult} → ${fmtServ(b.multiplier * b.yield)} servings · ${b.minutes} min`)),
      h("div", { class: "split" },
        b.fridge_servings ? h("span", null, svg("fridge"), `${fmtServ(b.fridge_servings)} to the fridge`) : null,
        b.freezer_servings ? h("span", null, svg("freezer"), `${fmtServ(b.freezer_servings)} to the freezer`) : null,
        b.extra_servings > 0.01 ? h("span", { class: "muted" }, `${fmtServ(b.extra_servings)} extra`) : null),
      h("details", null, h("summary", null, "Scaled ingredients & steps"),
        h("ul", null, b.lines.map(l => h("li", null, `${l.amount} ${l.name}`, l.note ? h("span", { class: "muted" }, ` (${l.note})`) : null, h("span", { class: "muted" }, ` · ${fmt(l.grams)} g`)))),
        h("pre", null, b.steps))));
  }
  if (staples.length) cook.append(h("div", { class: "batch" }, h("b", null, "No-cook staples to have on hand"),
    h("ul", null, staples.map(b => h("li", null, `${b.name}: ${fmtServ(b.servings_needed)} serving${b.servings_needed === 1 ? "" : "s"}`)))));
  const thaw = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "8px" } }, "Thaw schedule"),
    P.thaw.length ? h("p", { class: "muted small" }, "Move these from the freezer to the fridge the night before.") : h("p", { class: "muted" }, "Everything this week stays in the fridge."),
    h("ul", { class: "thaw-list" }, P.thaw.map(t => {
      const idx = DAYS.indexOf(t.eat_day);
      return h("li", null, h("b", null, `${DAYS[(idx + 6) % 7]} night`), h("span", null, `${fmtServ(t.servings)} × ${t.recipe}`, h("span", { class: "muted" }, ` for ${t.eat_day}`)));
    })));
  root.append(h("div", { class: "prep-grid" }, shop, h("div", null, cook, thaw)));
  return root;
}

/* ================================================================
   SETTINGS
   ================================================================ */
function viewSettings() {
  const root = h("div");
  const s = S.data.settings;
  root.append(pageHead("Settings", "Change your goals and app preferences here."));
  const targets = JSON.parse(JSON.stringify(s.targets));
  const saveTargets = debounce(async () => { await saveSetting("targets", targets); toast("Targets saved"); S.combos = null; }, 600);
  const tbl = h("table", { class: "table" }, h("thead", null, h("tr", null, h("th", null, "Track"), h("th", null, "Nutrient"), h("th", null, "Daily target"), h("th", null, "Upper limit"))));
  const tb = h("tbody");
  for (const g of S.data.groups) {
    tb.append(h("tr", null, h("td", { colspan: 4, style: { fontWeight: 600, paddingTop: "16px" } }, g)));
    for (const n of S.data.nutrients.filter(x => x.group === g)) {
      if (n.kind === "info") {
        tb.append(h("tr", null, h("td"), h("td", null, n.name), h("td", { class: "muted" }, `${fmt(targetKcal())} kcal from the macros below`), h("td")));
        continue;
      }
      const t = targets[n.key];
      tb.append(h("tr", { title: n.note || null },
        h("td", null, h("input", { type: "checkbox", checked: t.enabled !== false, "aria-label": "Track " + n.name, onchange: e => { t.enabled = e.target.checked; saveTargets(); } })),
        h("td", null, n.name, n.kind === "limit" ? h("span", { class: "muted small" }, " (stay under)") : null, n.note ? h("div", { class: "muted small", style: { maxWidth: "48ch" } }, n.note) : null),
        h("td", null, h("div", { class: "row", style: { flexWrap: "nowrap" } }, h("input", { type: "number", step: "any", min: 0, value: t.target, "aria-label": n.name + " target", onchange: e => { t.target = +e.target.value; saveTargets(); } }), h("span", { class: "muted small" }, n.unit))),
        h("td", { class: "muted small" }, n.ul ? `${fmt(n.ul)} ${n.unit}${n.ul_scope === "supplement" ? " (supplements)" : ""}` : "–")));
    }
  }
  tbl.append(tb);
  const targetsPanel = h("div", { class: "panel" },
    h("div", { class: "panel-head" }, h("h2", null, "Daily targets"),
      h("button", { class: "btn sm", onclick: async () => { if (!confirm("Reset all targets to the defaults?")) return; const r = await api("POST", "/api/settings/reset_targets"); s.targets = r.value; render(); } }, "Reset to defaults")),
    h("p", { class: "muted small" }, "Defaults are US Dietary Reference Intakes for women 19-30, with iron and zinc raised for a vegan diet. Untick a nutrient to ignore it. Worth reviewing with her doctor or a dietitian, especially after bloodwork."),
    h("div", { class: "table-wrap" }, tbl));

  // supplements
  const supps = JSON.parse(JSON.stringify(s.supplements || []));
  const suppList = h("div");
  const saveSupps = async () => { await saveSetting("supplements", supps); await refreshAfterSupplementChange(); };
  const drawSupps = () => {
    suppList.replaceChildren(...(supps.length ? supps.map((sp, idx) => h("div", { class: "builder-item", style: { marginBottom: "6px" } },
      h("div", null, h("div", { style: { fontWeight: 500 } }, sp.name),
        h("div", { class: "muted small" }, Object.entries(sp.nutrients).map(([k, v]) => `${nutMeta(k).name} ${fmt(v)} ${nutMeta(k).unit}`).join(", "))),
      h("div", { class: "row" },
        h("label", { class: "check small" }, h("input", { type: "checkbox", checked: sp.active !== false, onchange: e => { sp.active = e.target.checked; saveSupps(); } }), "Taking"),
        h("button", { class: "icon-btn", "aria-label": "Remove " + sp.name, onclick: () => { supps.splice(idx, 1); saveSupps(); } }, svg("x")))))
      : [h("p", { class: "muted" }, "None yet. Add the ones she takes so plans count them. The Plan page also suggests doses.")]));
  };
  drawSupps();
  const newSupp = { name: "", key: "b12", amount: "" };
  const suppPanel = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "10px" } }, "Supplements she takes"),
    h("p", { class: "muted small" }, "Daily amounts. They're added to every day's totals and shown as striped bar segments."),
    suppList,
    h("div", { class: "row", style: { marginTop: "10px", alignItems: "flex-end" } },
      h("label", { class: "field", style: { flex: "1 1 160px" } }, h("span", null, "Name"), h("input", { type: "text", placeholder: "e.g. Vegan D3", oninput: e => { newSupp.name = e.target.value; } })),
      h("label", { class: "field", style: { flex: "1 1 160px" } }, h("span", null, "Nutrient"),
        h("select", { onchange: e => { newSupp.key = e.target.value; } }, S.data.nutrients.filter(n => n.kind !== "info").map(n => h("option", { value: n.key, selected: n.key === "b12" }, `${n.name} (${n.unit})`)))),
      h("label", { class: "field", style: { width: "110px" } }, h("span", null, "Amount"), h("input", { type: "number", step: "any", min: 0, oninput: e => { newSupp.amount = +e.target.value; } })),
      h("button", { class: "btn", onclick: () => {
        if (!newSupp.amount) { toast("Enter an amount", true); return; }
        const name = newSupp.name || nutMeta(newSupp.key).name;
        const ex = supps.find(x => x.name === name);
        if (ex) ex.nutrients[newSupp.key] = newSupp.amount; else supps.push({ name, nutrients: { [newSupp.key]: newSupp.amount }, active: true });
        saveSupps();
      } }, svg("plus"), "Add")),
    h("p", { class: "muted small", style: { marginTop: "8px" } }, "For a multivitamin, add it once per nutrient using the same name. They'll group together."));

  // structure
  const st = JSON.parse(JSON.stringify(s.structure));
  const saveSt = debounce(async () => { await saveSetting("structure", st); S.combos = null; toast("Meal structure saved"); }, 500);
  const structPanel = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "6px" } }, "Shape of a day"),
    h("p", { class: "muted small" }, "Servings per day from each category. The planner stays inside these ranges."),
    h("table", { class: "table" }, h("thead", null, h("tr", null, h("th", null, "Category"), h("th", null, "At least"), h("th", null, "At most"))),
      h("tbody", null, CATS.map(c => h("tr", null, h("td", null, h("span", { class: "tag cat-" + c }, c)),
        h("td", null, h("input", { type: "number", min: 0, step: 0.5, value: st[c][0], "aria-label": c + " minimum", onchange: e => { st[c][0] = +e.target.value; saveSt(); } })),
        h("td", null, h("input", { type: "number", min: 0, step: 0.5, value: st[c][1], "aria-label": c + " maximum", onchange: e => { st[c][1] = +e.target.value; saveSt(); } })))))),
    h("div", { class: "grid2", style: { marginTop: "12px" } },
      ...[["min_distinct", "Fewest different dishes a day"], ["max_distinct", "Most different dishes a day"]].map(([k, l]) =>
        h("label", { class: "field" }, h("span", null, l), h("input", { type: "number", min: 1, max: 10, value: s.week[k],
          onchange: e => saveSetting("week", { ...S.data.settings.week, [k]: +e.target.value }) })))));

  // usda + backup
  const keyInput = h("input", { type: "password", value: s.usda_api_key || "", placeholder: "USDA API key", autocomplete: "off" });
  const dataPanel = h("div", { class: "panel" }, h("h2", { style: { marginBottom: "10px" } }, "Data"),
    h("label", { class: "field" }, h("span", null, "USDA FoodData Central API key"),
      h("div", { class: "row", style: { flexWrap: "nowrap" } }, keyInput, h("button", { class: "btn", onclick: async () => { await saveSetting("usda_api_key", keyInput.value.trim()); toast("Key saved"); } }, "Save"))),
    h("p", { class: "muted small" }, "Free from ", h("a", { href: "https://fdc.nal.usda.gov/api-key-signup", target: "_blank", rel: "noopener" }, "fdc.nal.usda.gov/api-key-signup"), "."),
    h("h3", { style: { margin: "16px 0 8px" } }, "Backup"),
    h("p", { class: "muted small" }, "Saves your recipes, pantry, settings and saved weeks to a file (without the USDA key)."),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: downloadBackup }, "Download backup"),
      h("label", { class: "btn" }, "Import a backup", h("input", { type: "file", accept: ".json", class: "hidden", onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const res = await api("POST", "/api/import", JSON.parse(await f.text())); await reload(); render(); toast(`Imported ${res.recipes} recipes and ${res.ingredients} ingredients`); }
        catch (err) { toast("That file isn't a valid backup: " + err.message, true); }
      } }))));
  root.append(h("div", { class: "settings-grid" }, targetsPanel, h("div", null, syncPanel(), suppPanel, structPanel, dataPanel)));
  return root;
}

async function downloadBackup() {
  const data = await api("GET", "/api/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `zaijabolical-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================================================================
   SYNC (GitHub data repo)
   ================================================================ */
const SYNC_TEXT = {
  local: ["Saved on this device", "Not synced to other devices"],
  syncing: ["Syncing…", ""], pending: ["Saving…", ""], saving: ["Saving…", ""],
  synced: ["Synced", "Your changes are saved to GitHub"],
  offline: ["Offline", "Changes are kept on this device and sync when you're back online"],
  error: ["Sync problem", ""],
};
function syncBadge() {
  const st = Z.store.S;
  const [label, sub] = SYNC_TEXT[st.status] || ["", ""];
  return h("button", { class: "sync-badge st-" + st.status, title: st.error || sub || label, onclick: () => { location.hash = "#settings"; } },
    h("i"), label);
}
function refreshSyncBadge() {
  const old = document.querySelector(".sync-badge");
  if (old) old.replaceWith(syncBadge());
  const panel = document.getElementById("sync-panel");
  if (panel) panel.replaceWith(syncPanel());
}
function syncPanel() {
  const st = Z.store.S;
  const wrap = h("div", { class: "panel", id: "sync-panel" }, h("h2", { style: { marginBottom: "8px" } }, "Sync between devices"));
  if (!st.github) {
    wrap.append(h("p", { class: "muted small" }, "This device keeps its own copy. Connect your private GitHub data repo so both of your phones and computers share the same recipes and plans."),
      h("button", { class: "btn primary", onclick: () => showConnect(true) }, "Connect to GitHub"));
    return wrap;
  }
  const [label] = SYNC_TEXT[st.status] || [""];
  wrap.append(
    h("p", { class: "small" }, h("b", null, label), ` · ${st.github.owner}/${st.github.repo}`),
    st.error ? h("div", { class: "banner" }, svg("alert"), st.error) : null,
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: async () => { await Z.store.pull(); await reload(); render(); toast("Up to date"); } }, "Sync now"),
      h("button", { class: "btn", onclick: copySetupLink }, svg("copy"), "Copy setup link for another device"),
      h("button", { class: "btn ghost danger", onclick: () => {
        if (!confirm("Disconnect this device? Its copy of your data stays here, but it stops syncing.")) return;
        Z.store.disconnect(); render(); } }, "Disconnect")),
    h("p", { class: "muted small", style: { marginTop: "8px" } }, "The setup link connects another phone or computer in one tap. It contains your access key, so only send it to devices you trust (e.g. text it to her), and don't post it anywhere."));
  return wrap;
}
async function copySetupLink() {
  const link = Z.store.setupLink();
  try { await navigator.clipboard.writeText(link); toast("Setup link copied. Open it on the other device."); }
  catch { prompt("Copy this setup link and open it on the other device:", link); }
}

function showConnect(fromSettings) {
  const app = document.getElementById("app");
  const f = { owner: "", repo: "zaijabolical-data", token: "" };
  const err = h("div");
  const btn = h("button", { class: "btn primary", onclick: go }, "Connect");
  async function go() {
    err.replaceChildren();
    if (!f.owner || !f.repo || !f.token) { err.append(h("div", { class: "banner" }, svg("alert"), "Fill in all three fields.")); return; }
    btn.disabled = true; btn.textContent = "Connecting…";
    try {
      await Z.store.connect(f);
      await reload();
      toast("Connected. This device now syncs with GitHub.");
      location.hash = "#plan"; route();
    } catch (e) {
      err.append(h("div", { class: "banner" }, svg("alert"), e.message));
      btn.disabled = false; btn.textContent = "Connect";
    }
  }
  const field = (label, key, extra) => h("label", { class: "field" }, h("span", null, label),
    h("input", { type: "text", value: f[key], autocomplete: "off", spellcheck: false, oninput: e => { f[key] = e.target.value.trim(); }, ...extra }));
  app.replaceChildren(h("div", { class: "connect" },
    h("img", { src: "assets/logo.png", alt: "", class: "connect-logo" }),
    h("h1", null, fromSettings ? "Connect to GitHub" : "Welcome to Zaijabolical"),
    h("p", { class: "muted" }, "Your recipes and plans are saved to a private GitHub repo, so every device you connect sees the same data. Nobody else can see it."),
    h("div", { class: "panel" },
      h("ol", { class: "steps" },
        h("li", null, "On GitHub, create a ", h("b", null, "private"), " repo named ", h("code", null, "zaijabolical-data"), " (you may have already)."),
        h("li", null, "Create an access key: ", h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "github.com/settings/personal-access-tokens/new"),
          ". Under ", h("i", null, "Repository access"), " choose ", h("i", null, "Only select repositories"), " → zaijabolical-data. Under ", h("i", null, "Permissions → Repository permissions"),
          " set ", h("i", null, "Contents"), " to ", h("b", null, "Read and write"), ". Pick the longest expiration offered, then copy the key."),
        h("li", null, "Fill this in once on each device, or connect one device and use ", h("i", null, "Settings → Copy setup link"), " for the others.")),
      h("div", { class: "grid2", style: { marginTop: "14px" } }, field("GitHub username", "owner", { placeholder: "your-username" }), field("Data repo", "repo")),
      h("div", { style: { marginTop: "12px" } }, field("Access key", "token", { type: "password", placeholder: "github_pat_…" })),
      err,
      h("div", { class: "row", style: { marginTop: "14px", justifyContent: "space-between" } },
        fromSettings ? h("button", { class: "btn ghost", onclick: () => { location.hash = "#settings"; route(); } }, "Cancel")
          : h("button", { class: "btn ghost", onclick: () => { Z.store.useLocalOnly(); route(); } }, "Skip: use on this device only"),
        btn))));
}

/* ---------------- boot ---------------- */
(async function boot() {
  const theme = store.get("theme", null);
  if (theme) document.documentElement.dataset.theme = theme;
  const app = document.getElementById("app");
  app.append(loading("Opening your kitchen…"));
  await Z.store.init();
  // a setup link (#connect=...) connects this device in one step
  const link = Z.store.readSetupLink(location.hash);
  if (link) {
    history.replaceState(null, "", location.pathname + "#plan");
    try { await Z.store.connect(link); toast("This device is connected and synced."); }
    catch (e) { toast("That setup link didn't work: " + e.message, true); }
  }
  Z.store.onChange(refreshSyncBadge);
  await reload();
  try {
    const cw = await api("GET", "/api/week/current");
    if (cw && cw.data) {
      S.week = cw.data; S.weekName = cw.name;
      if (cw.choice != null) {
        const wo = await api("GET", "/api/week/options");
        if (wo && wo.options && wo.options[cw.choice]) {
          S.weekOptions = wo.options; S.weekRecommended = wo.recommended; S.weekChoice = cw.choice;
          S.anchors = wo.anchors || [];
        }
      }
    }
  } catch { /* a saved week is optional */ }
  window.addEventListener("hashchange", route);
  // pick up changes made on the other device when coming back to the app
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !Z.store.S.github || Z.store.S.dirty) return;
    const before = JSON.stringify(Z.store.S.doc);
    await Z.store.pull();
    if (JSON.stringify(Z.store.S.doc) !== before && !document.querySelector(".scrim")) {
      await reload();
      try { const cw = await api("GET", "/api/week/current"); if (cw && cw.data) { S.week = cw.data; S.weekName = cw.name; } } catch { /* ignore */ }
      render();
    }
  });
  route();
})();
