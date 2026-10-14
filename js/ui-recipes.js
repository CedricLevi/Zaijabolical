/* Zaijabolical interface: recipes (three list views, recipe page, editor, printing) and scanning.
   Loaded before ui.js; uses its helpers (h, svg, S, api, …) when called. */
"use strict";

const RECIPE_ICONS = {
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  plate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
Object.assign(ICONS, RECIPE_ICONS);

const SORTS = { name: "Name (A–Z)", rating: "Highest rated", protein: "Most protein", kcal: "Fewest calories", newest: "Newest" };
const RATING_FILTERS = { any: "Any rating", 5: "★★★★★ only", 4: "★★★★ and up", 3: "★★★ and up", none: "Not rated yet" };
const fmtSize = b => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* ---------------- small building blocks ---------------- */
function stars(rating, opts = {}) {
  const n = Math.round(Number(rating) || 0);
  if (!opts.onRate) {
    return h("span", { class: "stars" + (opts.big ? " big" : ""), role: "img", "aria-label": n ? `${n} out of 5 stars` : "Not rated" },
      "★".repeat(n), h("span", { class: "off" }, "★".repeat(5 - n)));
  }
  const wrap = h("span", { class: "stars rate" + (opts.big ? " big" : ""), role: "radiogroup", "aria-label": "Rating" });
  for (let i = 1; i <= 5; i++) {
    wrap.append(h("button", { type: "button", class: i <= n ? "" : "off", role: "radio", "aria-checked": i === n,
      "aria-label": `${i} star${i > 1 ? "s" : ""}`, title: i === n ? "Tap again to clear" : `${i} star${i > 1 ? "s" : ""}`,
      onclick: e => { e.stopPropagation(); opts.onRate(i === n ? 0 : i); } }, "★"));
  }
  return wrap;
}
/* Photos load when they scroll near the screen. (The browser's own loading="lazy" is unreliable on iPhone
   inside the app's scrolling content area, and it wouldn't stop the download from GitHub anyway.) */
const imgObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { imgObserver.unobserve(e.target); const go = e.target._load; e.target._load = null; if (go) go(); }
}, { rootMargin: "300px 0px" }) : null;
/** an <img> for a stored photo, filled in once it's loaded (downloaded from GitHub on first view).
    attrs.fallback: another stored file to try if the first can't be loaded; attrs.onMissing(img): neither loaded */
function mediaImg(path, type, attrs = {}) {
  const img = h("img", { alt: attrs.alt || "", class: attrs.class || null, decoding: "async" });
  img.classList.add("loading-img");
  const paths = [...new Set([path, attrs.fallback].filter(Boolean))];
  const next = async i => {
    for (; i < paths.length; i++) {
      const u = await Z.media.url(paths[i], type).catch(() => null);
      if (!u) continue;
      const at = i;
      img.onload = () => img.classList.remove("loading-img");
      img.onerror = () => { img.onerror = null; next(at + 1); };
      img.src = u;
      return;
    }
    img.classList.remove("loading-img"); img.classList.add("missing");
    if (attrs.onMissing) attrs.onMissing(img);
  };
  if (attrs.eager || !imgObserver) next(0); else { img._load = () => next(0); imgObserver.observe(img); }
  return img;
}
/** a recipe's main photo (its first one), or a placeholder */
function coverEl(r, { cls = "cover" } = {}) {
  const p = (r.photos || [])[0];
  const placeholder = () => [`placeholder`, `ph-${r.category || "Main"}`];
  if (p) {
    const box = h("div", { class: cls });
    box.append(mediaImg(p.path, "image/jpeg", { alt: r.name, fallback: p.thumb,
      onMissing: img => { box.classList.add(...placeholder()); img.replaceWith(svg("plate")); } }));
    return box;
  }
  return h("div", { class: [cls, ...placeholder()].join(" ") }, svg("plate"));
}
function shareOfDay(key, v) {
  const T = S.data.settings.targets;
  const target = key === "kcal" ? targetKcal() : (T[key] || {}).target;
  return target ? v / target * 100 : null;
}
/** one compact labelled bar: share of her daily target in one serving */
function mbar(n, v) {
  const pct = shareOfDay(n.key, v);
  let cls = "good";
  if (n.kind === "info") cls = "info";
  else if (n.kind === "limit") cls = pct > 100 ? "over" : pct > 40 ? "ok" : "good";
  else cls = pct >= 33 ? "good" : pct >= 15 ? "ok" : "low";
  const unit = n.unit.split(" ")[0];
  return h("div", { class: "mbar", title: `${n.name}: ${fmt(v, n.unit)} per serving${pct != null ? ` (${Math.round(pct)}% of her day)` : ""}` },
    h("span", { class: "n" }, n.short || n.name),
    h("div", { class: "t" }, h("i", { class: cls, style: { width: Math.min(100, pct || 0) + "%" } })),
    h("span", { class: "v" }, `${fmt(v)}${unit === "kcal" ? "" : " " + unit}`, pct != null ? h("small", null, ` · ${Math.round(pct)}%`) : null));
}
const SHORT = { kcal: "Calories", carbs: "Carbs", satfat: "Sat. fat", ala: "ALA (ω-3)", epa_dha: "EPA+DHA", pantothenic: "B5", riboflavin: "B2",
  thiamin: "B1", niacin: "B3", b6: "B6", b12: "B12", vit_a: "Vitamin A", vit_c: "Vitamin C", vit_d: "Vitamin D", vit_e: "Vitamin E", vit_k: "Vitamin K" };
function groupNutrients(group) {
  const T = S.data.settings.targets;
  return S.data.nutrients.filter(n => n.group === group && !n.supplement_only && (n.kind === "info" || (T[n.key] || {}).enabled !== false))
    .map(n => ({ ...n, short: SHORT[n.key] || n.name }));
}
/** the amino acid mini-bars that sit under Protein */
function aminoBars(am, opts = {}) {
  if (!am || !am.has_data) {
    return h("div", { class: "aa-none muted small" }, am && am.protein > 0.5
      ? "No amino acid data yet" : "");
  }
  const wrap = h("div", { class: "aa" + (opts.wide ? " wide" : ""), role: "img",
    "aria-label": "Essential amino acids per gram of protein: " + am.acids.map(a => `${a.name} ${Math.round(a.quality)}%`).join(", ") });
  for (const a of am.acids) {
    const q = a.quality || 0;
    const cls = q >= 100 ? "good" : q >= 85 ? "ok" : "low";
    wrap.append(h("div", { title: `${a.name}: ${Math.round(q)}% of the reference amount per gram of protein${opts.daily ? ` · ${fmt(a.grams * 1000)} mg` : ""}` },
      h("div", { class: "col" }, h("b", { class: "ref" }), h("i", { class: cls, style: { height: Math.min(100, q / 150 * 100) + "%" } })),
      h("span", null, a.abbr)));
  }
  return wrap;
}
function aminoCaption(am) {
  if (!am || !am.has_data) return null;
  const lim = am.acids.find(a => a.id === am.limiting);
  return h("p", { class: "muted small aa-cap" }, lim && lim.quality < 100
    ? `Protein quality ${Math.round(am.score)}%. Lowest: ${lim.name.toLowerCase()}. Pair with ${lim.id === "lys" ? "beans, lentils, tofu or tempeh" : lim.id === "saa" ? "grains, seeds or nuts" : "a different protein"} to balance it.`
    : "Complete protein: every essential amino acid meets the reference (line).");
}
function nutritionPanel(r, { title = "One serving", wide } = {}) {
  const per = r.nutrition.per_serving;
  const box = h("div", { class: "nutri" });
  for (const g of S.data.groups) {
    const rows = h("div", { class: "mbars" });
    for (const n of groupNutrients(g)) {
      rows.append(mbar(n, per[n.key] || 0));
      if (n.key === "protein") rows.append(aminoBars(r.nutrition.amino, { wide }));
    }
    if (g === "Macros") box.append(h("h3", null, g), rows, aminoCaption(r.nutrition.amino));
    else box.append(h("details", null, h("summary", null, g), rows));
  }
  return h("div", { class: "panel" },
    h("div", { class: "panel-head", style: { marginBottom: "6px" } }, h("h2", null, title), h("span", { class: "muted small" }, `% of her day · ${fmt(r.nutrition.grams_per_serving)} g`)),
    box);
}

