const assert = require("assert");
const Z = require("./load");
const fx = require("./fixtures/starter.json");
const exp = require("./fixtures/expected_core.json");
const ingById = Object.fromEntries(fx.ingredients.map(i => [i.id, i]));
let n = 0;
for (const r of fx.recipes) {
  const per = Z.recipeNutrition(r, ingById).per_serving;
  for (const [k, v] of Object.entries(exp.nutrition[r.id])) {
    assert(Math.abs(per[k] - v) < 1e-6 * Math.max(1, Math.abs(v)), `${r.name} ${k}: ${per[k]} vs ${v}`); n++;
  }
}
const recipes = exp.eval_items.map(id => fx.recipes.find(r => r.id === id));
const trip = recipes.map(r => { const x = Z.recipeNutrition(r, ingById); return [x.per_serving, x.missing, 1]; });
const [food, miss] = Z.combine(trip);
const rows = Z.evaluate(food, Z.supplementTotals([{ name: "B12", nutrients: { b12: 50 } }]), fx.settings.targets, miss);
assert.strictEqual(Z.score(rows), exp.eval_score);
assert.deepStrictEqual(Z.recommendations(rows).map(a => a.title), exp.eval_advice);
// usda parsing
const out = Z.parseUsdaNutrients([{ nutrientId: 1003, value: 10 }, { nutrientId: 1008, value: 2000, unitName: "KJ" },
  { nutrientId: 1110, value: 400 }, { nutrientId: 1278, value: 0.1 }, { nutrientId: 1272, value: 0.2 }]);
assert(out.protein === 10 && !("kcal" in out) && Math.abs(out.vit_d - 10) < 1e-9 && Math.abs(out.epa_dha - 300) < 1e-6);
console.log(`core ok (${n} nutrient values match Python)`);

// amino acids: parsed by number or name, protein quality vs. the WHO pattern
const aa = Z.parseUsdaNutrients([{ nutrient: { number: "505", name: "Lysine" }, amount: 0.6 }, { nutrientName: "Methionine", value: 0.1 },
  { number: "203", name: "Protein", amount: 10 }]);
assert(aa.aa_lys === 0.6 && aa.aa_met === 0.1 && aa.protein === 10, JSON.stringify(aa));
const pattern = { aa_his: .15, aa_ile: .30, aa_leu: .59, aa_lys: .45, aa_met: .11, aa_cys: .11, aa_phe: .19, aa_tyr: .19, aa_thr: .23, aa_trp: .06, aa_val: .39 };
const perfect = Z.aminoFromGrams([[{ nutrients: { protein: 10, ...pattern } }, 100]]);
assert(perfect.acids.every(a => Math.abs(a.quality - 100) < 1e-6) && perfect.score === 100 && perfect.coverage === 1);
const grain = Z.aminoFromGrams([[{ nutrients: { protein: 10, ...pattern, aa_lys: .30 } }, 100], [{ nutrients: { protein: 5 } }, 100]]);
assert(grain.limiting === "lys" && Math.abs(grain.score - 30 / 45 * 100) < 1e-6 && Math.abs(grain.coverage - 2 / 3) < 1e-9);

// prep-day schedule: long cooks start first and overlap with the next dish's prep
const sch = Z.buildSchedule([
  { recipe_id: "a", name: "Rice", prep_min: 5, cook_min: 45, minutes: 50, multiplier: 1, fridge_servings: 4, freezer_servings: 0 },
  { recipe_id: "b", name: "Stew", prep_min: 20, cook_min: 30, minutes: 50, multiplier: 1, fridge_servings: 3, freezer_servings: 3 },
  { recipe_id: "c", name: "Milk", prep_min: 0, cook_min: 0, minutes: 0, multiplier: 1, fridge_servings: 7, freezer_servings: 0 }]);
assert.deepStrictEqual(sch.steps.map(s => [s.name, s.at]), [["Rice", 0], ["Stew", 5]]);
assert.strictEqual(sch.total, 55 + 11);          // stew done at 55, then 5 + 3×2 min to pack
assert.strictEqual(sch.hands_on, 5 + 20 + 11);
assert.strictEqual(sch.pack.fridge, 7);          // no-cook staples aren't packed

// tracker: 5 good days make a good week; 4 good weeks in a month make a sticker
const T = Z.tracker, logs = [];
const start = T.weekStart("2026-10-12", "Monday");
assert.strictEqual(start, "2026-10-12");
assert.strictEqual(T.weekStart("2026-10-18", "Monday"), "2026-10-12");
assert.strictEqual(T.weekMonth("2026-09-28"), "2026-10");   // most of that week is in October
for (const ws of ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"])
  for (let d = 0; d < 7; d++) logs.push({ date: T.addDays(ws, d), score: d < 5 ? 90 : 50, eaten: 2 });
for (let d = 0; d < 4; d++) logs.push({ date: T.addDays("2026-09-28", d), score: d < 4 ? 86 : 0, eaten: 2 });
logs.push({ date: "2026-10-01", score: 99, eaten: 0 });       // nothing eaten: ignored
const sm = T.summarize(logs, { today: "2026-10-01", startDay: "Monday" });
assert.deepStrictEqual(sm.stickers, ["2026-09"]);
assert.strictEqual(sm.months["2026-09"], 4);
assert.strictEqual(sm.current.goodWeeks, 0);
assert.strictEqual(sm.current.needDays, 1);
assert.strictEqual(sm.current.daysLeft, 4);   // Thu–Sun
assert.strictEqual(sm.current.stillPossible, true);
console.log("amino, schedule & tracker ok");

// homemade pantry items: a recipe used as an ingredient
{
  const ing = { veg: { id: "veg", nutrients: { kcal: 40, protein: 1 }, portions: [{ label: "cup", grams: 128 }] },
    bean: { id: "bean", nutrients: { kcal: 100, protein: 5 }, portions: [] } };
  const broth = { servings: 4, ingredients: [{ ingredient_id: "veg", amount: 2, unit: "cup" }, { ingredient_id: "bean", amount: 100, unit: "g" },
    { ingredient_id: null, name: "water", amount: 6, unit: "cups", ignore: true }] };
  assert.strictEqual(Z.recipeYieldGuess(broth, ing), 256 + 100 + 1440);   // water counts toward the batch weight
  const d = Z.recipeAsIngredient(broth, ing, 1200);
  assert.ok(Math.abs(d.nutrients.kcal - (102.4 + 100) / 1200 * 100) < 1e-3, d.nutrients.kcal);
  assert.ok(Math.abs(d.nutrients.protein - (2.56 + 5) / 1200 * 100) < 1e-3);
  assert.deepStrictEqual(d.portions.slice(0, 2).map(p => [p.label, p.grams]), [["serving", 300], ["batch", 1200]]);
  // a nutrient only some ingredients have stays unknown rather than being undercounted
  ing.veg.nutrients.aa_lys = 0.05;
  assert.ok(!("aa_lys" in Z.recipeAsIngredient(broth, ing, 1200).nutrients));
  // used in another recipe, it adds up like any pantry item
  ing.home = { id: "home", nutrients: d.nutrients, portions: d.portions };
  const soup = { servings: 2, ingredients: [{ ingredient_id: "home", amount: 2, unit: "cup" }] };
  assert.ok(Math.abs(Z.recipeNutrition(soup, ing).per_serving.kcal - d.nutrients.kcal * 480 / 100 / 2) < 1e-6);
}
console.log("homemade pantry items ok");
