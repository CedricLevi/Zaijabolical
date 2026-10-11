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