/* ================================================================
   RECIPES: list views
   ================================================================ */
function recipeFilterState() {
  if (!S.recipeFilter.sort) Object.assign(S.recipeFilter, { sort: store.get("recipeSort", "name"), rating: "any" });
  if (!S.recipeView) S.recipeView = store.get("recipeView", "simple");
  if (!S.advSection) S.advSection = store.get("advSection", "Macros");
  return S.recipeFilter;
}
function filteredRecipes() {
  const f = recipeFilterState();
  const q = f.q.toLowerCase().trim();
  let list = S.data.recipes.filter(r => (f.cat === "All" || r.category === f.cat) &&
    (!q || r.name.toLowerCase().includes(q) || (r.tags || []).join(" ").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q)));
  if (f.rating === "none") list = list.filter(r => !r.rating);
  else if (f.rating !== "any") list = list.filter(r => (r.rating || 0) >= Number(f.rating));
  return sortRecipes(list, f);
}
function sortRecipes(list, f) {
  const per = r => r.nutrition.per_serving;
  const by = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || by.name(a, b),
    protein: (a, b) => per(b).protein - per(a).protein,
    kcal: (a, b) => per(a).kcal - per(b).kcal,
    newest: (a, b) => String(b.created || b.updated || "").localeCompare(String(a.created || a.updated || "")),
    category: (a, b) => CATS.indexOf(a.category) - CATS.indexOf(b.category) || by.name(a, b),
    carbs: (a, b) => per(b).carbs - per(a).carbs, fat: (a, b) => per(b).fat - per(a).fat,
  };
  list.sort(by[f.sort] || by.name);
  if (f.reverse) list.reverse();
  return list;
}

