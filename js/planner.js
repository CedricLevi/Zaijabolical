/* Zaijabolical planner: picks recipe servings (in half-serving steps) that best hit the
   nutrient targets. Runs entirely in the browser.

   Objective (minimised), each term normalised by its target:
     - micronutrient / fiber shortfall below target; the part below 70% costs 3x more,
       so "everything decent" beats "some perfect, some terrible"
     - macros: deviation above OR below target
     - "limit" nutrients (sodium, saturated fat): only the amount over the limit
     - exceeding a total-intake safe upper limit: very large penalty
   Rules (category servings per day, number of dishes per day, dishes you build around,
   diversity between ideas) are enforced; the search is iterated local search with
   restarts, seeded so the same inputs give the same answer. */
(function (Z) {
  "use strict";

  const DEEP_TIER = 0.30, DEEP_WEIGHT = 3.0, UL_PENALTY = 1000, LIMIT_WEIGHT = 1.5;
  const PEN = 40;           // cost per unit of rule violation during search
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  // Nutrients a vegan diet realistically covers with supplements: food still counts,
  // but the planner doesn't contort the menu chasing them.
  const SUPPLEMENT_EXPECTED = { b12: 0.15, vit_d: 0.15, iodine: 0.1, epa_dha: 0 };

  function rng(seed) {   // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const isStaple = r => (Number(r.prep_min) || 0) + (Number(r.cook_min) || 0) <= 5;

  /** Active nutrient terms for the objective. */
  function terms(targets) {
    const out = [];
    for (const n of Z.NUTRIENTS) {
      const t = targets[n.key] || {};
      if (t.enabled === false || !t.target || n.kind === "info") continue;
      let w = Number(t.weight || n.weight || 1) * (SUPPLEMENT_EXPECTED[n.key] ?? 1);
      const ul = n.ul && n.ul_scope === "total" ? n.ul : 0;
      if (w <= 0 && !ul) continue;
      out.push({ key: n.key, kind: n.kind, T: Number(t.target), w: Math.max(0, w), ul });
    }
    return out;
  }

  function termCost(tm, x) {
    let c = 0;
    const T = tm.T, w = tm.w;
    if (w > 0) {
      if (tm.kind === "min") {
        const s = T - x;
        if (s > 0) c += s <= DEEP_TIER * T ? w * s / T : w * (DEEP_TIER + DEEP_WEIGHT * (s / T - DEEP_TIER));
      } else if (tm.kind === "macro") c += w * Math.abs(x - T) / T;
      else if (tm.kind === "limit" && x > T) c += LIMIT_WEIGHT * w * (x - T) / T;
    }
    if (tm.ul && x > tm.ul) c += UL_PENALTY * (x - tm.ul) / tm.ul;
    return c;
  }

  /**
   * Solve one day.
   * p = { per: [[...m]] per-serving values per recipe for each term, terms, base: [m],
   *       mx: [n] max half-servings, cat: [n] category index, catLo/catHi: [c] (servings),
   *       minDistinct, maxDistinct, reqH: [n] min half-servings, cuts: [{idx:[...], max}],
   *       useCost, seed, timeMs }
   * returns { h: [n] half-servings, cost, feasible } or null
   */
  function solveDay(p) {
    const n = p.mx.length, m = p.terms.length, C = p.catLo.length;
    const rand = rng(p.seed || 1);
    const per = p.per;  // n x m
    const half = per.map(row => row.map(v => v * 0.5));
    const catHasAny = new Array(C).fill(false);
    for (let i = 0; i < n; i++) if (p.mx[i] > 0) catHasAny[p.cat[i]] = true;
    const live = [];
    for (let i = 0; i < n; i++) if (p.mx[i] > 0) live.push(i);
    if (!live.length) return null;
    const minD = Math.min(p.minDistinct, live.length), maxD = Math.max(p.maxDistinct, 1);
    const cutSets = (p.cuts || []).map(c => ({ mark: (() => { const a = new Uint8Array(n); c.idx.forEach(i => a[i] = 1); return a; })(), max: c.max }));

    const x = new Float64Array(m);
    const h = new Int32Array(n);
    const catH = new Int32Array(C);   // half-servings per category
    let distinct = 0;

    function objective() {
      let c = 0;
      for (let k = 0; k < m; k++) c += termCost(p.terms[k], x[k]);
      return c + p.useCost * distinct;
    }
    function violation() {
      let v = 0;
      for (let c = 0; c < C; c++) {
        if (!catHasAny[c]) continue;
        const s = catH[c] * 0.5;
        if (s < p.catLo[c]) v += p.catLo[c] - s;
        if (s > p.catHi[c]) v += s - p.catHi[c];
      }
      if (distinct < minD) v += minD - distinct;
      if (distinct > maxD) v += distinct - maxD;
      for (let i = 0; i < n; i++) if (h[i] < p.reqH[i]) v += (p.reqH[i] - h[i]) * 0.5 + 1;
      for (const cs of cutSets) {
        let used = 0;
        for (let i = 0; i < n; i++) if (h[i] > 0 && cs.mark[i]) used++;
        if (used > cs.max) v += used - cs.max;
      }
      return v;
    }
    const total = () => objective() + PEN * violation();

    function apply(i, d) {     // change recipe i by d half-servings
      const before = h[i];
      h[i] += d;
      const row = half[i];
      for (let k = 0; k < m; k++) x[k] += d * row[k];
      catH[p.cat[i]] += d;
      if (before === 0 && h[i] > 0) distinct++;
      else if (before > 0 && h[i] === 0) distinct--;
    }
    function reset() {
      for (let k = 0; k < m; k++) x[k] = p.base[k];
      h.fill(0); catH.fill(0); distinct = 0;
    }

    function tryMove(cur, ops) {   // ops: [[i,d],...]; keeps it if it improves
      for (const [i, d] of ops) { if (h[i] + d < 0 || h[i] + d > p.mx[i]) return cur; }
      for (const [i, d] of ops) apply(i, d);
      const v = total();
      if (v < cur - 1e-9) return v;
      for (let q = ops.length - 1; q >= 0; q--) apply(ops[q][0], -ops[q][1]);
      return cur;
    }

    function descend(cur) {
      let improved = true;
      while (improved) {
        improved = false;
        const order = live.slice().sort(() => rand() - 0.5);
        for (const i of order) {
          for (const d of [1, -1, 2, -2]) {
            const v = tryMove(cur, [[i, d]]);
            if (v < cur) { cur = v; improved = true; }
          }
          for (const j of live) {
            if (j === i) continue;
            if (h[i] > 0) {
              let v = tryMove(cur, [[i, -1], [j, 1]]);
              if (v < cur) { cur = v; improved = true; continue; }
              const all = h[i];
              if (h[j] + all <= p.mx[j]) {
                v = tryMove(cur, [[i, -all], [j, all]]);
                if (v < cur) { cur = v; improved = true; }
              }
            }
          }
        }
      }
      return cur;
    }

    function construct() {
      reset();
      // meet category minimums with random recipes, then sprinkle a couple more
      for (let c = 0; c < C; c++) {
        if (!catHasAny[c] || p.catLo[c] <= 0) continue;
        const opts = live.filter(i => p.cat[i] === c);
        let need = Math.round(p.catLo[c] * 2), guard = 50;
        while (need > 0 && guard--) {
          const i = opts[Math.floor(rand() * opts.length)];
          if (h[i] < p.mx[i]) { apply(i, 1 + (rand() < 0.5 && h[i] + 2 <= p.mx[i] && need > 1 ? 1 : 0)); need = Math.round(p.catLo[c] * 2) - catH[c]; }
        }
      }
      for (let i = 0; i < n; i++) if (h[i] < p.reqH[i]) apply(i, p.reqH[i] - h[i]);
      const extra = 1 + Math.floor(rand() * 3);
      for (let e = 0; e < extra; e++) {
        const i = live[Math.floor(rand() * live.length)];
        if (h[i] < p.mx[i]) apply(i, 1);
      }
      return total();
    }

    const deadline = now() + (p.timeMs || 150);
    let best = null, bestH = null, bestFeas = false;
    const restarts = p.restarts || 12;
    for (let r = 0; r < restarts || (!bestFeas && now() < deadline); r++) {
      let cur = descend(construct());
      // iterated local search: kick and re-descend
      for (let it = 0; it < (p.kicks || 25); it++) {
        if (now() > deadline && bestFeas) break;
        const saveH = Array.from(h), saveCur = cur;
        const k = 2 + Math.floor(rand() * 3);
        for (let q = 0; q < k; q++) {
          const i = live[Math.floor(rand() * live.length)];
          const d = rand() < 0.5 ? -h[i] : 1 + Math.floor(rand() * 2);
          if (h[i] + d >= 0 && h[i] + d <= p.mx[i] && d !== 0) apply(i, d);
        }
        cur = descend(total());
        if (cur > saveCur - 1e-9) {   // worse: restore
          reset(); saveH.forEach((v, i) => { if (v) apply(i, v); }); cur = saveCur;
        }
      }
      const feas = violation() < 1e-9;
      if (best === null || (feas && !bestFeas) || (feas === bestFeas && cur < best - 1e-9)) {
        best = cur; bestH = Array.from(h); bestFeas = feas;
      }
      if (now() > deadline && bestFeas && r >= 2) break;
      if (r > restarts * 6) break;
    }
    if (!bestFeas) return { h: bestH, cost: best, feasible: false };
    reset(); bestH.forEach((v, i) => { if (v) apply(i, v); });
    return { h: bestH, cost: objective(), feasible: true };
  }

  // ---------------- helpers shared by day & week planning ----------------
  function prepare(recipes, ingById, exclude) {
    const ex = new Set(exclude || []);
    const out = [];
    for (const r of recipes) {
      if (ex.has(r.id)) continue;
      const nut = Z.recipeNutrition(r, ingById);
      if (nut.total_grams > 0) out.push({ r, nut });
    }
    return out;
  }

  function baseProblem(prepared, targets, supplements, structure) {
    const tms = terms(targets);
    const supp = Z.supplementTotals(supplements);
    const cats = Object.keys(structure);
    const catIndex = Object.fromEntries(cats.map((c, i) => [c, i]));
    const extraCats = [];
    for (const { r } of prepared) if (!(r.category in catIndex)) { catIndex[r.category] = cats.length + extraCats.length; extraCats.push(r.category); }
    const allCats = cats.concat(extraCats);
    return {
      terms: tms,
      base: tms.map(t => supp[t.key] || 0),
      per: prepared.map(({ nut }) => tms.map(t => nut.per_serving[t.key] || 0)),
      cat: prepared.map(({ r }) => catIndex[r.category]),
      catLo: allCats.map(c => structure[c] ? Number(structure[c][0]) : 0),
      catHi: allCats.map(c => structure[c] ? Number(structure[c][1]) : 99),
      maxH: prepared.map(({ r }) => Math.round(2 * (Number(r.max_per_day) || 2))),
      supp,
    };
  }

  function summarize(items, byId, supp, targets) {
    const trip = items.map(it => { const { nut } = byId[it.recipe_id]; return [nut.per_serving, nut.missing, it.servings]; });
    const [food, missing] = Z.combine(trip);
    const rows = Z.evaluate(food, supp, targets, missing);
    return { rows, score: Z.score(rows) };
  }

  function itemsFrom(h, prepared) {
    const items = [];
    h.forEach((v, i) => {
      if (v > 0) { const r = prepared[i].r; items.push({ recipe_id: r.id, name: r.name, category: r.category, servings: v / 2 }); }
    });
    return items;
  }

  // ---------------- day ideas ----------------
  function bestDays(recipes, ingById, targets, supplements, structure, opts = {}) {
    const n = opts.n || 5, minNew = opts.min_new || 1;
    const require = new Set(opts.require || []);
    const prepared = prepare(recipes, ingById, opts.exclude);
    if (!prepared.length) return { combos: [], message: "No recipes with ingredients yet." };
    const bp = baseProblem(prepared, targets, supplements, structure);
    const byId = Object.fromEntries(prepared.map(p => [p.r.id, p]));
    const combos = [], cuts = [];
    for (let c = 0; c < n; c++) {
      const sol = solveDay({
        per: bp.per, terms: bp.terms, base: bp.base, mx: bp.maxH, cat: bp.cat, catLo: bp.catLo, catHi: bp.catHi,
        minDistinct: opts.min_distinct ?? 3, maxDistinct: opts.max_distinct ?? 6,
        reqH: prepared.map(({ r }, i) => require.has(r.id) ? Math.min(2, bp.maxH[i]) : 0),
        cuts: cuts.map(u => ({ idx: u, max: u.length - minNew })),
        useCost: 0.002, seed: 7919 * (c + 1), timeMs: opts.timeMs || 250, restarts: 10, kicks: 30,
      });
      if (!sol || !sol.feasible) break;
      const used = []; sol.h.forEach((v, i) => { if (v > 0) used.push(i); });
      cuts.push(used);
      const items = itemsFrom(sol.h, prepared);
      const { rows, score } = summarize(items, byId, bp.supp, targets);
      combos.push({ items, rows, score, cost: sol.cost });
    }
    let message = null;
    if (!combos.length) message = require.size
      ? "No day fits around the dish you picked. Check that its category limits in Settings allow it (e.g. Breakfast at most 1), or pick a different dish."
      : "No combination fits the meal-structure rules. Loosen the per-category servings in Settings or add recipes to the missing categories.";
    combos.sort((a, b) => b.score - a.score);
    return { combos, message };
  }

  // ---------------- week planning ----------------
  function offsetsFor(week) {
    const s = DAY_NAMES.indexOf(week.start_day || "Monday");
    const startIdx = s < 0 ? 1 : s;
    const prepIdx = Math.max(0, DAY_NAMES.indexOf(week.prep_day || "Sunday"));
    const first = ((startIdx - prepIdx) % 7 + 7) % 7;
    return { startIdx, offsets: [0, 1, 2, 3, 4, 5, 6].map(d => first + d) };
  }
  const freshOn = (r, offset) => r.freezes || offset <= (Number(r.fridge_days) || 4);

  function combinations(arr, k, cb) {
    const pick = [];
    (function rec(start) {
      if (pick.length === k) { cb(pick.slice()); return; }
      for (let i = start; i <= arr.length - (k - pick.length); i++) { pick.push(arr[i]); rec(i + 1); pick.pop(); }
    })(0);
  }

  /**
   * Returns several alternative weeks, each built from a small set of dishes to cook.
   * { options: [week], recommended: index, message }
   */
  function planWeek(recipes, ingById, targets, supplements, structure, week, opts = {}) {
    const require = new Set(opts.require || []);
    const prepared = prepare(recipes, ingById, opts.exclude);
    if (!prepared.length) return { options: [], message: "No recipes with ingredients yet." };
    const bp = baseProblem(prepared, targets, supplements, structure);
    const byId = Object.fromEntries(prepared.map(p => [p.r.id, p]));
    const { startIdx, offsets } = offsetsFor(week);
    const minD = Number(week.min_distinct) || 3, maxD = Number(week.max_distinct) || 6;
    const staples = [], cook = [];
    prepared.forEach((p, i) => (isStaple(p.r) ? staples : cook).push(i));
    const reqCook = cook.filter(i => require.has(prepared[i].r.id));
    let kHi = Math.min(Number(week.max_recipes) || 4, cook.length);
    const kLo = Math.max(1, Math.min(Number(week.min_recipes) || 3, kHi), reqCook.length);
    kHi = Math.max(kHi, kLo);
    const perSize = opts.sets_per_size || 3;
    const t0 = now();

    // quick score of a set: one "typical fridge day" and one "late-week" day, cheap search
    const dayCache = new Map();
    function solveWeekDay(setIdx, d, quality) {
      const allowed = new Set(setIdx.concat(staples));
      const avail = prepared.map((p, i) => allowed.has(i) && freshOn(p.r, offsets[d]));
      const key = quality + "|" + avail.map(a => a ? 1 : 0).join("") + "|" + (opts.require || []).join(",") + "|" + (d < 3 ? "early" : "late");
      if (dayCache.has(key)) return dayCache.get(key);
      const reqH = prepared.map(({ r }, i) => {
        if (!require.has(r.id) || !avail[i]) return 0;
        // dishes you build around: on the first 3 days they're available
        const freshDays = offsets.map((o, dd) => freshOn(r, o) ? dd : -1).filter(x => x >= 0);
        return freshDays.slice(0, 3).includes(d) ? 1 : 0;
      });
      const sol = solveDay({
        per: bp.per, terms: bp.terms, base: bp.base, mx: bp.maxH.map((v, i) => avail[i] ? v : 0), cat: bp.cat,
        catLo: bp.catLo, catHi: bp.catHi, minDistinct: minD, maxDistinct: maxD, reqH, cuts: [], useCost: 0.001,
        seed: 1009 + d, timeMs: quality === "fast" ? 6 : 120, restarts: quality === "fast" ? 1 : 8, kicks: quality === "fast" ? 2 : 25,
      });
      dayCache.set(key, sol);
      return sol;
    }
    function setFeasible(setIdx) {
      const allowed = setIdx.concat(staples);
      for (let d = 0; d < 7; d++) {
        for (let c = 0; c < bp.catLo.length; c++) {
          if (bp.catLo[c] <= 0) continue;
          const anyInCat = prepared.some((p, i) => bp.cat[i] === c);
          if (!anyInCat) continue;
          const cap = allowed.filter(i => bp.cat[i] === c && freshOn(prepared[i].r, offsets[d])).reduce((a, i) => a + bp.maxH[i] / 2, 0);
          if (cap < bp.catLo[c]) return false;
        }
      }
      return true;
    }
    function quickScore(setIdx) {
      // late-week day (freezer only) and an early day; average their costs
      const a = solveWeekDay(setIdx, 0, "fast"), b = solveWeekDay(setIdx, 6, "fast");
      if (!a || !b || !a.feasible || !b.feasible) return Infinity;
      return (a.cost * 4 + b.cost * 3) / 7;
    }

    const options = [], seen = new Set();
    const pool = cook.filter(i => !reqCook.includes(i));
    const nChoose = need => { let c = 1; for (let q = 0; q < need; q++) c = c * (pool.length - q) / (q + 1); return c; };
    // beam search shared across sizes for big cookbooks: grow the best partial sets one dish at a time
    const beams = {};
    if (nChoose(kHi - reqCook.length) > 800) {
      let beam = [reqCook.slice()];
      for (let size = reqCook.length + 1; size <= kHi; size++) {
        const next = new Map();
        for (const b of beam) for (const i of pool) {
          if (b.includes(i)) continue;
          const s = b.concat(i).sort((x, y) => x - y);
          next.set(s.join(","), s);
        }
        beam = [...next.values()].map(s => [s, quickScore(s)]).sort((x, y) => x[1] - y[1]).slice(0, 14).map(x => x[0]);
        beams[size] = beam;
      }
    }
    for (let K = kLo; K <= kHi; K++) {
      const need = K - reqCook.length;
      if (need < 0 || need > pool.length) continue;
      let cands = [];
      if (beams[K]) cands = beams[K].filter(setFeasible);
      else combinations(pool, need, c => { const s = reqCook.concat(c); if (setFeasible(s)) cands.push(s); });
      const ranked = cands.map(s => [s, quickScore(s)]).filter(x => isFinite(x[1])).sort((x, y) => x[1] - y[1]);
      let taken = 0;
      for (const [setIdx] of ranked) {
        if (taken >= perSize) break;
        const opt = layoutWeek(setIdx);
        if (!opt) continue;
        const key = opt.prep_set.slice().sort().join(",");
        if (seen.has(key)) continue;
        seen.add(key); options.push(opt); taken++;
      }
    }
    function layoutWeek(setIdx) {
      const days = [], allRows = [];
      for (let d = 0; d < 7; d++) {
        const sol = solveWeekDay(setIdx, d, "full");
        if (!sol || !sol.feasible) return null;
        const items = itemsFrom(sol.h, prepared);
        for (const it of items) {
          const r = byId[it.recipe_id].r;
          it.source = offsets[d] <= (Number(r.fridge_days) || 4) ? "fridge" : "freezer";
        }
        const { rows, score } = summarize(items, byId, bp.supp, targets);
        allRows.push(rows);
        days.push({ day: DAY_NAMES[(startIdx + d) % 7], offset: offsets[d], items, rows, score });
      }
      const average = Z.averageRows(allRows);
      const used = new Set(days.flatMap(d => d.items.map(it => it.recipe_id)));
      const prepSet = setIdx.map(i => prepared[i].r.id).filter(id => used.has(id));
      return { days, average, score: Z.score(average), prep_set: prepSet, n_dishes: prepSet.length, message: null };
    }
    if (!options.length) return { options: [], message:
      "Couldn't build a week from this few dishes. Allow more dishes to cook, add recipes that freeze well, or loosen the per-category servings in Settings. A week also needs recipes in every category with a minimum (e.g. at least one Breakfast)." };
    options.sort((a, b) => a.n_dishes - b.n_dishes || b.score - a.score);
    const best = Math.max(...options.map(o => o.score));
    const recommended = options.findIndex(o => o.score >= best - 2);
    return { options, recommended, message: null, ms: Math.round(now() - t0) };
  }

  /** Re-evaluate a (possibly hand-edited) week. */
  function rescoreWeek(days, recipesById, ingById, targets, supplements) {
    const supp = Z.supplementTotals(supplements);
    const out = [], allRows = [];
    for (const d of days) {
      const items = [], trip = [];
      for (const it0 of d.items) {
        const r = recipesById[it0.recipe_id];
        const sv = Number(it0.servings) || 0;
        if (!r || sv <= 0) continue;
        const nut = Z.recipeNutrition(r, ingById);
        trip.push([nut.per_serving, nut.missing, sv]);
        const source = (d.offset || 0) <= (Number(r.fridge_days) || 4) ? "fridge" : "freezer";
        const it = { recipe_id: r.id, name: r.name, category: r.category, servings: sv, source };
        if (source === "freezer" && !r.freezes) it.warning = "Doesn't freeze well - past its fridge life on this day";
        items.push(it);
      }
      const [food, missing] = Z.combine(trip);
      const rows = Z.evaluate(food, supp, targets, missing);
      allRows.push(rows);
      out.push({ day: d.day, offset: d.offset, items, rows, score: Z.score(rows) });
    }
    if (!out.length) return { days: [] };
    const average = Z.averageRows(allRows);
    return { days: out, average, score: Z.score(average) };
  }

  /** Objective of a given day (for tests / comparisons). */
  function dayObjective(items, prepared, targets, supplements) {
    const tms = terms(targets), supp = Z.supplementTotals(supplements);
    const x = tms.map(t => supp[t.key] || 0);
    const byId = Object.fromEntries(prepared.map(p => [p.r.id, p]));
    for (const it of items) { const nut = byId[it.recipe_id].nut; tms.forEach((t, k) => { x[k] += it.servings * (nut.per_serving[t.key] || 0); }); }
    return tms.reduce((a, t, k) => a + termCost(t, x[k]), 0);
  }

  Object.assign(Z, { DAY_NAMES, isStaple, solveDay, bestDays, planWeek, rescoreWeek, dayObjective, prepareRecipes: prepare });
})(globalThis.Z = globalThis.Z || {});
