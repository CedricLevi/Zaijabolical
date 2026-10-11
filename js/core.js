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

  /** USDA `foodNutrients` list -> {key: value per 100 g}. Missing = unknown (absent), not zero. */
  function parseUsdaNutrients(list) {
    const best = {};
    let epaDha = null, vitdIu = null;
    for (const fn of list || []) {
      const nested = fn.nutrient || {};
      const nid = fn.nutrientId ?? nested.id;
      const num = String(fn.nutrientNumber ?? nested.number ?? "");
      let val = fn.value ?? fn.amount;
      if (val == null) continue;
      val = Number(val);
      if (!isFinite(val)) continue;
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
  const AISLE_ORDER = ["Produce", "Tofu & Plant Protein", "Beans & Legumes", "Grains & Pasta", "Nuts & Seeds",
    "Dairy-Free & Fridge", "Frozen", "Pantry & Spices", "Other"];
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
        lines, steps: r.steps || "",
      });
    }
    batches.sort((a, b) => b.cook_min - a.cook_min);
    const grouped = {};
    for (const s of shopping.values()) {
      const a = s.ing.aisle || "Other";
      (grouped[a] = grouped[a] || []).push({ name: s.ing.name, grams: Math.round(s.grams), pretty: fmtG(s.grams),
        portion: nicePortion(s.grams, s.ing), recipes: [...s.recipes].sort(), verify: !!s.ing.verify });
    }
    const idx = a => { const i = AISLE_ORDER.indexOf(a); return i < 0 ? 99 : i; };
    const aisles = Object.keys(grouped).sort((a, b) => idx(a) - idx(b))
      .map(a => ({ aisle: a, items: grouped[a].sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase())) }));
    const order = Object.fromEntries(days.map((d, i) => [d.day, i]));
    const thaw = [];
    for (const b of batches) for (const t of b.thaw) thaw.push({ eat_day: t.day, recipe: b.name, servings: t.servings });
    thaw.sort((a, b) => (order[a.eat_day] ?? 9) - (order[b.eat_day] ?? 9) || a.recipe.localeCompare(b.recipe));
    return { batches, shopping: aisles, thaw, total_minutes: batches.reduce((a, b) => a + b.minutes, 0) };
  }

  Object.assign(Z, {
    KEYS, BY_KEY, GROUPS, AISLES: AISLE_ORDER,
    parseUsdaNutrients, defaultTargets, toGrams, recipeNutrition, supplementTotals, combine,
    evaluate, averageRows, score, nutrientMeta, recommendations, buildPrep, statusFor,
  });
})(globalThis.Z = globalThis.Z || {});