function viewRecipes() {
  const root = h("div");
  const f = recipeFilterState();
  root.append(pageHead("Recipes", "Your cookbook! Scan using your phone camera or add manually.",
    h("button", { class: "btn", onclick: () => openImportCookbook() }, svg("book"), h("span", { class: "hide-xs" }, "Import cookbook")),
    h("button", { class: "btn", onclick: () => openScanRecipe() }, svg("camera"), "Scan a recipe"),
    h("button", { class: "btn primary", onclick: () => openRecipe(null) }, svg("plus"), "New recipe")));
  if (!S.data.recipes.length) {
    root.append(h("div", { class: "empty" }, h("h2", null, "No recipes yet"),
      h("p", null, "Scan one from a cookbook, write your own, or import the 16 starter recipes from the Pantry page."),
      h("div", { class: "row", style: { justifyContent: "center" } },
        h("button", { class: "btn primary", onclick: () => openScanRecipe() }, svg("camera"), "Scan a recipe"),
        h("button", { class: "btn", onclick: () => openImportCookbook() }, svg("book"), "Import cookbook"),
        h("button", { class: "btn", onclick: () => openRecipe(null) }, "New recipe"),
        h("a", { class: "btn", href: "#pantry" }, "Import starters"))));
    return root;
  }
  const seg = h("div", { class: "seg cats" });
  for (const c of ["All", ...CATS]) seg.append(h("button", { class: f.cat === c ? "on" : "", onclick: () => { f.cat = c; render(); } }, c));
  const search = h("input", { type: "search", placeholder: "Search recipes", value: f.q, "aria-label": "Search recipes", class: "rsearch",
    oninput: debounce(e => { f.q = e.target.value; render(); const i = document.querySelector(".rsearch"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250) });
  const ratingSel = h("select", { class: "pill", "aria-label": "Filter by rating", onchange: e => { f.rating = e.target.value; render(); } },
    Object.entries(RATING_FILTERS).map(([v, l]) => h("option", { value: v, selected: String(f.rating) === v }, l)));
  const sortSel = h("select", { class: "pill", "aria-label": "Sort", onchange: e => { f.sort = e.target.value; f.reverse = false; store.set("recipeSort", f.sort); render(); } },
    Object.entries(SORTS).map(([v, l]) => h("option", { value: v, selected: f.sort === v }, "Sort: " + l)),
    SORTS[f.sort] ? null : h("option", { value: f.sort, selected: true }, "Sort: " + f.sort));
  root.append(h("div", { class: "toolbar rtools" }, search, ratingSel, sortSel, seg, viewSwitch(render)));
  const list = filteredRecipes();
  if (!list.length) { root.append(h("p", { class: "muted" }, "No recipes match.")); return root; }
  if (S.recipeView === "advanced") {
    root.append(advHead(render));
    root.append(h("div", { class: "cards adv" }, list.map(advancedCard)));
  } else if (S.recipeView === "list") {
    root.append(listTable(list));
  } else {
    root.append(h("div", { class: "cards" }, list.map(r => simpleCard(r))));
  }
  return root;
}
const goRecipe = r => { location.hash = "#recipe/" + encodeURIComponent(r.id); };
/** Simple / Advanced / List (remembered on this device, shared by the Recipes page and the picker) */
function viewSwitch(redraw) {
  const views = h("div", { class: "seg viewswitch", role: "tablist", "aria-label": "View" });
  for (const [id, label, icon] of [["simple", "Simple", "grid"], ["advanced", "Advanced", "bars"], ["list", "List", "list"]]) {
    views.append(h("button", { class: S.recipeView === id ? "on" : "", role: "tab", "aria-selected": S.recipeView === id,
      onclick: () => { S.recipeView = id; store.set("recipeView", id); redraw(); } }, svg(icon), h("span", null, label)));
  }
  return views;
}
function advHead(redraw) {
  const sec = h("div", { class: "seg" });
  for (const g of S.data.groups) sec.append(h("button", { class: S.advSection === g ? "on" : "", onclick: () => { S.advSection = g; store.set("advSection", g); redraw(); } }, g));
  return h("div", { class: "row adv-head" }, h("span", { class: "muted small" }, "Showing for every recipe:"), sec,
    h("span", { class: "muted small" }, "% = share of her daily target in one serving"));
}

function simpleCard(r, onClick) {
  const per = r.nutrition.per_serving;
  const rows = rowsFor(per).map(x => ({ ...x, status: x.kind === "limit" ? (x.pct > 50 ? "ok" : "good") : (x.pct >= 33 ? "good" : x.pct >= 15 ? "ok" : "low") }));
  return h("button", { class: "pcard" + (r.active ? "" : " inactive"), onclick: () => (onClick || goRecipe)(r) },
    h("div", { class: "ph" }, coverEl(r), h("div", { class: "over" }, h("h3", null, r.name))),
    h("div", { class: "bd" },
      h("div", { class: "row between" }, stars(r.rating),
        h("span", { class: "row tight" }, r.active ? null : h("span", { class: "tag" }, "not in plans"), h("span", { class: "tag cat-" + r.category }, r.category))),
      h("div", { class: "macros" },
        h("span", null, h("b", null, fmt(per.kcal)), "kcal"), h("span", null, h("b", null, fmt(per.protein)), "protein"),
        h("span", null, h("b", null, fmt(per.carbs)), "carbs"), h("span", null, h("b", null, fmt(per.fat)), "fat")),
      fingerprint(rows)));
}
function advancedCard(r, onClick) {
  const per = r.nutrition.per_serving;
  const rows = h("div", { class: "mbars" });
  for (const n of groupNutrients(S.advSection)) {
    rows.append(mbar(n, per[n.key] || 0));
    if (n.key === "protein") rows.append(aminoBars(r.nutrition.amino));
  }
  return h("button", { class: "panel acard" + (r.active ? "" : " inactive"), onclick: () => (onClick || goRecipe)(r) },
    h("div", { class: "acard-h" }, coverEl(r, { cls: "thumb" }),
      h("div", { style: { minWidth: 0 } }, h("h3", null, r.name), stars(r.rating))),
    rows);
}
function listTable(list, { onOpen = goRecipe, f = S.recipeFilter, redraw = () => { store.set("recipeSort", f.sort); render(); } } = {}) {
  const th = (label, key, cls) => h("th", { class: cls || null },
    h("button", { class: "sorter" + (f.sort === key ? " on" : ""), onclick: () => {
      if (f.sort === key) f.reverse = !f.reverse; else { f.sort = key; f.reverse = false; }
      redraw();
    } }, label, f.sort === key ? (f.reverse ? " ↑" : " ↓") : ""));
  return h("div", { class: "panel table-wrap ltable-wrap" }, h("table", { class: "table ltable" },
    h("thead", null, h("tr", null, th("Recipe", "name"), th("Rating", "rating"), th("Category", "category", "hide-sm"),
      th("Calories", "kcal", "num"), th("Protein", "protein", "num"), th("Carbs", "carbs", "num hide-sm"), th("Fat", "fat", "num hide-sm"))),
    h("tbody", null, list.map(r => {
      const p = r.nutrition.per_serving;
      return h("tr", { class: "click" + (r.active ? "" : " inactive"), onclick: () => onOpen(r), tabindex: 0, onkeydown: e => { if (e.key === "Enter") onOpen(r); } },
        h("td", null, h("div", { class: "row tight nowrap" }, coverEl(r, { cls: "thumb sm" }), h("span", { class: "lname" }, r.name))),
        h("td", null, stars(r.rating)),
        h("td", { class: "hide-sm" }, h("span", { class: "tag cat-" + r.category }, r.category)),
        h("td", { class: "num" }, fmt(p.kcal)), h("td", { class: "num" }, fmt(p.protein, "g")),
        h("td", { class: "num hide-sm" }, fmt(p.carbs, "g")), h("td", { class: "num hide-sm" }, fmt(p.fat, "g")));
    }))));
}

/* ================================================================
   RECIPE PAGE (read mode)
   ================================================================ */
function stepLines(text) {
  return String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => s.replace(/^(\d+[.)]|[-•*])\s*/, ""));
}
function amountText(line, ing) {
  const a = line.amount != null && line.amount !== "" ? fmtAmount(line.amount) : "";
  return [a, line.unit && !(line.unit === "g" && !a) ? line.unit : ""].filter(Boolean).join(" ");
}
function fmtAmount(v) {
  v = Number(v);
  if (!isFinite(v)) return "";
  const whole = Math.floor(v + 1e-9), frac = v - whole;
  const F = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]].find(([x]) => Math.abs(frac - x) < 0.02);
  if (frac < 0.02) return String(whole);
  if (F) return (whole ? whole : "") + F[1];
  return String(Math.round(v * 100) / 100);
}
function hero(r) {
  const photos = r.photos || [];
  if (!photos.length) return null;
  const track = h("div", { class: "hero-track" });
  photos.forEach((p, i) => track.append(h("div", { class: "hero-slide" }, mediaImg(p.path, "image/jpeg", { alt: `${r.name}, photo ${i + 1}`, eager: i === 0, fallback: p.thumb }))));
  const dots = h("div", { class: "dots" }, photos.map((_, i) => h("i", { class: i === 0 ? "on" : "" })));
  const count = h("span", { class: "count" }, `1 / ${photos.length}`);
  const go = d => track.scrollBy({ left: d * track.clientWidth, behavior: "smooth" });
  track.addEventListener("scroll", debounce(() => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    dots.querySelectorAll("i").forEach((d, j) => d.classList.toggle("on", i === j));
    count.textContent = `${i + 1} / ${photos.length}`;
  }, 60));
  return h("div", { class: "hero" }, track,
    photos.length > 1 ? [count, dots,
      h("button", { class: "hero-nav prev", "aria-label": "Previous photo", onclick: () => go(-1) }, svg("back")),
      h("button", { class: "hero-nav next", "aria-label": "Next photo", onclick: () => go(1) }, svg("next"))] : null);
}
function viewRecipe(id) {
  const r = recipeById(id);
  const root = h("div", { class: "detail" });
  if (!r) {
    root.append(h("div", { class: "empty" }, h("h2", null, "That recipe isn't here"),
      h("p", null, "It may have been deleted on the other device."), h("a", { class: "btn primary", href: "#recipes" }, "Back to recipes")));
    return root;
  }
  const ingMapLocal = Object.fromEntries(S.data.ingredients.map(i => [i.id, i]));
  root.append(h("div", { class: "detail-bar no-print" },
    h("a", { class: "btn ghost", href: "#recipes" }, svg("back"), "Recipes"),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => printRecipe(r) }, svg("print"), h("span", { class: "hide-xs" }, "Print")),
      h("button", { class: "btn primary", onclick: () => openRecipe(r) }, svg("edit"), "Edit"))));
  root.append(h("h1", { class: "detail-title" }, r.name));
  root.append(hero(r));
  const chips = h("div", { class: "chips" },
    h("span", { class: "tag cat-" + r.category }, r.category),
    h("span", { class: "tag" }, `${fmtServ(r.servings)} servings`),
    r.freezes ? h("span", { class: "tag" }, svg("freezer"), "freezes") : h("span", { class: "tag" }, svg("fridge"), `${r.fridge_days} days in fridge`),
    (r.prep_min || r.cook_min) ? h("span", { class: "tag" }, `${r.prep_min || 0} min prep · ${r.cook_min || 0} min cook`) : null,
    r.active ? null : h("span", { class: "tag" }, "not in plans"),
    r.source && r.source.book ? h("span", { class: "tag", title: [r.source.book, r.source.chapter].filter(Boolean).join(" · ") }, svg("book"), r.source.book.split(/[:(]/)[0].trim()) : null);
  root.append(h("div", { class: "detail-meta" },
    stars(r.rating, { big: true, onRate: async v => {
      try { await api("PATCH", `/api/recipes/${r.id}`, { rating: v }); await reload(); render(); toast(v ? `Rated ${v} star${v > 1 ? "s" : ""}` : "Rating cleared"); }
      catch (e) { toast(e.message, true); }
    } }), chips));
  if (r.nutrition.unlinked) root.append(h("div", { class: "banner" }, svg("alert"),
    h("div", null, `${r.nutrition.unlinked} ingredient${r.nutrition.unlinked > 1 ? "s aren't" : " isn't"} linked to the pantry yet, so the nutrition leaves ${r.nutrition.unlinked > 1 ? "them" : "it"} out. `,
      h("a", { class: "linklike", href: "#link" }, "Link ingredients"))));

  const left = h("div");
  if (r.description) left.append(h("div", { class: "panel" }, h("h2", null, "About"), h("p", { class: "prose" }, r.description)));
  left.append(h("div", { class: "panel" },
    h("div", { class: "panel-head", style: { marginBottom: "6px" } }, h("h2", null, "Ingredients"), h("span", { class: "muted small" }, `for ${fmtServ(r.servings)} servings`)),
    r.ingredients.length ? h("ul", { class: "ingl" }, r.ingredients.map(l => {
      const ing = ingMapLocal[l.ingredient_id];
      return h("li", { class: ing ? "" : "unlinked" }, h("b", null, amountText(l, ing)),
        h("span", null, ing ? ing.name : l.name, l.note ? h("span", { class: "muted" }, ` · ${l.note}`) : null,
          ing ? null : l.ignore ? h("span", { class: "muted small" }, " (no nutrition)") : h("span", { class: "conf", title: "Not linked to a pantry ingredient" }, "not linked")));
    })) : h("p", { class: "muted" }, "No ingredients yet.")));
  const steps = stepLines(r.steps);
  left.append(h("div", { class: "panel" }, h("h2", null, "Steps"),
    steps.length ? h("ol", { class: "stepsl" }, steps.map(s => h("li", null, s))) : h("p", { class: "muted" }, "No steps written yet.")));

  const right = h("div");
  right.append(nutritionPanel(r));
  if (r.notes) right.append(h("div", { class: "panel" }, h("h2", null, "Notes"), h("p", { class: "prose" }, r.notes)));
  if ((r.links || []).length) right.append(h("div", { class: "panel" }, h("h2", null, "Links"),
    r.links.map(l => h("a", { class: "linkrow", href: l.url, target: "_blank", rel: "noopener noreferrer" }, svg("link"),
      h("span", null, l.title || hostOf(l.url), l.title ? h("span", { class: "muted" }, " · " + hostOf(l.url)) : null)))));
  if ((r.attachments || []).length) right.append(h("div", { class: "panel" }, h("h2", null, "Attachments"),
    r.attachments.map(a => h("button", { class: "filerow", onclick: () => openAttachment(a) },
      svg(/^image\//.test(a.type) ? "image" : "file"), h("span", null, a.name, h("span", { class: "muted" }, ` · ${fmtSize(a.size || 0)}`))))));
  right.append(h("div", { class: "row no-print", style: { marginTop: "16px" } },
    r.ingredients.length ? h("button", { class: "btn", onclick: () => planAround(r) }, svg("sparkle"), "Plan around this") : null,
    h("button", { class: "btn", onclick: () => duplicateRecipe(r) }, svg("copy"), "Duplicate")));
  root.append(h("div", { class: "dgrid" }, left, right));
  return root;
}
function openAttachment(a) {
  if (a.type === "text/html") openHtmlAttachment(a);
  else Z.media.open(a).catch(e => toast(e.message, true));
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }
function planAround(r) {
  S.anchors = [r.id]; S.planTab = "ideas"; S.combos = null;
  location.hash = "#plan";
  runIdeas();
}
function duplicateRecipe(r) {
  const c = JSON.parse(JSON.stringify(r));
  delete c.id; delete c.seed_key; c.name += " (copy)"; c.photos = []; c.attachments = []; c.rating = 0;
  openRecipe({ ...c, nutrition: r.nutrition }, { isNew: true });
}

/* ---------------- print ---------------- */
function printRecipe(r) {
  document.getElementById("print-root")?.remove();
  const ing = Object.fromEntries(S.data.ingredients.map(i => [i.id, i]));
  const per = r.nutrition.per_serving;
  const key = ["kcal", "protein", "carbs", "fat", "fiber", "iron", "calcium", "zinc"].map(k => nutMeta(k)).filter(Boolean);
  const p = (r.photos || [])[0];
  const root = h("div", { id: "print-root", class: "print-recipe" },
    h("div", { class: "pr-head" },
      h("div", null, h("h1", null, r.name),
        h("div", { class: "pr-meta" }, r.rating ? stars(r.rating) : null,
          h("span", null, `${r.category} · ${fmtServ(r.servings)} servings`),
          (r.prep_min || r.cook_min) ? h("span", null, `${r.prep_min || 0} min prep · ${r.cook_min || 0} min cook`) : null,
          h("span", null, r.freezes ? "Freezes well" : `Fridge ${r.fridge_days} days`))),
      h("img", { class: "pr-logo", src: "assets/logo.png", alt: "" })),
    p ? h("div", { class: "pr-photo" }, mediaImg(p.path, "image/jpeg", { eager: true, alt: "" })) : null,
    r.description ? h("p", { class: "pr-about" }, r.description) : null,
    h("div", { class: "pr-cols" },
      h("section", null, h("h2", null, "Ingredients"),
        h("ul", { class: "pr-ing" }, r.ingredients.map(l => h("li", null, h("b", null, amountText(l, ing[l.ingredient_id])), " ",
          ing[l.ingredient_id] ? ing[l.ingredient_id].name : l.name, l.note ? h("i", null, ` (${l.note})`) : null)))),
      h("section", null, h("h2", null, "Steps"), h("ol", { class: "pr-steps" }, stepLines(r.steps).map(s => h("li", null, s))))),
    r.notes ? h("section", { class: "pr-notes" }, h("h2", null, "Notes"), h("p", null, r.notes)) : null,
    h("section", { class: "pr-nut" }, h("h2", null, "Per serving"),
      h("div", { class: "pr-nutrow" }, key.map(n => h("div", null, h("b", null, fmt(per[n.key])), h("span", null, `${n.unit.split(" ")[0]} ${SHORT[n.key] ? SHORT[n.key].toLowerCase() : n.name.toLowerCase()}`))))),
    (r.links || []).length ? h("p", { class: "pr-links" }, r.links.map(l => `${l.title || hostOf(l.url)}: ${l.url}`).join("   ·   ")) : null);
  document.body.append(root);
  document.body.classList.add("printing-recipe");
  const done = () => { document.body.classList.remove("printing-recipe"); root.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  // give the photo a moment to load before the print dialog opens
  const img = root.querySelector(".pr-photo img");
  let fired = false;
  const go = () => { if (fired) return; fired = true; setTimeout(() => print(), 50); };
  if (img && !img.complete) { img.addEventListener("load", go, { once: true }); setTimeout(go, 2500); }
  else go();
}

/* ================================================================
   RECIPE EDITOR
   ================================================================ */
const UNIT_ALIASES = { tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tbls: "tbsp", tbl: "tbsp", t: "tbsp", teaspoon: "tsp", teaspoons: "tsp",
  cups: "cup", c: "cup", grams: "g", gram: "g", gr: "g", ounce: "oz", ounces: "oz", pound: "lb", pounds: "lb", lbs: "lb", kilogram: "kg", kilograms: "kg",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", ml: "ml", liter: "l", liters: "l", litre: "l", litres: "l", cans: "can",
  cloves: "clove", pieces: "piece", slices: "slice", blocks: "block", packages: "package", pkg: "package", bunches: "bunch", handfuls: "handful" };
function normUnit(u) {
  u = String(u || "").toLowerCase().replace(/\./g, "").trim();
  if (u === "T") return "tbsp";
  return UNIT_ALIASES[u] || u.replace(/(es|s)$/, m => (u.length > 3 ? "" : m));
}
/** best way to express a scanned amount with this ingredient's units: [amount, unit, ok] */
function mapUnit(amount, unit, ing) {
  const u = normUnit(unit);
  const amt = amount == null || amount === "" ? 1 : Number(amount);
  if (["g", "kg", "oz", "lb"].includes(u)) return [amt, u, true];
  const portions = (ing && ing.portions) || [];
  const find = w => portions.find(p => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(p.label));
  if (u) { const p = find(u); if (p) return [amt, p.label, true]; }
  const VOL = { tsp: 1, tbsp: 3, cup: 48, ml: 0.2029, l: 202.9 };
  if (VOL[u]) {
    for (const v of ["cup", "tbsp", "tsp"]) { const p = find(v); if (p) return [Math.round(amt * VOL[u] / VOL[v] * 100) / 100, p.label, true]; }
    if (u === "ml" || u === "l") return [amt * (u === "l" ? 1000 : 1), "g", false];
  }
  if (!u) {
    const p = portions.find(p => /\b(medium|whole|piece|large|small|each|fruit|clove|slice)\b/i.test(p.label)) || portions[0];
    if (p) return [amt, p.label, !!portions.find(x => x === p && /\b(medium|whole|piece|each)\b/i.test(x.label))];
  }
  return [amt, portions[0] ? portions[0].label : "g", false];
}
const STOP = new Set(["fresh", "chopped", "diced", "minced", "sliced", "large", "small", "medium", "organic", "raw", "finely", "roughly", "thinly",
  "of", "and", "or", "to", "taste", "optional", "a", "an", "the", "for", "plus", "more", "extra", "about", "cup", "cups", "tbsp", "tsp", "packed",
  "heaping", "level", "whole", "pinch", "dash", "unsalted", "low", "sodium", "reduced", "boneless", "frozen", "thawed", "drained", "rinsed", "can",
  "cans", "canned", "cooked", "uncooked", "dry", "dried", "ground", "peeled", "into", "cut", "pieces", "piece", "pressed", "crumbled", "store", "bought",
  "grated", "shredded", "cubed", "halved", "quartered", "zested", "juiced", "melted", "softened", "toasted", "crushed", "trimmed", "torn", "divided",
  "room", "temperature", "hot", "cold", "warm", "boiling", "filtered", "fine", "coarse", "coarsely", "plus", "extra", "virgin", "good", "quality", "unsweetened", "plain"]);
const SYN = { garbanzo: "chickpea", nooch: "nutritional", scallion: "green", coriander: "cilantro", tamari: "soy", courgette: "zucchini",
  aubergine: "eggplant", capsicum: "pepper", mince: "crumble", rolled: "oat", oatmeal: "oat" };
function tokens(s) {
  return String(s || "").toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z\s-]/g, " ").split(/[\s-]+/)
    .filter(w => w.length > 1 && !STOP.has(w)).map(w => (w.length > 4 ? w.replace(/(ies)$/, "y").replace(/(oes|es|s)$/, m => (m === "oes" ? "o" : m === "es" && /(ch|sh|x|ss)es$/.test(w) ? "" : m === "es" ? "e" : "")) : w))
    .map(w => SYN[w] || w);
}
/** pantry ingredient that best matches a scanned name, or null */
function matchIngredient(name) { const m = matchIngredientScored(name); return m && m.score >= 0.6 ? m.ing : null; }
const NO_NUTRITION = /^((hot|cold|warm|boiling|ice|filtered|tap|cool|lukewarm)\s+)?water$|^ice( cubes)?$/i;
function matchIngredientScored(name) {
  const a = tokens(name);
  if (!a.length) return null;
  let best = null;
  for (const ing of S.data.ingredients) {
    const b = new Set(tokens(ing.name));
    if (!b.size) continue;
    let m = 0;
    for (const w of a) if (b.has(w) || [...b].some(x => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))) m++;
    let score = m / a.length - 0.15 * (b.size - Math.min(m, b.size)) / b.size;
    // the last word is usually the food itself ("red cabbage" is cabbage): it has to match
    const head = a[a.length - 1];
    if (a.length > 1 && !b.has(head) && ![...b].some(x => x.length > 3 && (x.startsWith(head) || head.startsWith(x)))) score *= 0.4;
    if (m && (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && ing.name.length < best.ing.name.length))) best = { ing, score };
  }
  return best;
}

function openRecipe(r, opts = {}) {
  const isNew = !r || !r.id || opts.isNew;
  const R = r ? JSON.parse(JSON.stringify(r)) : {
    name: "", category: "Main", servings: 4, ingredients: [], steps: "", prep_min: 15, cook_min: 30,
    fridge_days: 4, freezes: true, max_per_day: 2, tags: [], notes: "", active: true, favorite: false,
  };
  delete R.nutrition;
  for (const k of ["photos", "attachments", "links"]) R[k] = R[k] || [];
  R.description = R.description || ""; R.rating = R.rating || 0;
  const original = r && r.id && !opts.isNew ? r : null;
  const added = [...(opts.addedMedia || [])];     // media created in this editing session (removed again on cancel)
  let dirty = !!opts.dirty;
  const live = h("div", { class: "panel live" });
  const lines = h("div", { class: "ing-lines" });
  const refresh = debounce(async () => {
    const nut = await api("POST", "/api/recipes/preview", R);
    const rows = rowsFor(nut.per_serving);
    live.replaceChildren(
      h("div", { class: "panel-head" }, h("h2", null, "One serving"), h("span", { class: "muted small" }, `${fmt(nut.grams_per_serving)} g`)),
      macroLine(rows), h("div", { style: { margin: "10px 0 6px" } }, fingerprint(rows.map(x => ({ ...x, status: x.pct >= 33 ? "good" : x.pct >= 15 ? "ok" : "low" })), true)),
      nut.amino && nut.amino.has_data ? h("div", { class: "aa-box" }, h("span", { class: "muted small" }, "Protein's amino acids"), aminoBars(nut.amino, { wide: true }), aminoCaption(nut.amino)) : null,
      h("p", { class: "muted small" }, "Bars show the share of her full day's target in one serving; the tick marks 100% of the day."),
      bars(rows, { preview: true, noLegend: true, hideDisabled: true, oneCol: true }),
      ...(nut.problems.length ? [h("div", { class: "banner" }, svg("alert"), nut.problems.join("; "))] : []),
      nut.unlinked ? h("div", { class: "banner" }, svg("alert"), `${nut.unlinked} line${nut.unlinked > 1 ? "s aren't" : " isn't"} linked to the pantry and ${nut.unlinked > 1 ? "aren't" : "isn't"} counted yet.`) : null);
  });
  const touch = () => { dirty = true; };

  /* photos */
  const photoBox = h("div", { class: "photo-strip" });
  const drawPhotos = () => {
    photoBox.replaceChildren(...R.photos.map((p, i) => h("div", { class: "pthumb" },
      mediaImg(p.path, "image/jpeg", { eager: true, fallback: p.thumb }),
      i === 0 ? h("span", { class: "badge" }, "Cover") : h("button", { class: "mini", title: "Make this the cover", "aria-label": "Make this the cover",
        onclick: () => { R.photos.unshift(R.photos.splice(i, 1)[0]); touch(); drawPhotos(); } }, "★"),
      h("button", { class: "mini x", title: "Remove photo", "aria-label": "Remove photo", onclick: () => { R.photos.splice(i, 1); touch(); drawPhotos(); } }, svg("x")))),
      h("label", { class: "padd", title: "Add photos" }, svg("camera"), h("span", null, "Add"),
        h("input", { type: "file", accept: "image/*", multiple: true, class: "hidden", onchange: async e => {
          const files = [...e.target.files]; e.target.value = "";
          for (const f of files) {
            try { const m = await Z.media.addPhoto(f); added.push(m); R.photos.push(m); touch(); drawPhotos(); }
            catch { toast("That photo couldn't be opened. Try a JPEG or PNG.", true); }
          }
        } })));
  };
  drawPhotos();

  /* ingredients */
  const drawLines = () => {
    lines.replaceChildren(h("div", { class: "ing-line head muted small" }, h("span", null, "Ingredient"), h("span", null, "Amount"), h("span", null, "Unit"), h("span", { class: "note" }, "Note"), h("span")));
    R.ingredients.forEach((line, idx) => lines.append(ingLine(line, idx)));
  };
  const ingLine = (line, idx) => {
    const ing = ingById(line.ingredient_id);
    let unitEl;
    if (ing) {
      const units = ["g", "oz", "lb", ...ing.portions.map(p => p.label)];
      if (line.unit && !units.includes(line.unit)) units.push(line.unit);
      unitEl = h("select", { "aria-label": "Unit", onchange: e => { line.unit = e.target.value; touch(); refresh(); } },
        units.map(u => h("option", { value: u, selected: (line.unit || "g") === u }, u)));
    } else unitEl = h("input", { type: "text", value: line.unit || "", "aria-label": "Unit", placeholder: "unit", oninput: e => { line.unit = e.target.value; touch(); } });
    const flag = line._flag && line._flag !== "matched" ? h("span", { class: "conf", title: line._flag === "new" ? "Not in the pantry yet: pick a match or add it" : "Check the amount or unit" },
      line._flag === "new" ? "new" : "check") : line._flag === "matched" ? h("span", { class: "conf good" }, "matched") : null;
    return h("div", { class: "ing-line" + (ing ? "" : " unlinked") + (line._flag === "check" ? " check" : "") },
      h("div", { class: "pick-wrap" + (flag ? " flagged" : "") }, ingPicker(ing, line.name, picked => {
        const [amt, unit] = mapUnit(line.amount, line.unit, picked);
        line.ingredient_id = picked.id; line.amount = amt; line.unit = unit; delete line.name; line._flag = "matched";
        touch(); drawLines(); refresh();
      }), flag),
      h("input", { type: "number", step: "any", min: 0, value: line.amount ?? "", "aria-label": "Amount", oninput: e => { line.amount = e.target.value === "" ? null : +e.target.value; touch(); refresh(); } }),
      unitEl,
      h("input", { type: "text", class: "note", value: line.note || "", placeholder: "diced…", "aria-label": "Note", oninput: e => { line.note = e.target.value; touch(); } }),
      h("button", { class: "icon-btn", "aria-label": "Remove ingredient", onclick: () => { R.ingredients.splice(idx, 1); touch(); drawLines(); refresh(); } }, svg("x")));
  };
  const ingPicker = (current, typed, onPick) => {
    const wrap = h("div", { class: "ing-pick" });
    const input = h("input", { type: "text", value: current ? current.name : (typed || ""), placeholder: "Search pantry…", "aria-label": "Ingredient" });
    const menu = h("div", { class: "menu hidden" });
    const show = () => {
      const q = input.value.toLowerCase().trim();
      const words = tokens(q);
      let hits = S.data.ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || (words.length && words.every(w => tokens(i.name).some(t => t.startsWith(w) || w.startsWith(t)))));
      const guess = typed && !current ? matchIngredient(typed) : null;
      if (guess && !hits.includes(guess)) hits.unshift(guess);
      hits = hits.slice(0, 30);
      menu.replaceChildren(...hits.map(i => h("button", { type: "button", onmousedown: e => { e.preventDefault(); input.value = i.name; menu.classList.add("hidden"); onPick(i); } }, i.name)),
        h("button", { type: "button", class: "new", onmousedown: e => { e.preventDefault(); menu.classList.add("hidden"); openAddIngredient(input.value.trim(), ing => { if (ing) onPick(ing); }); } },
          q ? `+ Add “${input.value}” to pantry` : "+ Add a new ingredient"));
      menu.classList.remove("hidden");
    };
    input.addEventListener("focus", show);
    input.addEventListener("input", show);
    input.addEventListener("blur", () => setTimeout(() => menu.classList.add("hidden"), 150));
    wrap.append(input, menu);
    return wrap;
  };
  drawLines();

  /* links & attachments */
  const linkBox = h("div", { class: "link-edit" });
  const drawLinks = () => linkBox.replaceChildren(...R.links.map((l, i) => h("div", { class: "row nowrap link-line" },
    h("input", { type: "text", value: l.title, placeholder: "Title (optional)", "aria-label": "Link title", oninput: e => { l.title = e.target.value; touch(); } }),
    h("input", { type: "url", value: l.url, placeholder: "https://…", "aria-label": "Link address", inputmode: "url", oninput: e => { l.url = e.target.value.trim(); touch(); } }),
    h("button", { class: "icon-btn", "aria-label": "Remove link", onclick: () => { R.links.splice(i, 1); touch(); drawLinks(); } }, svg("x")))));
  drawLinks();
  const fileBox = h("div");
  const drawFiles = () => fileBox.replaceChildren(...R.attachments.map((a, i) => h("div", { class: "filerow" },
    svg(/^image\//.test(a.type) ? "image" : "file"),
    h("button", { class: "linklike grow", onclick: () => openAttachment(a) }, a.name, h("span", { class: "muted" }, ` · ${fmtSize(a.size || 0)}`)),
    h("button", { class: "icon-btn", "aria-label": "Remove attachment", onclick: () => { R.attachments.splice(i, 1); touch(); drawFiles(); } }, svg("x")))));
  drawFiles();

  const fld = (label, el) => h("label", { class: "field" }, h("span", null, label), el);
  const bind = (key, type = "text", extra = {}) => h(type === "textarea" ? "textarea" : "input", {
    type: type === "textarea" ? null : type, value: R[key] ?? "", ...extra,
    oninput: e => { R[key] = type === "number" ? +e.target.value : e.target.value; touch(); if (key === "servings") refresh(); } });
  const ratingBox = h("div");
  const drawRating = () => ratingBox.replaceChildren(stars(R.rating, { big: true, onRate: v => { R.rating = v; touch(); drawRating(); } }));
  drawRating();

  const form = h("div", null,
    opts.banner || null,
    h("div", { class: "panel" },
      h("div", { class: "panel-head", style: { marginBottom: "8px" } }, h("h2", null, "Photos"), h("span", { class: "muted small" }, "The first one is the cover")),
      photoBox),
    h("div", { class: "panel" },
      fld("Name", bind("name", "text", { placeholder: "e.g. Smoky lentil stew" })),
      h("div", { class: "field", style: { marginTop: "12px" } }, h("span", null, "Rating"), ratingBox),
      h("div", { style: { marginTop: "12px" } }, fld("Description", bind("description", "textarea", { rows: 3, placeholder: "What it is, where it's from, why you love it…", class: "short" }))),
      h("div", { class: "grid4", style: { marginTop: "12px" } },
        fld("Category", h("select", { onchange: e => { R.category = e.target.value; touch(); } }, CATS.map(c => h("option", { selected: R.category === c }, c)))),
        fld("Servings (batch)", bind("servings", "number", { min: 0.5, step: 0.5 })),
        fld("Prep (min)", bind("prep_min", "number", { min: 0 })),
        fld("Cook (min)", bind("cook_min", "number", { min: 0 }))),
      h("div", { class: "grid4", style: { marginTop: "12px" } },
        fld("Fridge life (days)", bind("fridge_days", "number", { min: 0, max: 30 })),
        fld("Max servings/day", bind("max_per_day", "number", { min: 0.5, step: 0.5 })),
        h("label", { class: "check", style: { alignSelf: "end", paddingBottom: "8px" } },
          h("input", { type: "checkbox", checked: R.freezes, onchange: e => { R.freezes = e.target.checked; touch(); } }), "Freezes well"),
        h("label", { class: "check", style: { alignSelf: "end", paddingBottom: "8px" } },
          h("input", { type: "checkbox", checked: R.active, onchange: e => { R.active = e.target.checked; touch(); } }), "Use in plans"))),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", null, "Ingredients"),
        h("div", { class: "row" },
          h("button", { class: "btn sm", onclick: () => openScanLabel(ing => {
            if (!ing) return;
            const serving = ing.portions.find(p => /label serving|serving/i.test(p.label)) || ing.portions[0];
            R.ingredients.push({ ingredient_id: ing.id, amount: 1, unit: serving ? serving.label : "g", note: "" });
            touch(); drawLines(); refresh();
          }) }, svg("scan"), "Scan label"),
          h("button", { class: "btn sm", onclick: () => { R.ingredients.push({ ingredient_id: null, amount: 100, unit: "g", note: "" }); drawLines(); lines.querySelector(".ing-line:last-child input").focus(); } }, svg("plus"), "Add ingredient"))),
      lines,
      h("p", { class: "muted small", style: { marginTop: "10px" } }, "Units come from each ingredient's portion sizes (edit them on the Pantry page). Grams are always most accurate.")),
    h("div", { class: "panel" },
      fld("Steps", bind("steps", "textarea", { placeholder: "1. …\n2. …", rows: 8 })),
      h("div", { style: { marginTop: "12px" } }, fld("Notes", bind("notes", "textarea", { rows: 3, class: "short", placeholder: "Tips, swaps, what to change next time…" }))),
      h("div", { style: { marginTop: "12px" } }, fld("Tags (comma separated)", h("input", { type: "text", value: (R.tags || []).join(", "), oninput: e => { R.tags = e.target.value.split(",").map(s => s.trim()).filter(Boolean); touch(); } })))),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", null, "Links"),
        h("button", { class: "btn sm", onclick: () => { R.links.push({ title: "", url: "" }); drawLinks(); linkBox.querySelector(".link-line:last-child input").focus(); } }, svg("link"), "Add link")),
      linkBox),
    h("div", { class: "panel" },
      h("div", { class: "panel-head" }, h("h2", null, "Attachments"),
        h("label", { class: "btn sm" }, svg("file"), "Attach file", h("input", { type: "file", class: "hidden", multiple: true, onchange: async e => {
          const files = [...e.target.files]; e.target.value = "";
          for (const f of files) {
            try { const m = await Z.media.addAttachment(f); added.push(m); R.attachments.push(m); touch(); drawFiles(); }
            catch (err) { toast(err.message, true); }
          }
        } }))),
      fileBox,
      h("p", { class: "muted small" }, "PDFs, photos, documents… up to 10 MB each. They're stored in your private data repo.")));

  const cleanupAdded = () => { for (const m of added) if (!R.photos.includes(m) && !R.attachments.includes(m)) Z.media.remove(m); };
  const close = (force) => {
    if (!force && dirty && !confirm("Discard your changes?")) return false;
    if (!force) for (const m of added) Z.media.remove(m);
    scrim.remove(); document.removeEventListener("keydown", esc);
    return true;
  };
  const save = async () => {
    if (!R.name.trim()) { toast("Give the recipe a name", true); return; }
    const links = R.links.filter(l => l.url);
    if (links.some(l => !/^https?:\/\//i.test(l.url))) { toast("Links need to start with https://", true); return; }
    R.links = links;
    R.ingredients = R.ingredients.filter(l => l.ingredient_id || String(l.name || "").trim());
    if (isNew && !R.created) R.created = new Date().toISOString();
    try {
      const saved = await api(R.id && !opts.isNew ? "PUT" : "POST", R.id && !opts.isNew ? `/api/recipes/${R.id}` : "/api/recipes", R);
      cleanupAdded();
      if (original) for (const m of [...(original.photos || []), ...(original.attachments || [])])
        if (!R.photos.some(x => x.path === m.path) && !R.attachments.some(x => x.path === m.path)) Z.media.remove(m);
      await reload(); close(true); toast(isNew ? "Recipe added" : "Recipe saved");
      if (location.hash !== "#recipe/" + encodeURIComponent(saved.id)) location.hash = "#recipe/" + encodeURIComponent(saved.id); else render();
    } catch (e) { toast(e.message, true); }
  };
  const scrim = h("div", { class: "scrim", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Recipe editor" },
      h("div", { class: "drawer-head" },
        h("button", { class: "btn ghost", onclick: () => close() }, "Cancel"),
        h("h2", null, opts.title || (isNew ? "New recipe" : "Edit recipe")),
        h("button", { class: "btn primary", onclick: save }, opts.saveLabel || "Save")),
      h("div", { class: "drawer-body" }, h("div", { class: "editor" }, form, live)),
      original ? h("div", { class: "drawer-foot" },
        h("button", { class: "btn danger", onclick: async () => {
          if (!confirm(`Delete “${original.name}”? Its photos and attachments are deleted too.`)) return;
          await api("DELETE", `/api/recipes/${original.id}`); await reload(); close(true); toast("Recipe deleted");
          location.hash = "#recipes";
        } }, svg("trash"), "Delete recipe"),
        h("button", { class: "btn primary", onclick: save }, "Save")) : null));
  function esc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", esc);
  document.body.append(scrim);
  refresh();
}

/* ================================================================
   SCANNING
   ================================================================ */
async function fileToDataUrl(file) {
  const blob = await Z.media.scanImage(file);
  return "data:image/jpeg;base64," + await Z.media.blobToB64(blob);
}
/** shared photo picker modal: returns {files} via onGo */
function scanPicker({ title, intro, multi, goLabel, onGo }) {
  const files = [];
  const body = h("div", { class: "drawer-body scan-body" });
  const close = () => scrim.remove();
  const thumbs = h("div", { class: "photo-strip" });
  const goBtn = h("button", { class: "btn primary", disabled: true, onclick: () => onGo(files, { body, close, scrim }) }, svg("sparkle"), goLabel);
  const drawThumbs = () => {
    thumbs.replaceChildren(...files.map((f, i) => {
      const u = URL.createObjectURL(f);
      return h("div", { class: "pthumb" }, h("img", { src: u, alt: `Photo ${i + 1}`, onload: () => setTimeout(() => URL.revokeObjectURL(u), 1000) }),
        h("button", { class: "mini x", "aria-label": "Remove photo", onclick: () => { files.splice(i, 1); drawThumbs(); } }, svg("x")));
    }));
    goBtn.disabled = !files.length;
    pickRow.querySelectorAll("label").forEach(l => l.classList.toggle("hidden", !multi && files.length >= 1 || files.length >= 4));
  };
  const add = e => { files.push(...[...e.target.files].slice(0, 4 - files.length)); e.target.value = ""; drawThumbs(); };
  const pickRow = h("div", { class: "row scan-pick" },
    h("label", { class: "btn primary" }, svg("camera"), "Take a photo", h("input", { type: "file", accept: "image/*", capture: "environment", class: "hidden", onchange: add })),
    h("label", { class: "btn" }, svg("image"), multi ? "Choose photos" : "Choose a photo", h("input", { type: "file", accept: "image/*", multiple: !!multi, class: "hidden", onchange: add })));
  body.append(h("p", { class: "muted" }, intro), pickRow, thumbs,
    h("ul", { class: "muted small tips" }, h("li", null, "Lay the page flat, in good light, and fill the frame."),
      h("li", null, "You'll check everything before it's saved.")));
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "drawer-head" }, h("h2", null, title), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      body, h("div", { class: "drawer-foot" }, h("button", { class: "btn", onclick: close }, "Cancel"), goBtn)));
  document.body.append(scrim);
  return { close };
}
function readingScreen(body, what) {
  const fp = h("div", { class: "fp lg" });
  for (let i = 0; i < 26; i++) fp.append(h("i", { style: { animationDelay: (i * 0.05) + "s" } }));
  body.replaceChildren(h("div", { class: "loading" }, fp, h("h2", { style: { color: "var(--ink)" } }, `Reading your ${what}…`),
    h("p", { class: "muted", style: { maxWidth: "36ch", textAlign: "center" } }, what === "recipe"
      ? "Finding the title, ingredients, amounts and steps. This takes 10–30 seconds."
      : "Copying the values from the Nutrition Facts panel. This takes about 10 seconds.")));
  const foot = body.parentElement.querySelector(".drawer-foot");
  if (foot) foot.querySelectorAll("button.primary").forEach(b => { b.disabled = true; });
}

