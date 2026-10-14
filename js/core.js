/* Zaijabolical core: nutrient math, target evaluation, supplement advice and the prep sheet.
   Plain browser script; also loads in Node for tests. */
(function (Z) {
  "use strict";
  const N = Z.NUTRIENTS;
  const KEYS = N.map(n => n.key);
  const BY_KEY = Object.fromEntries(N.map(n => [n.key, n]));
  const GROUPS = ["Macros", "Vitamins", "Minerals"];

  // ---------------- USDA parsing ----------------
  const ID_MAP = {}, NUM_MAP = {};
  for (const n of N) {
    n.usda.forEach((id, p) => { ID_MAP[id] = [n.key, p]; });
    n.usda_nums.forEach((num, p) => { NUM_MAP[num] = [n.key, p]; });
  }
  const EPA_DHA_IDS = new Set([1278, 1272]), EPA_DHA_NUMS = new Set(["629", "621"]);

  // ---------------- amino acids ----------------
  // Stored on ingredients as nutrients.aa_* in grams per 100 g (USDA's unit). Kept out of NUTRIENTS on purpose,
  // so they never change plan scores; they're shown as a protein-quality view.
  const AA_RAW = [   // key, USDA nutrient number, USDA name
    ["aa_trp", "501", "tryptophan"], ["aa_thr", "502", "threonine"], ["aa_ile", "503", "isoleucine"], ["aa_leu", "504", "leucine"],
    ["aa_lys", "505", "lysine"], ["aa_met", "506", "methionine"], ["aa_cys", "507", "cystine"], ["aa_phe", "508", "phenylalanine"],
    ["aa_tyr", "509", "tyrosine"], ["aa_val", "510", "valine"], ["aa_his", "512", "histidine"],
  ];
  const AA_KEYS = AA_RAW.map(a => a[0]);
  const AA_BY_NUM = Object.fromEntries(AA_RAW.map(a => [a[1], a[0]]));
  const AA_BY_NAME = Object.fromEntries(AA_RAW.map(a => [a[2], a[0]]));
  // The nine essential amino acids as shown. ref = WHO/FAO/UNU (2007) adult scoring pattern, mg per g protein;
  // req = adult requirement, mg per kg body weight per day (same report).
  const AMINO = [
    { id: "his", abbr: "His", name: "Histidine", keys: ["aa_his"], ref: 15, req: 10 },
    { id: "ile", abbr: "Ile", name: "Isoleucine", keys: ["aa_ile"], ref: 30, req: 20 },
    { id: "leu", abbr: "Leu", name: "Leucine", keys: ["aa_leu"], ref: 59, req: 39 },
    { id: "lys", abbr: "Lys", name: "Lysine", keys: ["aa_lys"], ref: 45, req: 30 },
    { id: "saa", abbr: "Met", name: "Methionine + cysteine", keys: ["aa_met", "aa_cys"], ref: 22, req: 15 },
    { id: "aaa", abbr: "Phe", name: "Phenylalanine + tyrosine", keys: ["aa_phe", "aa_tyr"], ref: 38, req: 25 },
    { id: "thr", abbr: "Thr", name: "Threonine", keys: ["aa_thr"], ref: 23, req: 15 },
    { id: "trp", abbr: "Trp", name: "Tryptophan", keys: ["aa_trp"], ref: 6, req: 4 },
    { id: "val", abbr: "Val", name: "Valine", keys: ["aa_val"], ref: 39, req: 26 },
  ];

  /** USDA `foodNutrients` list -> {key: value per 100 g}. Missing = unknown (absent), not zero. */
  function parseUsdaNutrients(list) {
    const best = {};
    let epaDha = null, vitdIu = null;
    for (const fn of list || []) {
      const nested = fn.nutrient || {};
      const nid = fn.nutrientId ?? nested.id;
      const num = String(fn.nutrientNumber ?? nested.number ?? fn.number ?? "");
      let val = fn.value ?? fn.amount;
      if (val == null) continue;
      val = Number(val);
      if (!isFinite(val)) continue;
      const nm = String(fn.nutrientName ?? nested.name ?? fn.name ?? "").trim().toLowerCase();
      const aa = AA_BY_NUM[num] || AA_BY_NAME[nm];
      if (aa) { if (!(aa in best)) best[aa] = [0, val]; continue; }
      if (EPA_DHA_IDS.has(nid) || EPA_DHA_NUMS.has(num)) { epaDha = (epaDha || 0) + val * 1000; continue; }
      if (nid === 1110 || num === "324") { vitdIu = val; continue; }
      const hit = ID_MAP[nid] || NUM_MAP[num];
      if (!hit) continue;
      const [key, prio] = hit;
      if (key === "kcal" && String(fn.unitName || nested.unitName || "").toUpperCase() === "KJ") continue;
      if (!(key in best) || prio < best[key][0]) best[key] = [prio, val];
    }
    const out = {};
    for (const k in best) out[k] = best[k][1];
    if (epaDha != null) out.epa_dha = epaDha;
    if (!("vit_d" in out) && vitdIu != null) out.vit_d = vitdIu / 40;
    if (!("kcal" in out) && ["protein", "carbs", "fat"].every(k => k in out))
      out.kcal = out.protein * 4 + out.carbs * 4 + out.fat * 9;
    return out;
  }

  function defaultTargets() {
    return Object.fromEntries(N.map(n => [n.key, { target: n.target ?? null, enabled: n.kind !== "info" }]));
  }

  // ---------------- recipe math ----------------
  const WEIGHT_UNITS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
  const ASSUME_ZERO_IF_MISSING = new Set(["epa_dha"]);

  function toGrams(amount, unit, ing) {
    amount = Number(amount) || 0;
    unit = String(unit || "g").trim();
    if (WEIGHT_UNITS[unit.toLowerCase()]) return amount * WEIGHT_UNITS[unit.toLowerCase()];
    for (const p of (ing && ing.portions) || []) if (p.label === unit) return amount * Number(p.grams);
    return amount;
  }

  function zeros() { return Object.fromEntries(KEYS.map(k => [k, 0])); }

  /** Per-serving nutrients for a recipe. */
  function recipeNutrition(recipe, ingById) {
    const servings = Number(recipe.servings) || 1;
    const totals = zeros(), missingG = zeros();
    let totalG = 0;
    const problems = [];
    for (const item of recipe.ingredients || []) {
      const ing = ingById[item.ingredient_id];
      if (!ing) { if (item.ingredient_id) problems.push("An ingredient was deleted from the pantry"); continue; }
      const g = toGrams(item.amount, item.unit, ing);
      totalG += g;
      const nut = ing.nutrients || {};
      for (const k of KEYS) {
        const v = nut[k];
        if (v == null || v === "") { if (!ASSUME_ZERO_IF_MISSING.has(k)) missingG[k] += g; continue; }
        totals[k] += Number(v) * g / 100;
      }
    }
    const per = {}, missing = {};
    for (const k of KEYS) { per[k] = totals[k] / servings; missing[k] = totalG ? missingG[k] / totalG : 0; }
    return { per_serving: per, missing, total_grams: totalG, grams_per_serving: totalG / servings, problems };
  }

  /* ---------------- homemade pantry items (a recipe used as an ingredient, e.g. a broth or sauce) ---------------- */
  const VOLUME_ML = { ml: 1, l: 1000, liter: 1000, litre: 1000, tsp: 4.93, teaspoon: 4.93, tbsp: 14.79, tablespoon: 14.79,
    cup: 240, "fl oz": 29.57, fl_oz: 29.57, floz: 29.57, pint: 473, quart: 946, qt: 946, gallon: 3785 };
  /** grams for a line that isn't linked to the pantry (water, ice…): weights as they are, volumes as water */
  function looseGrams(amount, unit) {
    amount = Number(amount) || 0;
    const u = String(unit || "").trim().toLowerCase().replace(/\.$/, "");
    if (WEIGHT_UNITS[u]) return amount * WEIGHT_UNITS[u];
    const v = VOLUME_ML[u] ?? VOLUME_ML[u.replace(/e?s$/, "")];
    return v ? amount * v : 0;
  }
  /** a first guess at what the whole batch weighs: everything that goes in, water included (before cooking) */
  function recipeYieldGuess(recipe, ingById) {
    let g = 0;
    for (const l of recipe.ingredients || []) {
      const ing = ingById[l.ingredient_id];
      g += ing ? toGrams(l.amount, l.unit, ing) : looseGrams(l.amount, l.unit);
    }
    return Math.round(g);
  }
  /**
   * Nutrients per 100 g of a recipe used as a pantry item, for a batch weighing yieldG.
   * A nutrient is left unknown when less than 3/4 of the linked ingredients (by weight) have a value for it.
   */
  function recipeAsIngredient(recipe, ingById, yieldG) {
    const tot = {}, known = {};
    let linkedG = 0;
    for (const l of recipe.ingredients || []) {
      const ing = ingById[l.ingredient_id];
      if (!ing) continue;
      const g = toGrams(l.amount, l.unit, ing);
      if (!(g > 0)) continue;
      linkedG += g;
      for (const [k, v] of Object.entries(ing.nutrients || {})) {
        if (v == null || v === "" || !isFinite(Number(v))) continue;
        tot[k] = (tot[k] || 0) + Number(v) * g / 100;
        known[k] = (known[k] || 0) + g;
      }
    }
    const y = Number(yieldG) > 0 ? Number(yieldG) : recipeYieldGuess(recipe, ingById);
    const nutrients = {};
    if (y > 0 && linkedG > 0) {
      for (const k of Object.keys(tot)) {
        if (known[k] / linkedG < 0.75 && !ASSUME_ZERO_IF_MISSING.has(k)) continue;
        nutrients[k] = +(tot[k] / y * 100).toPrecision(5);
      }
    }
    const servings = Number(recipe.servings) || 1;
    // spoon and cup measures assume it's about as dense as water (true enough for broths and most sauces)
    const portions = y > 0 ? [{ label: "serving", grams: +(y / servings).toFixed(1), auto: true }, { label: "batch", grams: Math.round(y), auto: true },
      { label: "cup", grams: 240, auto: true }, { label: "tbsp", grams: 15, auto: true }, { label: "tsp", grams: 5, auto: true }] : [];
    return { nutrients, portions, yield_g: y, linked_g: linkedG };
  }

  /** Amino acids from a list of [ingredient, grams]. Returns per-acid grams plus a protein-quality %
      (mg of the acid per g protein vs. the WHO reference). Ingredients without amino data are left out of the
      quality figure, and `coverage` says what share of the protein had data. */
  function aminoFromGrams(pairs) {
    const tot = Object.fromEntries(AMINO.map(a => [a.id, 0]));
    let protKnown = 0, protAll = 0;
    for (const [ing, g] of pairs) {
      const nut = (ing && ing.nutrients) || {};
      const p = Number(nut.protein) || 0;
      protAll += p * g / 100;
      if (nut.aa_lys == null || nut.aa_lys === "") continue;
      protKnown += p * g / 100;
      for (const a of AMINO) for (const k of a.keys) tot[a.id] += (Number(nut[k]) || 0) * g / 100;
    }
    const coverage = protAll > 0 ? protKnown / protAll : 0;
    const acids = AMINO.map(a => ({ id: a.id, abbr: a.abbr, name: a.name, grams: tot[a.id],
      quality: protKnown > 0 ? tot[a.id] * 1000 / protKnown / a.ref * 100 : null, ref: a.ref, req: a.req }));
    const known = acids.filter(a => a.quality != null);
    const limiting = known.length ? known.reduce((m, a) => (a.quality < m.quality ? a : m)) : null;
    return { acids, coverage, protein_known: protKnown, protein: protAll, has_data: coverage >= 0.5,
      score: limiting ? Math.min(100, limiting.quality) : null, limiting: limiting ? limiting.id : null };
  }
  function recipeAmino(recipe, ingById, servings) {
    const div = (Number(recipe.servings) || 1) / (servings || 1);
    const pairs = [];
    for (const item of recipe.ingredients || []) {
      const ing = ingById[item.ingredient_id];
      if (ing) pairs.push([ing, toGrams(item.amount, item.unit, ing) / div]);
    }
    return aminoFromGrams(pairs);
  }

  function supplementTotals(supps) {
    const out = zeros();
    for (const s of supps || []) {
      if (s.active === false) continue;
      for (const [k, v] of Object.entries(s.nutrients || {})) if (k in out && v !== "" && v != null) out[k] += Number(v);
    }
    return out;
  }

  /** items: [[per, missing, servings]] -> [totals, missingShare] */
  function combine(items) {
    const tot = zeros(), mw = zeros();
    let w = 0;
    for (const [per, miss, s] of items) {
      w += s;
      for (const k of KEYS) { tot[k] += (per[k] || 0) * s; mw[k] += (miss[k] || 0) * s; }
    }
    const missing = {};
    for (const k of KEYS) missing[k] = w ? mw[k] / w : 0;
    return [tot, missing];
  }

  function statusFor(kind, pct, total, target, overUl) {
    let st;
    if (kind === "info" || !target) st = "info";
    else if (kind === "limit") st = total > target ? "over" : "good";
    else if (kind === "macro") st = pct >= 90 && pct <= 110 ? "good" : (pct < 90 ? "low" : "high");
    else st = pct >= 90 ? "good" : (pct >= 70 ? "ok" : "low");
    return overUl ? "over" : st;
  }

  /** One row per nutrient with %, status and limit checks. */
  function evaluate(food, supp, targets, missing) {
    missing = missing || {};
    return N.map(n => {
      const k = n.key, t = targets[k] || {};
      const target = t.target || null;
      const f = food[k] || 0, s = supp[k] || 0, total = f + s;
      const pct = target ? total / target * 100 : null;
      const ul = n.ul || null;
      const overUl = !!(ul && (n.ul_scope === "total" ? total : s) > ul);
      return {
        key: k, name: n.name, unit: n.unit, group: n.group, kind: n.kind,
        enabled: t.enabled !== false, target, food: f, supp: s, total, pct,
        status: statusFor(n.kind, pct, total, target, overUl),
        ul, ul_scope: n.ul_scope || null, over_ul: overUl,
        incomplete: (missing[k] || 0) > 0.15, missing_share: missing[k] || 0, note: n.note || null,
      };
    });
  }

  function averageRows(allRows) {
    return allRows[0].map((base, i) => {
      const r = { ...base };
      for (const f of ["food", "supp", "total", "missing_share"]) r[f] = allRows.reduce((a, rows) => a + rows[i][f], 0) / allRows.length;
      r.pct = r.target ? r.total / r.target * 100 : null;
      r.over_ul = allRows.some(rows => rows[i].over_ul);
      r.incomplete = r.missing_share > 0.15;
      r.status = statusFor(r.kind, r.pct, r.total, r.target, r.over_ul);
      return r;
    });
  }

  /** 0-100 coverage score: mean capped % of enabled targets. */
  function score(rows) {
    const vals = [];
    for (const r of rows) {
      if (!r.enabled || r.pct == null || r.kind === "info") continue;
      let v;
      if (r.kind === "limit") v = r.total <= r.target ? 100 : Math.max(0, 200 - r.pct);
      else if (r.kind === "macro") v = Math.max(0, 100 - Math.abs(100 - r.pct));
      else v = Math.min(100, r.pct);
      vals.push(r.over_ul ? 0 : v);
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  }

  function nutrientMeta() {
    return N.map(n => ({ key: n.key, name: n.name, unit: n.unit, group: n.group, kind: n.kind, target: n.target ?? null,
      ul: n.ul ?? null, ul_scope: n.ul_scope ?? null, note: n.note ?? null, advice: n.advice ?? null,
      supplement_only: !!n.supplement_only }));
  }

  // ---------------- advice ----------------
  const fmtNum = v => v >= 100 ? Math.round(v).toLocaleString("en-US") : v >= 10 ? v.toFixed(0) : v.toFixed(1);

  function recommendations(rows, threshold = 90) {
    const recs = [];
    for (const r of rows) {
      if (!r.enabled || r.target == null) continue;
      const n = BY_KEY[r.key];
      const pct = r.pct || 0;
      if (r.over_ul) {
        const basis = r.ul_scope === "total" ? "Total intake" : "Supplements";
        recs.push({ kind: "warning", key: r.key, name: r.name, priority: 0,
          title: `${r.name} is above the safe upper limit`,
          text: `${basis} reach ${fmtNum(r.ul_scope === "total" ? r.total : r.supp)} ${r.unit}; the upper limit is ${fmtNum(r.ul)} ${r.unit}. Reduce the source or the dose.` });
        continue;
      }
      if (r.kind === "limit") {
        if (r.total > r.target) recs.push({ kind: "warning", key: r.key, name: r.name, priority: 1,
          title: `${r.name} is over the limit`,
          text: `${fmtNum(r.total)} ${r.unit} vs. a limit of ${fmtNum(r.target)} ${r.unit}. ${n.note || ""}` });
        continue;
      }
      if (r.kind !== "min") continue;
      const gap = Math.max(0, r.target - r.total);
      const always = n.always_recommend && r.supp < r.target;
      if (pct >= threshold && !always) continue;
      let kind = (n.dose || n.supplement_only) ? "supplement" : "food";
      if (r.key === "iron") kind = "food";
      recs.push({
        kind, key: r.key, name: r.name, priority: kind === "supplement" ? 2 : 3,
        title: (r.food > 0 || r.supp > 0) ? `${r.name}: ${Math.round(pct)}% from food` : `${r.name}: not covered by food`,
        gap, unit: r.unit, pct,
        gap_text: gap > 0 ? `Short by about ${fmtNum(gap)} ${r.unit}/day` : "Met, but only via fortified foods",
        text: n.advice || "", dose: n.dose || null,
      });
    }
    for (const r of rows) {
      if (r.enabled && r.incomplete && r.kind === "min" && r.key !== "iodine")
        recs.push({ kind: "data", key: r.key, name: r.name, priority: 4, title: `${r.name}: data incomplete`,
          text: `About ${Math.round(r.missing_share * 100)}% of this food (by weight) has no USDA value for ${r.name.toLowerCase()}, so the real number is probably higher than shown.` });
    }
    recs.sort((a, b) => a.priority - b.priority || (b.gap || 0) - (a.gap || 0));
    return recs;
  }

  // ---------------- prep sheet ----------------
  const HOMEMADE_AISLE = "Homemade: make these first";
  const AISLE_ORDER = ["Produce", "Tofu & Plant Protein", "Beans & Legumes", "Grains & Pasta", "Nuts & Seeds",
    "Dairy-Free & Fridge", "Frozen", "Pantry & Spices", "Homemade", "Other"];
  const FRAC = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

  function nicePortion(grams, ing) {
    let best = null;
    for (const p of (ing && ing.portions) || []) {
      const g = Number(p.grams);
      if (!(g > 0)) continue;
      const n = grams / g;
      if (n >= 0.25 && n <= 40) {
        const cand = [Math.abs(n - Math.round(n * 4) / 4), -g, p.label, n];
        if (!best || cand[0] < best[0] - 1e-12 || (Math.abs(cand[0] - best[0]) < 1e-12 && cand[1] < best[1])) best = cand;
      }
    }
    if (!best) return null;
    const q = Math.round(best[3] * 4) / 4, whole = Math.floor(q), part = q - whole;
    const txt = (whole ? String(whole) : "") + (FRAC[part] || "");
    return `≈ ${txt || "¼"} ${best[2]}`;
  }
  const fmtG = g => g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;
  const fmtAmt = v => String(Math.round(v * 1000) / 1000);

  function buildPrep(days, recipesById, ingById) {
    const per = new Map();
    for (const d of days) for (const it of d.items) {
      if (!per.has(it.recipe_id)) per.set(it.recipe_id, { fridge: [], freezer: [], total: 0 });
      const e = per.get(it.recipe_id);
      e.total += it.servings;
      e[it.source === "freezer" ? "freezer" : "fridge"].push([d.day, it.servings]);
    }
    const batches = [], shopping = new Map();
    for (const [rid, e] of per) {
      const r = recipesById[rid];
      if (!r) continue;
      const yld = Number(r.servings) || 1;
      const mult = Math.ceil(e.total / yld * 4 - 1e-9) / 4;
      const lines = [];
      for (const item of r.ingredients || []) {
        const ing = ingById[item.ingredient_id];
        if (!ing) continue;
        const g = toGrams(item.amount, item.unit, ing) * mult;
        lines.push({ name: ing.name, grams: g, amount: `${fmtAmt((Number(item.amount) || 0) * mult)} ${item.unit || "g"}`, note: item.note || "" });
        if (!shopping.has(ing.id)) shopping.set(ing.id, { ing, grams: 0, recipes: new Set() });
        const s = shopping.get(ing.id);
        s.grams += g; s.recipes.add(r.name);
      }
      batches.push({
        recipe_id: rid, name: r.name, category: r.category, servings_needed: e.total, yield: yld,
        multiplier: mult, extra_servings: mult * yld - e.total,
        fridge_servings: e.fridge.reduce((a, x) => a + x[1], 0), freezer_servings: e.freezer.reduce((a, x) => a + x[1], 0),
        thaw: e.freezer.map(([day, s]) => ({ day, servings: s })), freezes: !!r.freezes,
        minutes: (Number(r.prep_min) || 0) + (Number(r.cook_min) || 0), cook_min: Number(r.cook_min) || 0,
        prep_min: Number(r.prep_min) || 0, lines, steps: r.steps || "",
      });
    }
    // lines typed in a recipe but not linked to a pantry ingredient still go on the shopping list
    for (const [rid, e] of per) {
      const r = recipesById[rid];
      if (!r) continue;
      const mult = Math.ceil(e.total / (Number(r.servings) || 1) * 4 - 1e-9) / 4;
      for (const item of r.ingredients || []) {
        if (ingById[item.ingredient_id] || !item.name) continue;
        const k = "name:" + item.name.toLowerCase();
        if (!shopping.has(k)) shopping.set(k, { ing: { id: k, name: item.name, aisle: "Other" }, grams: 0, recipes: new Set(), text: [] });
        const s = shopping.get(k);
        s.recipes.add(r.name);
        if (item.amount) s.text.push(`${fmtAmt((Number(item.amount) || 0) * mult)} ${item.unit || ""}`.trim());
      }
    }
    batches.sort((a, b) => b.cook_min - a.cook_min);
    const grouped = {};
    for (const s of shopping.values()) {
      const a = s.ing.from_recipe ? HOMEMADE_AISLE : (s.ing.aisle || "Other");   // homemade items are made, not bought
      (grouped[a] = grouped[a] || []).push({ name: s.ing.name, grams: Math.round(s.grams), pretty: s.text ? (s.text.join(" + ") || "") : fmtG(s.grams),
        portion: s.text ? null : nicePortion(s.grams, s.ing), recipes: [...s.recipes].sort(), verify: !!s.ing.verify });
    }
    const idx = a => { if (a === HOMEMADE_AISLE) return -1; const i = AISLE_ORDER.indexOf(a); return i < 0 ? 99 : i; };
    const aisles = Object.keys(grouped).sort((a, b) => idx(a) - idx(b))
      .map(a => ({ aisle: a, items: grouped[a].sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase())) }));
    const order = Object.fromEntries(days.map((d, i) => [d.day, i]));
    const thaw = [];
    for (const b of batches) for (const t of b.thaw) thaw.push({ eat_day: t.day, recipe: b.name, servings: t.servings });
    thaw.sort((a, b) => (order[a.eat_day] ?? 9) - (order[b.eat_day] ?? 9) || a.recipe.localeCompare(b.recipe));
    return { batches, shopping: aisles, thaw, total_minutes: batches.reduce((a, b) => a + b.minutes, 0),
      schedule: buildSchedule(batches) };
  }

  /** Prep-day timeline for one cook: start the longest-cooking dish first, and do the next dish's hands-on
      work while earlier ones simmer or bake. Prep time counts as hands-on, cook time as hands-off. */
  function buildSchedule(batches) {
    const cooked = batches.filter(b => b.minutes > 5)
      .sort((a, b) => b.cook_min - a.cook_min || b.prep_min - a.prep_min);
    let t = 0, lastDone = 0, handsTotal = 0;
    const lanes = [], steps = [];
    for (const b of cooked) {
      const scale = 1 + 0.4 * Math.max(0, b.multiplier - 1);      // a double batch takes longer to chop, not twice as long
      const hands = Math.max(5, Math.round(b.prep_min * scale / 5) * 5);
      const start = t, handsEnd = t + hands, done = handsEnd + b.cook_min;
      const blocks = [{ start, end: handsEnd, kind: "hands", label: "prep" }];
      if (b.cook_min > 0) blocks.push({ start: handsEnd, end: done, kind: "wait", label: `cooks ${b.cook_min} min` });
      lanes.push({ recipe_id: b.recipe_id, name: b.name, blocks });
      steps.push({ at: start, recipe_id: b.recipe_id, name: b.name, hands, cook: b.cook_min, done });
      handsTotal += hands; t = handsEnd; lastDone = Math.max(lastDone, done);
    }
    if (!cooked.length) return { lanes, steps, total: 0, hands_on: 0, pack: null };
    const packStart = Math.max(t, lastDone), packMin = 5 + 3 * cooked.length;
    const fridge = cooked.reduce((a, b) => a + b.fridge_servings, 0), freezer = cooked.reduce((a, b) => a + b.freezer_servings, 0);
    lanes.push({ recipe_id: null, name: "Portion & pack", blocks: [{ start: packStart, end: packStart + packMin, kind: "hands", label: "fridge / freezer" }] });
    handsTotal += packMin;
    return { lanes, steps, total: packStart + packMin, hands_on: handsTotal,
      pack: { at: packStart, minutes: packMin, fridge, freezer } };
  }

  Object.assign(Z, {
    KEYS, BY_KEY, GROUPS, AISLES: AISLE_ORDER, AMINO, AA_KEYS,
    parseUsdaNutrients, defaultTargets, toGrams, recipeNutrition, supplementTotals, combine,
    evaluate, averageRows, score, nutrientMeta, recommendations, buildPrep, buildSchedule, statusFor,
    aminoFromGrams, recipeAmino, recipeYieldGuess, recipeAsIngredient, looseGrams,
  });
})(globalThis.Z = globalThis.Z || {});
