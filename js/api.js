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
    const unlinked = (r.ingredients || []).filter(l => !ingById[l.ingredient_id] && l.name && !l.ignore).length;
    return { ...clone(r), nutrition: { per_serving: nut.per_serving, missing: nut.missing,
      grams_per_serving: nut.grams_per_serving, problems: nut.problems, amino: Z.recipeAmino(r, ingById, 1), unlinked } };
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
        data_type: f.dataType, nutrients: nut, n_nutrients: Object.keys(nut).length, ingredients: String(f.ingredients || "").slice(0, 4000) };
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
      ingredients: String(f.ingredients || "").slice(0, 4000),
      nutrients: Z.parseUsdaNutrients(f.foodNutrients),
      portions: portions.filter(p => !seen.has(p.label.toLowerCase()) && seen.add(p.label.toLowerCase())).slice(0, 12) };
  }

  /** a USDA search result that's clearly not vegan (meat, dairy, eggs, honey… in its name or ingredient list) */
  const isNotVegan = f => !!Z.cookbook && Z.cookbook.pantryVegan({ name: f.description, usda_description: f.description, brand: f.brand,
    ingredients_text: f.ingredients, data_type: f.data_type, source: "usda" }).status === "no";

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
      results.forEach(r => { r.fits = fits(r.description, item) && !isNotVegan(r); candidates.push(r); });
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

  // ---------------- homemade pantry items: a recipe (broth, sauce…) used as an ingredient ----------------
  /** recompute every homemade item from its recipe; repeats so a sauce made with a homemade broth follows it */
  function refreshHomemade() {
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      const ing = ingMap(), rec = recipeMap();
      for (const i of doc().ingredients) {
        if (!i.from_recipe || !rec[i.from_recipe]) continue;
        const d = Z.recipeAsIngredient(rec[i.from_recipe], ing, i.yield_g);
        const portions = [...d.portions, ...(i.portions || []).filter(p => !p.auto && !d.portions.some(x => x.label === p.label))];
        if (JSON.stringify(d.nutrients) === JSON.stringify(i.nutrients) && JSON.stringify(portions) === JSON.stringify(i.portions || [])) continue;
        store().upsert("ingredients", { ...clone(i), nutrients: d.nutrients, portions });
        changed = true;
      }
      if (!changed) return;
    }
  }
  /** recipe ids this pantry item is made from, following homemade items inside homemade items */
  function madeFrom(ingId, seen = new Set()) {
    const i = ingMap()[ingId];
    if (!i || !i.from_recipe || seen.has(i.from_recipe)) return seen;
    seen.add(i.from_recipe);
    const r = recipeMap()[i.from_recipe];
    for (const l of (r && r.ingredients) || []) if (l.ingredient_id) madeFrom(l.ingredient_id, seen);
    return seen;
  }
  function checkNoLoop(r) {
    if (!r.id) return;
    for (const l of r.ingredients || []) {
      if (l.ingredient_id && madeFrom(l.ingredient_id).has(r.id)) {
        throw new ApiError(`“${ingMap()[l.ingredient_id].name}” is made from this recipe, so it can't be one of its ingredients.`);
      }
    }
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
    r.description = String(r.description || "");
    r.rating = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
    r.links = (r.links || []).map(l => ({ title: String(l.title || "").trim(), url: String(l.url || "").trim() }))
      .filter(l => /^https?:\/\/[^\s]+$/i.test(l.url));   // only web links: nothing that could run script
    r.photos = (r.photos || []).filter(p => p && p.path);
    r.attachments = (r.attachments || []).filter(a => a && a.path);
    // a line needs a pantry ingredient, or at least a name (scanned lines waiting to be linked)
    r.ingredients = (r.ingredients || []).filter(l => l.ingredient_id || String(l.name || "").trim())
      .map(l => (l.ingredient_id ? { ingredient_id: l.ingredient_id, amount: l.amount, unit: l.unit, note: l.note || "" }
        : { ingredient_id: null, name: String(l.name).trim(), amount: l.amount, unit: l.unit || "", note: l.note || "", ...(l.ignore ? { ignore: true } : {}) }));
    return r;
  }
  function cleanIngredient(d) {
    if (!String(d.name || "").trim()) throw new ApiError("Name is required");
    const i = clone(d); i.name = i.name.trim(); i.nutrients = i.nutrients || {}; i.portions = i.portions || [];
    for (const [k, v] of Object.entries(i.nutrients)) if (v === "" || v == null || !isFinite(Number(v))) delete i.nutrients[k]; else i.nutrients[k] = Number(v);
    i.aisle = i.aisle || "Other"; i.source = i.source || "manual"; i.verify = !!i.verify;
    if (i.from_recipe) { i.source = "recipe"; i.yield_g = Math.max(1, Number(i.yield_g) || 0) || null; i.verify = false; }
    else { delete i.from_recipe; delete i.yield_g; }
    // vegan: "yes" / "no" when you've checked it yourself; otherwise worked out from its name and ingredient list
    if (i.vegan !== "yes" && i.vegan !== "no") delete i.vegan;
    i.ingredients_text = String(i.ingredients_text || "").trim().slice(0, 4000);
    if (!i.ingredients_text) delete i.ingredients_text;
    // another version of a pantry item (e.g. homemade broth and store-bought broth); always points at the main one
    if (i.version_of) {
      const target = doc().ingredients.find(x => x.id === i.version_of);
      i.version_of = target ? (target.version_of && target.version_of !== i.id ? target.version_of : target.id) : null;
      if (i.version_of === i.id) i.version_of = null;
    }
    if (!i.version_of) delete i.version_of;
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

  const withRefresh = rec => { refreshHomemade(); return clone(ingMap()[rec.id] || rec); };
  route("POST", "/api/ingredients", (p, body) => withRefresh(store().upsert("ingredients", cleanIngredient(body))));
  route("PUT", "/api/ingredients/:id", (p, body) => withRefresh(store().upsert("ingredients", cleanIngredient({ ...body, id: p.id }))));
  /** use one version of an ingredient instead of another in every recipe */
  route("POST", "/api/ingredients/switch", (p, body) => {
    const ing = ingMap(), from = ing[body.from], to = ing[body.to];
    if (!from || !to) throw new ApiError("That ingredient isn't in the pantry any more", 404);
    let n = 0;
    for (const r of doc().recipes) {
      if (!(r.ingredients || []).some(l => l.ingredient_id === from.id)) continue;
      if (to.from_recipe && madeFrom(to.id).has(r.id)) continue;   // never inside its own recipe
      const next = clone(r);
      next.ingredients = next.ingredients.map(l => (l.ingredient_id === from.id ? { ...l, ingredient_id: to.id, ...Z.switchUnits(l.amount, l.unit, from, to) } : l));
      store().upsert("recipes", next); n++;
    }
    refreshHomemade();
    return { recipes: n };
  });
  /** make a recipe into a pantry item (or update the one already made from it) */
  route("POST", "/api/ingredients/from-recipe", (p, body) => {
    const r = recipeMap()[body.recipe_id];
    if (!r) throw new ApiError("That recipe isn't here any more", 404);
    const ex = doc().ingredients.find(i => i.from_recipe === r.id);
    const yieldG = Number(body.yield_g) > 0 ? Number(body.yield_g) : Z.recipeYieldGuess(r, ingMap());
    if (!(yieldG > 0)) throw new ApiError("Enter about how much the whole batch weighs");
    const rec = store().upsert("ingredients", cleanIngredient({ ...(ex ? clone(ex) : { nutrients: {}, portions: [] }),
      name: String(body.name || (ex && ex.name) || r.name).trim(), aisle: body.aisle || (ex && ex.aisle) || "Homemade",
      from_recipe: r.id, yield_g: yieldG, ...("version_of" in body ? { version_of: body.version_of || null } : {}) }));
    return withRefresh(rec);
  });
  route("DELETE", "/api/ingredients/:id", p => {
    const used = doc().recipes.filter(r => (r.ingredients || []).some(l => l.ingredient_id === p.id)).map(r => r.name);
    if (used.length) throw new ApiError(`Used in: ${used.join(", ")}. Remove it from those recipes first.`, 409);
    store().remove("ingredients", p.id); refreshHomemade(); return { ok: true };
  });
  route("GET", "/api/usda/search", (p, b, qs) => {
    const q = (qs.get("q") || "").trim();
    if (!q) return [];
    const types = qs.get("types") ? qs.get("types").split(",").filter(Boolean) : null;
    return usdaSearch(q, types, 20);
  });
  route("GET", "/api/usda/food/:id", p => usdaFood(p.id));

  const savedRecipe = rec => { refreshHomemade(); return recipeOut(recipeMap()[rec.id] || rec, ingMap()); };
  route("POST", "/api/recipes", (p, body) => savedRecipe(store().upsert("recipes", cleanRecipe(body))));
  route("PUT", "/api/recipes/:id", (p, body) => {
    const r = cleanRecipe({ ...body, id: p.id });
    checkNoLoop(r);
    return savedRecipe(store().upsert("recipes", r));
  });
  route("DELETE", "/api/recipes/:id", p => {
    const r = doc().recipes.find(x => x.id === p.id);
    if (r && Z.media) for (const m of [...(r.photos || []), ...(r.attachments || [])]) Z.media.remove(m);
    store().remove("recipes", p.id); return { ok: true };
  });
  route("PATCH", "/api/recipes/:id", (p, body) => {   // small edits from the recipe page (rating)
    const r = doc().recipes.find(x => x.id === p.id);
    if (!r) throw new ApiError("Not found", 404);
    const next = clone(r);
    if ("rating" in body) next.rating = body.rating;
    return recipeOut(store().upsert("recipes", cleanRecipe(next)), ingMap());
  });
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
    const day = x => (/^\d{4}-\d{2}-\d{2}$/.test(x || "") ? x : null);
    store().setDocField("current_week", v && v.data ? { name: v.name || null, choice: v.choice ?? null, week_of: day(v.week_of),
      prep_date: day(v.prep_date), week: compactWeek(v.data) } : null);
    return { ok: true };
  });
  route("GET", "/api/week/current", () => {
    const cw = doc().current_week;
    if (!cw || !cw.week) return null;
    const data = expandWeek(cw.week);
    return data ? { name: cw.name, choice: cw.choice, week_of: cw.week_of || null, prep_date: cw.prep_date || null, data } : null;
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

  // ---------------- tracker ----------------
  function evalItems(items) {
    const s = settings(), ing = ingMap(), rec = recipeMap(), trip = [], pairs = [];
    let eaten = 0;
    for (const it of items || []) {
      if (it.eaten === false) continue;
      if (it.recipe_id) {
        const r = rec[it.recipe_id], sv = Number(it.servings) || 0;
        if (!r || sv <= 0) continue;
        const nut = Z.recipeNutrition(r, ing); trip.push([nut.per_serving, nut.missing, sv]); eaten++;
        const div = (Number(r.servings) || 1) / sv;
        for (const l of r.ingredients || []) if (ing[l.ingredient_id]) pairs.push([ing[l.ingredient_id], Z.toGrams(l.amount, l.unit, ing[l.ingredient_id]) / div]);
      } else if (it.ingredient_id) {
        const i = ing[it.ingredient_id];
        if (!i) continue;
        const g = Z.toGrams(it.amount, it.unit, i);
        if (!(g > 0)) continue;
        const per = {}, miss = {};
        for (const k of Z.KEYS) { const v = i.nutrients[k]; per[k] = v == null ? 0 : v * g / 100; miss[k] = v == null ? 1 : 0; }
        trip.push([per, miss, 1]); pairs.push([i, g]); eaten++;
      }
    }
    const [food, missing] = Z.combine(trip);
    const rows = Z.evaluate(food, Z.supplementTotals(s.supplements), s.targets, missing);
    return { rows, score: eaten ? Z.score(rows) : null, eaten, advice: Z.recommendations(rows), amino: Z.aminoFromGrams(pairs) };
  }
  const logId = date => "log-" + date;
  function plannedFor(date) {
    const cw = doc().current_week;
    if (!cw || !cw.week || !cw.week_of) return [];
    if (date < cw.week_of || date > Z.tracker.addDays(cw.week_of, 6)) return [];   // only the week the plan is for
    const name = Z.tracker.weekdayName(date);
    const d = cw.week.days.find(x => x.day === name);
    return d ? d.items.filter(i => recipeMap()[i.recipe_id]).map(i => ({ recipe_id: i.recipe_id, servings: i.servings, eaten: false, planned: true })) : [];
  }
  route("GET", "/api/logs", () => doc().logs.map(l => ({ date: l.date, score: l.score, eaten: l.eaten })));
  route("GET", "/api/logs/:date", p => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new ApiError("Bad date");
    const l = doc().logs.find(x => x.id === logId(p.date));
    const plan = plannedFor(p.date);
    let items;
    if (!l) items = plan;
    else if (l.cleared) items = clone(l.items);
    else {
      // follow the plan in use: drop planned meals that weren't eaten and aren't in it any more, add new ones
      const dismissed = new Set(l.dismissed || []);
      items = clone(l.items).filter(i => !i.planned || i.eaten || plan.some(x => x.recipe_id === i.recipe_id));
      for (const x of plan) if (!items.some(i => i.recipe_id === x.recipe_id) && !dismissed.has(x.recipe_id)) items.push(x);
    }
    const res = { date: p.date, items, saved: !!l, dismissed: (l && l.dismissed) || [], cleared: !!(l && l.cleared), ...evalItems(items) };
    // what the day would look like if she ate everything on the list (shown for days that haven't happened yet)
    if (items.some(i => i.eaten === false)) {
      const all = evalItems(items.map(i => ({ ...i, eaten: true })));
      res.if_all = { rows: all.rows, score: all.score, amino: all.amino };
    }
    return res;
  });
  route("PUT", "/api/logs/:date", (p, body) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new ApiError("Bad date");
    const items = (body.items || []).map(it => (it.recipe_id
      ? { recipe_id: String(it.recipe_id), servings: Math.max(0, Number(it.servings) || 0), eaten: it.eaten !== false, planned: !!it.planned }
      : { ingredient_id: String(it.ingredient_id), amount: Math.max(0, Number(it.amount) || 0), unit: it.unit || "g", eaten: it.eaten !== false }))
      .filter(it => it.recipe_id || it.ingredient_id);
    const ev = evalItems(items);
    const dismissed = [...new Set((body.dismissed || []).map(String))].slice(0, 200), cleared = !!body.cleared;
    store().upsert("logs", { id: logId(p.date), date: p.date, items, score: ev.score, eaten: ev.eaten, dismissed, cleared });
    return { date: p.date, items, saved: true, dismissed, cleared, ...ev };
  });

  // ---------------- amino acids for ingredients added before they were tracked ----------------
  route("POST", "/api/usda/amino-backfill", async () => {
    if (!settings().usda_api_key) return { updated: 0, left: 0 };
    const todo = doc().ingredients.filter(i => i.fdc_id && i.source === "usda" && !i.aa_checked && (i.nutrients || {}).aa_lys == null);
    const batch = todo.slice(0, 20);
    if (!batch.length) return { updated: 0, left: 0 };
    const foods = await usdaFetch("/foods", { fdcIds: batch.map(i => Number(i.fdc_id)), format: "full" });
    const byId = Object.fromEntries((foods || []).map(f => [String(f.fdcId), f]));
    let updated = 0;
    for (const i of batch) {
      const f = byId[String(i.fdc_id)];
      const next = clone(i);
      next.aa_checked = true;
      if (f) {
        const nut = Z.parseUsdaNutrients(f.foodNutrients);
        for (const k of Z.AA_KEYS) if (nut[k] != null) next.nutrients[k] = nut[k];
        if (next.nutrients.aa_lys != null) updated++;
      }
      store().upsert("ingredients", next);
    }
    return { updated, left: todo.length - batch.length };
  });

  // ---------------- scanning (runs on the site's Cloudflare function) ----------------
  route("POST", "/api/scan", async (p, body) => {
    const gh = store().S.github;
    if (!gh) throw new ApiError("Scanning needs this device to be connected to your GitHub data repo (Settings → Sync).");
    let res;
    try {
      res = await fetch("api/scan", { method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Zaija-Key": gh.token, "X-Zaija-Repo": `${gh.owner}/${gh.repo}` },
        body: JSON.stringify({ kind: body.kind, images: body.images || [], text: body.text, candidates: body.candidates }) });
    } catch { throw new ApiError("Couldn't reach the scanner. Check your internet connection (scanning only works on the website)."); }
    let data = null;
    try { data = await res.json(); } catch { /* not json */ }
    if (!res.ok || !data) throw new ApiError((data && data.error) || (res.status === 404 || res.status === 405
      ? "Scanning isn't switched on for the website yet (see the README's “Scanning” section)." : `Scanning failed (${res.status}).`), res.status);
    return data;
  });

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

  Z.api = { request, ApiError, compute, usdaSearch, usdaFood, evalItems };
})(globalThis.Z = globalThis.Z || {});