function openScanRecipe() {
  scanPicker({
    title: "Scan a recipe", multi: true, goLabel: "Read recipe",
    intro: "Take a photo of a cookbook page, recipe card or screenshot. If the recipe continues on another page, add that photo too (up to 4).",
    onGo: async (files, ui) => {
      readingScreen(ui.body, "recipe");
      try {
        const images = [];
        for (const f of files) images.push(await fileToDataUrl(f));
        const res = await api("POST", "/api/scan", { kind: "recipe", images });
        const attached = [];
        for (let i = 0; i < files.length; i++) {
          try { attached.push(await Z.media.addAttachment(files[i], `Scanned page${files.length > 1 ? " " + (i + 1) : ""}.jpg`)); } catch { /* keep going */ }
        }
        ui.close();
        const draft = draftFromScan(res.result || {});
        draft.attachments = attached;
        const flagged = draft.ingredients.filter(l => l._flag !== "matched").length;
        const notVegan = Z.cookbook ? Z.cookbook.veganFlags([draft.name, ...((res.result || {}).ingredients || []).map(i => i.text || i.name || "")]) : [];
        openRecipe(draft, { isNew: true, dirty: true, addedMedia: attached, title: "Draft recipe", saveLabel: "Save recipe",
          banner: h("div", { class: "banner scan-banner" }, svg("sparkle"), h("div", { class: "small" },
            h("b", null, flagged ? `Check the ${flagged} highlighted ingredient${flagged > 1 ? "s" : ""}. ` : "Everything matched your pantry. "),
            "Read by AI, so give the amounts and steps a quick look. The original photo is attached to the recipe.",
            notVegan.length ? h("div", { style: { marginTop: "6px", color: "var(--tomato)" } }, h("b", null, "This may not be vegan: "), notVegan.join(", "), ". Swap those before saving.") : null)) });
      } catch (e) {
        ui.close();
        toast(e.message, true);
      }
    },
  });
}
function draftFromScan(x) {
  const num = v => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));
  const cat = CATS.find(c => c.toLowerCase() === String(x.category || "").toLowerCase()) || "Main";
  const ingredients = (x.ingredients || []).filter(l => l && (l.name || l.text)).map(l => {
    const name = String(l.name || l.text).trim();
    const ing = matchIngredient(name);
    const note = [l.note].filter(Boolean).join("; ");
    if (!ing) return { ingredient_id: null, name, amount: num(l.amount), unit: normUnit(l.unit) || "", note, _flag: NO_NUTRITION.test(name.trim()) ? "matched" : "new",
      ...(NO_NUTRITION.test(name.trim()) ? { ignore: true } : {}) };
    const [amount, unit, ok] = mapUnit(num(l.amount), l.unit, ing);
    const was = !ok && (l.amount != null || l.unit) ? ` (recipe says: ${[l.amount, l.unit].filter(x => x != null && x !== "").join(" ")})` : "";
    return { ingredient_id: ing.id, amount, unit, note: note + was, _flag: ok && !l.unclear ? "matched" : "check" };
  });
  const steps = (x.steps || []).map(s => String(s).trim()).filter(Boolean);
  return {
    name: String(x.name || "").trim() || "Scanned recipe", category: cat, servings: num(x.servings) || 4,
    prep_min: num(x.prep_min) ?? 15, cook_min: num(x.cook_min) ?? 30, description: String(x.description || "").trim(),
    ingredients, steps: steps.map((s, i) => `${i + 1}. ${s}`).join("\n"), notes: String(x.notes || "").trim(),
    fridge_days: 4, freezes: true, max_per_day: 2, tags: [], active: true, favorite: false, rating: 0, links: [], photos: [],
  };
}

