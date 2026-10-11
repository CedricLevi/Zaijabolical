/* Zaijabolical API layer: the same calls the interface used to make to a server,
   answered right here in the browser. */
(function (Z) {
  "use strict";
  const store = () => Z.store;
  const doc = () => Z.store.S.doc;
  const clone = o => JSON.parse(JSON.stringify(o));

  class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }

  // ---------------- heavy computations run in a Web Worker when possible ----------------
  let worker = null, workerFailed = false, seq = 0;
  const pending = new Map();
  function getWorker() {
    if (worker || workerFailed || typeof Worker === "undefined") return worker;
    try {
      worker = new Worker("js/worker.js");
      worker.onmessage = e => {
        const p = pending.get(e.data.id); if (!p) return;
        pending.delete(e.data.id);
        e.data.error ? p.reject(new ApiError(e.data.error)) : p.resolve(e.data.result);
      };
      worker.onerror = () => { workerFailed = true; worker = null; for (const p of pending.values()) p.fallback(); pending.clear(); };
    } catch { workerFailed = true; worker = null; }
    return worker;
  }
  function compute(fn, args) {
    const w = getWorker();
    const local = () => Promise.resolve().then(() => Z[fn](...args));
    if (!w) return local();
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, fallback: () => local().then(resolve, reject) });
      w.postMessage({ id, fn, args });
    });
  }

  // ---------------- helpers ----------------
  function ingMap() { return Object.fromEntries(doc().ingredients.map(i => [i.id, i])); }
  function recipeMap() { return Object.fromEntries(doc().recipes.map(r => [r.id, r])); }
  function recipeOut(r, ingById) {
    const nut = Z.recipeNutrition(r, ingById);
    return { ...clone(r), nutrition: { per_serving: nut.per_serving, missing: nut.missing,
      grams_per_serving: nut.grams_per_serving, problems: nut.problems } };
  }
  const activeRecipes = () => doc().recipes.filter(r => r.active !== false && (r.ingredients || []).length);
  const seededKeys = () => Object.fromEntries(doc().ingredients.filter(i => i.seed_key).map(i => [i.seed_key, i]));
  const settings = () => doc().settings;

  // compact weeks are what gets stored; full weeks (with numbers) are rebuilt on load
  function compactWeek(w) {
    return { days: w.days.map(d => ({ day: d.day, offset: d.offset, items: d.items.map(i => ({ recipe_id: i.recipe_id, servings: i.servings })) })),
      prep_set: w.prep_set || null, n_dishes: w.n_dishes ?? null };
  }
  function expandWeek(c) {
    const s = settings(), ing = ingMap(), rec = recipeMap();
    const res = Z.rescoreWeek(c.days, rec, ing, s.targets, s.supplements);
    if (!res.days.length) return null;
    return Object.assign(res, { prep_set: c.prep_set, n_dishes: c.n_dishes,
      advice: Z.recommendations(res.average), prep: Z.buildPrep(res.days, rec, ing) });
  }

  // ---------------- USDA ----------------
  const USDA = "https://api.nal.usda.gov/fdc/v1";
  async function usdaFetch(path, payload) {
    const key = settings().usda_api_key;
    if (!key) throw new ApiError("Add your free USDA API key first (Pantry or Settings).");
    const q = `${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key)}`;
    const init = payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {};
    let res;
    try { res = await fetch(USDA + q, init); }
    catch {   // browser blocked the direct call: go through the site's own USDA relay instead
      try { res = await fetch("usda" + q, init); }
      catch { throw new ApiError("Couldn't reach USDA. Check your internet connection."); }
    }
    if (res.status === 401 || res.status === 403) throw new ApiError("USDA rejected the API key. Double-check it in Settings.");
    if (res.status === 429) throw new ApiError("USDA rate limit reached. Wait a bit and try again (a personal key allows 1,000 lookups an hour).");
    if (res.status === 404) throw new ApiError("That food wasn't found in USDA.");
    if (!res.ok) throw new ApiError(`USDA request failed (${res.status}).`);
    return res.json();
  }
  async function usdaSearch(query, types, pageSize = 15) {
    const res = await usdaFetch("/foods/search", { query, dataType: types || ["Foundation", "SR Legacy"], pageSize });
    return (res.foods || []).map(f => {
      const nut = Z.parseUsdaNutrients(f.foodNutrients);
      return { fdc_id: f.fdcId, description: f.description || "", brand: f.brandName || f.brandOwner || null,
        data_type: f.dataType, nutrients: nut, n_nutrients: Object.keys(nut).length };
    });
  }
  function portionLabel(p) {
    let unit = ((p.measureUnit || {}).name || "").trim();
    if (["undetermined", "unknown"].includes(unit.toLowerCase())) unit = "";
    const amount = p.amount ?? p.value, modifier = String(p.modifier || "").trim(), desc = String(p.portionDescription || "").trim();
    if (desc && desc.toLowerCase() !== "quantity not specified") return desc;
    const parts = [];
    if (amount != null && amount !== "" && Number(amount) !== 1) parts.push(String(amount));
    if (unit) parts.push(unit);
    if (modifier && !/^\d+$/.test(modifier)) parts.push(modifier);
    return parts.join(" ").trim() || null;
  }
  async function usdaFood(id) {
    const f = await usdaFetch(`/food/${Number(id)}`);
    const portions = [];
    for (const p of f.foodPortions || []) { const label = portionLabel(p); if (p.gramWeight && label) portions.push({ label, grams: Math.round(p.gramWeight * 100) / 100 }); }
    if (f.servingSize && ["g", "grm"].includes(String(f.servingSizeUnit || "").toLowerCase()))
      portions.push({ label: `${f.householdServingFullText || "serving"} (label serving)`, grams: Number(f.servingSize) });
    const seen = new Set();
    return { fdc_id: f.fdcId, description: f.description || "", brand: f.brandName || f.brandOwner || null, data_type: f.dataType,
      nutrients: Z.parseUsdaNutrients(f.foodNutrients),
      portions: portions.filter(p => !seen.has(p.label.toLowerCase()) && seen.add(p.label.toLowerCase())).slice(0, 12) };
  }

  // ---------------- starter import ----------------
  const pantryByKey = () => Object.fromEntries(Z.STARTER_PANTRY.map(p => [p.key, p]));
  function fits(desc, item) {
    const d = desc.toLowerCase();
    return item.must.every(m => d.includes(m.toLowerCase())) && !item.avoid.some(a => d.includes(a.toLowerCase()));
  }
  async function seedMatch(key) {
    const item = pantryByKey()[key];
    let candidates = [], chosen = null;
    for (const t of item.types) {
      const results = await usdaSearch(item.query, [t], 12);
      results.forEach(r => { r.fits = fits(r.description, item); candidates.push(r); });
      const good = results.filter(r => r.fits);
      if (good.length && !chosen) { chosen = good.slice(0, 5).reduce((a, b) => (b.n_nutrients > a.n_nutrients ? b : a)); break; }
    }
    const confident = !!chosen;
    if (!chosen && candidates.length) chosen = candidates[0];
    return { key, name: item.name, aisle: item.aisle, verify: item.verify, chosen, confident,
      alternatives: candidates.filter(c => !chosen || c.fdc_id !== chosen.fdc_id).slice(0, 6) };
  }
  function seedCommit(selections) {
    const have = seededKeys(), P = pantryByKey();
    for (const s of selections) {
      const item = P[s.key];
      if (!item || !s.fdc_id) continue;
      store().upsert("ingredients", {
        id: have[item.key] ? have[item.key].id : undefined,
        name: item.name, source: "usda", fdc_id: s.fdc_id, usda_description: s.description, data_type: s.data_type,
        nutrients: s.nutrients || {}, portions: item.portions, verify: item.verify || s.data_type === "Branded",
        aisle: item.aisle, seed_key: item.key,
      });
    }
    return installRecipes();
  }
  function installRecipes() {
    const ing = seededKeys();
    const existing = new Set(doc().recipes.filter(r => r.seed_key).map(r => r.seed_key));
    const added = [], skipped = [];
    for (const r of Z.STARTER_RECIPES) {
      if (existing.has(r.seed_key)) continue;
      const missing = r.ingredients.filter(i => !ing[i.key]).map(i => i.key);
      if (missing.length) { skipped.push({ name: r.name, missing }); continue; }
      const rec = clone(r);
      rec.ingredients = r.ingredients.map(i => ({ ingredient_id: ing[i.key].id, amount: i.amount, unit: i.unit, note: i.note || "" }));
      rec.active = true; rec.favorite = false;
      store().upsert("recipes", rec);
      added.push(r.name);
    }
    return { added, skipped };
  }

  // ---------------- validation ----------------
  function cleanRecipe(d) {
    if (!String(d.name || "").trim()) throw new ApiError("Give the recipe a name");
    const r = clone(d); delete r.nutrition;
    r.name = r.name.trim();
    r.servings = Number(r.servings) || 1;
    for (const k of ["prep_min", "cook_min"]) r[k] = Math.max(0, Math.round(Number(r[k]) || 0));
    r.fridge_days = r.fridge_days == null ? 4 : Math.max(0, Math.round(Number(r.fridge_days) || 0));
    r.max_per_day = Number(r.max_per_day) || 2;
    r.freezes = r.freezes !== false; r.active = r.active !== false; r.favorite = !!r.favorite;
    r.tags = r.tags || []; r.notes = r.notes || ""; r.steps = r.steps || ""; r.category = r.category || "Main";
    r.ingredients = (r.ingredients || []).filter(l => l.ingredient_id);
    return r;
  }
  function cleanIngredient(d) {
    if (!String(d.name || "").trim()) throw new ApiError("Name is required");
    const i = clone(d); i.name = i.name.trim(); i.nutrients = i.nutrients || {}; i.portions = i.portions || [];
    i.aisle = i.aisle || "Other"; i.source = i.source || "manual"; i.verify = !!i.verify;
    return i;
  }

  // ---------------- routes ----------------
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/?]+)") + "(?:\\?(?<qs>.*))?$"), fn });

  route("GET", "/api/bootstrap", () => {
    const ing = ingMap();
    return {
      settings: clone(settings()), nutrients: Z.nutrientMeta(), groups: Z.GROUPS,
      ingredients: clone(doc().ingredients).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
      recipes: doc().recipes.map(r => recipeOut(r, ing)).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
      plans: doc().plans.map(p => ({ id: p.id, name: p.name, created: p.created })).sort((a, b) => String(b.created).localeCompare(String(a.created))),
      starter_count: Z.STARTER_PANTRY.length, seeded: Object.keys(seededKeys()).length,
    };
  });
  route("PUT", "/api/settings/:key", (p, body) => {
    if (!(p.key in Z.DEFAULT_SETTINGS) && p.key !== "current_week") throw new ApiError("Unknown setting");
    store().setSetting(p.key, clone(body.value));
    return { ok: true, value: clone(settings()[p.key]) };
  });
  route("POST", "/api/settings/reset_targets", () => { store().setSetting("targets", Z.defaultTargets()); return { value: clone(settings().targets) }; });

  route("POST", "/api/ingredients", (p, body) => clone(store().upsert("ingredients", cleanIngredient(body))));
  route("PUT", "/api/ingredients/:id", (p, body) => clone(store().upsert("ingredients", cleanIngredient({ ...body, id: p.id }))));
  route("DELETE", "/api/ingredients/:id", p => {
    const used = doc().recipes.filter(r => (r.ingredients || []).some(l => l.ingredient_id === p.id)).map(r => r.name);
    if (used.length) throw new ApiError(`Used in: ${used.join(", ")}. Remove it from those recipes first.`, 409);
    store().remove("ingredients", p.id); return { ok: true };
  });
  route("GET", "/api/usda/search", (p, b, qs) => {
    const q = (qs.get("q") || "").trim();
    if (!q) return [];
    const types = qs.get("types") ? qs.get("types").split(",").filter(Boolean) : null;
    return usdaSearch(q, types, 20);
  });
  route("GET", "/api/usda/food/:id", p => usdaFood(p.id));

  route("POST", "/api/recipes", (p, body) => recipeOut(store().upsert("recipes", cleanRecipe(body)), ingMap()));
  route("PUT", "/api/recipes/:id", (p, body) => recipeOut(store().upsert("recipes", cleanRecipe({ ...body, id: p.id })), ingMap()));
  route("DELETE", "/api/recipes/:id", p => { store().remove("recipes", p.id); return { ok: true }; });
  route("POST", "/api/recipes/preview", (p, body) => recipeOut(body, ingMap()).nutrition);

  route("POST", "/api/evaluate", (p, body) => {
    const s = settings(), ing = ingMap(), rec = recipeMap(), trip = [];
    for (const it of body.items || []) {
      const r = rec[it.recipe_id], sv = Number(it.servings) || 0;
      if (!r || sv <= 0) continue;
      const nut = Z.recipeNutrition(r, ing); trip.push([nut.per_serving, nut.missing, sv]);
    }
    const [food, missing] = Z.combine(trip);
    const rows = Z.evaluate(food, Z.supplementTotals(s.supplements), s.targets, missing);
    return { rows, score: Z.score(rows), advice: Z.recommendations(rows) };
  });
  route("POST", "/api/optimize/days", async (p, body) => {
    const s = settings(), wk = s.week;
    const res = await compute("bestDays", [activeRecipes(), ingMap(), s.targets, s.supplements, s.structure,
      { n: Number(body.n) || 5, min_distinct: wk.min_distinct, max_distinct: wk.max_distinct, min_new: Number(body.min_new) || 1,
        require: body.require || [], exclude: body.exclude || [] }]);
    for (const c of res.combos) c.advice = Z.recommendations(c.rows);
    return res;
  });
  route("POST", "/api/optimize/week", async (p, body) => {
    const s = settings();
    const res = await compute("planWeek", [activeRecipes(), ingMap(), s.targets, s.supplements, s.structure, s.week,
      { require: body.require || [], exclude: body.exclude || [] }]);
    const rec = recipeMap(), ing = ingMap();
    for (const o of res.options || []) { o.advice = Z.recommendations(o.average); o.prep = Z.buildPrep(o.days, rec, ing); }
    return res;
  });
  route("POST", "/api/week/rescore", (p, body) => {
    const exp = expandWeek(compactWeek({ days: body.days || [], prep_set: body.prep_set, n_dishes: body.n_dishes }));
    return exp || { days: [] };
  });

  // week state shared between devices (stored compactly, expanded on read)
  route("PUT", "/api/week/current", (p, body) => {
    const v = body.value;
    store().setDocField("current_week", v && v.data ? { name: v.name || null, choice: v.choice ?? null, week: compactWeek(v.data) } : null);
    return { ok: true };
  });
  route("GET", "/api/week/current", () => {
    const cw = doc().current_week;
    if (!cw || !cw.week) return null;
    const data = expandWeek(cw.week);
    return data ? { name: cw.name, choice: cw.choice, data } : null;
  });
  route("PUT", "/api/week/options", (p, body) => {
    const v = body.value;
    store().setDocField("week_options", v && v.options ? { options: v.options.map(compactWeek), recommended: v.recommended, anchors: v.anchors || [] } : null);
    return { ok: true };
  });
  route("GET", "/api/week/options", () => {
    const wo = doc().week_options;
    if (!wo || !wo.options) return null;
    const options = wo.options.map(expandWeek).filter(Boolean);
    return options.length === wo.options.length ? { options, recommended: wo.recommended, anchors: wo.anchors } : null;
  });

  route("GET", "/api/plans/:id", p => {
    const pl = doc().plans.find(x => x.id === p.id);
    if (!pl) throw new ApiError("Not found", 404);
    return { id: pl.id, name: pl.name, created: pl.created, data: expandWeek(pl.week) };
  });
  route("POST", "/api/plans", (p, body) => {
    const pl = store().upsert("plans", { name: body.name || `Week of ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      created: new Date().toISOString(), week: compactWeek(body.data) });
    return { id: pl.id, plans: routesGetPlans() };
  });
  route("DELETE", "/api/plans/:id", p => { store().remove("plans", p.id); return { plans: routesGetPlans() }; });
  function routesGetPlans() { return doc().plans.map(p => ({ id: p.id, name: p.name, created: p.created })).sort((a, b) => String(b.created).localeCompare(String(a.created))); }

  route("GET", "/api/seed/pantry", () => { const have = seededKeys(); return Z.STARTER_PANTRY.map(p => ({ key: p.key, name: p.name, aisle: p.aisle, done: !!have[p.key] })); });
  route("POST", "/api/seed/match", (p, body) => seedMatch(body.key));
  route("POST", "/api/seed/commit", (p, body) => seedCommit(body.selections || []));

  route("GET", "/api/export", () => {
    const d = clone(doc());
    d.settings.usda_api_key = "";
    d.exported = new Date().toISOString();
    return d;
  });
  route("POST", "/api/import", (p, body) => {
    // merges a backup: adds ingredients/recipes (new ids), keeps what's already here
    const idMap = {};
    let ni = 0, nr = 0;
    for (const i of body.ingredients || []) { const old = i.id; const c = cleanIngredient({ ...i, id: undefined }); idMap[old] = store().upsert("ingredients", c).id; ni++; }
    for (const r of body.recipes || []) {
      const c = clone(r); delete c.id;
      c.ingredients = (c.ingredients || []).map(l => ({ ...l, ingredient_id: idMap[l.ingredient_id] || String(l.ingredient_id) }));
      store().upsert("recipes", cleanRecipe(c)); nr++;
    }
    return { ingredients: ni, recipes: nr };
  });

  async function request(method, url, body) {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(url);
      if (!m) continue;
      const params = {};
      for (const [k, v] of Object.entries(m.groups || {})) if (k !== "qs" && v != null) params[k] = decodeURIComponent(v);
      const qs = new URLSearchParams((m.groups && m.groups.qs) || "");
      return await r.fn(params, body || {}, qs);
    }
    throw new ApiError(`Unknown request ${method} ${url}`, 404);
  }

  Z.api = { request, ApiError, compute, usdaSearch, usdaFood };
})(globalThis.Z = globalThis.Z || {});