/* nutrition labels: amount + unit, or % Daily Value, into our nutrient keys and units */
const LABEL_MAP = { calories: "kcal", total_fat: "fat", saturated_fat: "satfat", sodium: "sodium", total_carbohydrate: "carbs", dietary_fiber: "fiber",
  protein: "protein", vitamin_d: "vit_d", calcium: "calcium", iron: "iron", potassium: "potassium", vitamin_a: "vit_a", vitamin_c: "vit_c",
  vitamin_e: "vit_e", vitamin_k: "vit_k", thiamin: "thiamin", riboflavin: "riboflavin", niacin: "niacin", vitamin_b6: "b6", folate: "folate",
  vitamin_b12: "b12", pantothenic_acid: "pantothenic", choline: "choline", phosphorus: "phosphorus", iodine: "iodine", magnesium: "magnesium",
  zinc: "zinc", selenium: "selenium", copper: "copper", manganese: "manganese", omega_3_ala: "ala" };
// FDA Daily Values for adults (2016 rule), in our units
const DV = { fat: 78, satfat: 20, sodium: 2300, carbs: 275, fiber: 28, protein: 50, vit_d: 20, calcium: 1300, iron: 18, potassium: 4700, vit_a: 900,
  vit_c: 90, vit_e: 15, vit_k: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16, b6: 1.7, folate: 400, b12: 2.4, pantothenic: 5, choline: 550,
  phosphorus: 1250, iodine: 150, magnesium: 420, zinc: 11, selenium: 55, copper: 900, manganese: 2.3 };
const IU = { vit_d: 1 / 40, vit_a: 0.3, vit_e: 0.45 };   // µg per IU (D, A as retinol), mg per IU (E, synthetic)
function labelNutrients(result) {
  const out = {}, fromDv = [];
  const toMg = { g: 1000, mg: 1, mcg: 0.001, "µg": 0.001, ug: 0.001 };
  for (const [lk, v] of Object.entries(result.nutrients || {})) {
    const key = LABEL_MAP[lk];
    const meta = key && nutMeta(key);
    if (!meta || !v) continue;
    const base = meta.unit.split(" ")[0].replace("µg", "mcg");
    let val = null;
    const unit = String(v.unit || "").toLowerCase().replace("µg", "mcg");
    if (v.amount != null && isFinite(Number(v.amount))) {
      const a = Number(v.amount);
      if (key === "kcal") val = a;
      else if (unit === "iu" && IU[key] != null) val = a * IU[key];
      else if (toMg[unit] && toMg[base]) val = a * toMg[unit] / toMg[base];
      else if (!unit) val = a;
    } else if (v.dv != null && DV[key] != null && isFinite(Number(v.dv))) {
      val = DV[key] * Number(v.dv) / 100; fromDv.push(meta.name);
    }
    if (val != null && isFinite(val)) out[key] = Math.round(val * 1000) / 1000;
  }
  return { perServing: out, fromDv };
}
function openScanLabel(onDone) {
  scanPicker({
    title: "Scan a nutrition label", multi: false, goLabel: "Read label",
    intro: "Take a photo of the Nutrition Facts panel. Get the whole panel in, including the serving size.",
    onGo: async (files, ui) => {
      readingScreen(ui.body, "label");
      try {
        const res = await api("POST", "/api/scan", { kind: "label", images: [await fileToDataUrl(files[0])] });
        ui.close();
        openLabelReview(res.result || {}, onDone);
      } catch (e) { ui.close(); toast(e.message, true); }
    },
  });
}
function labelIngredient(result) {
  const { perServing, fromDv } = labelNutrients(result);
  let grams = Number(result.serving_grams) || null, assumed = false;
  if (!grams && Number(result.serving_ml)) { grams = Number(result.serving_ml); assumed = true; }
  const basis = grams || 100;
  const nutrients = {};
  for (const [k, v] of Object.entries(perServing)) nutrients[k] = v * 100 / basis;
  const serving = String(result.serving_text || "").trim();
  return {
    I: { name: String(result.product || "").trim(), source: "label", nutrients, aisle: "Other", verify: false,
      portions: grams ? [{ label: serving ? `${serving.replace(/\s*\(.*\)\s*$/, "")} (label serving)` : "label serving", grams }] : [] },
    basis, fromDv, assumed, noGrams: !grams, count: Object.keys(perServing).length,
  };
}
function openLabelReview(result, onDone) {
  const L = labelIngredient(result);
  const close = () => scrim.remove();
  const notes = h("div", null,
    h("div", { class: "banner scan-banner" }, svg("sparkle"), h("div", { class: "small" },
      h("b", null, `${L.count} value${L.count === 1 ? "" : "s"} read. `), "Compare them with the label, add a name, then save. Anything not on the label stays blank (unknown), not zero.")),
    L.assumed ? h("div", { class: "banner" }, svg("info"), h("div", { class: "small" }, "The label gives the serving in mL only, so 1 mL is counted as 1 g (right for drinks like soy milk). Change “Values per” if that's off.")) : null,
    L.noGrams ? h("div", { class: "banner" }, svg("alert"), h("div", { class: "small" }, "No serving weight was found. Type the grams per serving into “Values per” before saving.")) : null,
    L.fromDv.length ? h("div", { class: "banner" }, svg("info"), h("div", { class: "small" }, `Worked out from % Daily Value (approximate): ${L.fromDv.join(", ")}.`)) : null);
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Check the label" },
      h("div", { class: "drawer-head" }, h("h2", null, "Check the label"), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      h("div", { class: "drawer-body" }, notes, ingredientForm(L.I, ing => { close(); if (onDone) onDone(ing); }, { labelMode: true, basis: L.basis }))));
  document.body.append(scrim);
}

/* ---------------- recipe picker: the cookbook in a pop-up, for adding a dish somewhere ---------------- */
function pickRecipe({ title, onPick, exclude = [], onlyActive = false }) {
  recipeFilterState();   // loads the remembered view
  const st = { q: "", cat: "All", sort: "rating", reverse: false };
  const close = () => { scrim.remove(); document.removeEventListener("keydown", esc); };
  const body = h("div", { class: "drawer-body" });
  const seg = h("div", { class: "seg cats" });
  const viewBox = h("span", { class: "picker-view" });
  const pick = r => { close(); onPick(r); };
  const draw = () => {
    seg.replaceChildren(...["All", ...CATS].map(c => h("button", { class: st.cat === c ? "on" : "", onclick: () => { st.cat = c; draw(); } }, c)));
    viewBox.replaceChildren(viewSwitch(draw));
    const q = st.q.toLowerCase().trim();
    const list = sortRecipes(S.data.recipes.filter(r => r.ingredients.length && (!onlyActive || r.active) && !exclude.includes(r.id) &&
      (st.cat === "All" || r.category === st.cat) && (!q || r.name.toLowerCase().includes(q) || (r.tags || []).join(" ").toLowerCase().includes(q))), st);
    const top = body.scrollTop;
    if (!list.length) body.replaceChildren(h("p", { class: "muted" }, "No recipes match."));
    else if (S.recipeView === "advanced") body.replaceChildren(advHead(draw), h("div", { class: "cards adv picker-cards" }, list.map(r => advancedCard(r, pick))));
    else if (S.recipeView === "list") body.replaceChildren(listTable(list, { onOpen: pick, f: st, redraw: draw }));
    else body.replaceChildren(h("div", { class: "cards picker-cards" }, list.map(r => simpleCard(r, pick))));
    body.scrollTop = top;
  };
  const search = h("input", { type: "search", placeholder: "Search recipes", "aria-label": "Search recipes", class: "rsearch",
    oninput: debounce(e => { st.q = e.target.value; draw(); }, 150) });
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim) close(); } },
    h("div", { class: "modal wide", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "drawer-head" }, h("h2", null, title), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      h("div", { class: "picker-tools" }, search, seg, viewBox),
      body));
  function esc(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", esc);
  document.body.append(scrim);
  draw();
  if (matchMedia("(hover: hover)").matches) search.focus();
}
