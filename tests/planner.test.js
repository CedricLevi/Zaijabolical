const assert = require("assert");
const Z = require("./load");
const fx = require("./fixtures/starter.json");
const ref = require("./fixtures/expected_planner.json");
const ingById = Object.fromEntries(fx.ingredients.map(i => [i.id, i]));
const recipes = fx.recipes.filter(r => r.active);
const S = fx.settings;
const prepared = Z.prepareRecipes(recipes, ingById);
const obj = items => Z.dayObjective(items, prepared, S.targets, []);

let t = Date.now();
const bd = Z.bestDays(recipes, ingById, S.targets, [], S.structure, { n: 5 });
const tDays = Date.now() - t;
const jsBest = Math.min(...bd.combos.map(c => obj(c.items)));
const pyBest = Math.min(...ref.days.map(obj));
console.log(`day ideas: ${bd.combos.length} combos in ${tDays} ms; best objective JS ${jsBest.toFixed(4)} vs HiGHS ${pyBest.toFixed(4)}; scores`, bd.combos.map(c => c.score), "py", ref.days_scores);
assert(bd.combos.length === 5);
assert(jsBest <= pyBest * 1.03 + 0.01, "JS should be within 3% of the HiGHS optimum");
// rules respected
for (const c of bd.combos) {
  const cat = k => c.items.filter(i => i.category === k).reduce((a, i) => a + i.servings, 0);
  assert(cat("Breakfast") === 1, "1 breakfast");
  assert(cat("Main") >= 2 && cat("Main") <= 3, "2-3 mains");
  assert(c.items.length >= 3 && c.items.length <= 6);
  const se = c.rows.find(r => r.key === "selenium"); assert(se.total <= 400);
}
const sets = bd.combos.map(c => c.items.map(i => i.recipe_id).sort().join());
assert.strictEqual(new Set(sets).size, sets.length, "distinct ideas");

// anchors
t = Date.now();
const bd2 = Z.bestDays(recipes, ingById, S.targets, [], S.structure, { n: 3, require: [ref.chili] });
console.log(`anchored ideas in ${Date.now() - t} ms`);
for (const c of bd2.combos) assert(c.items.some(i => i.recipe_id === ref.chili && i.servings >= 1));

// week
t = Date.now();
const wk = Z.planWeek(recipes, ingById, S.targets, [], S.structure, S.week, {});
const tWeek = Date.now() - t;
console.log(`week: ${wk.options.length} options in ${tWeek} ms:`, wk.options.map(o => [o.n_dishes, o.score, o.prep_set.map(id => fx.recipes.find(r => r.id === id).name.slice(0, 18))]), "rec", wk.recommended);
console.log("python week:", ref.week.map(o => [o.n, o.score]));
assert(wk.options.length >= 3);
const rById = Object.fromEntries(fx.recipes.map(r => [r.id, r]));
for (const o of wk.options) {
  assert(o.n_dishes >= 3 && o.n_dishes <= 4);
  for (const d of o.days) for (const it of d.items) {
    const r = rById[it.recipe_id];
    if (!r.freezes) assert(d.offset <= r.fridge_days, `${r.name} on ${d.day}`);
  }
}
const jsWeekBest = Math.max(...wk.options.map(o => o.score)), pyWeekBest = Math.max(...ref.week.map(o => o.score));
assert(jsWeekBest >= pyWeekBest - 1.5, `week coverage JS ${jsWeekBest} vs Python ${pyWeekBest}`);

// anchored week
const wk2 = Z.planWeek(recipes, ingById, S.targets, [], S.structure, S.week, { require: [ref.chili] });
assert(wk2.options.length);
for (const o of wk2.options) {
  assert(o.prep_set.includes(ref.chili));
  assert(o.days.filter(d => d.items.some(i => i.recipe_id === ref.chili)).length >= 3);
}
// exactly-3 dishes
const wk3 = Z.planWeek(recipes, ingById, S.targets, [], S.structure, { ...S.week, min_recipes: 3, max_recipes: 3 }, {});
assert(wk3.options.length && wk3.options.every(o => o.n_dishes === 3));

// prep sheet consistency
const prep = Z.buildPrep(wk.options[0].days, rById, ingById);
const need = prep.batches.reduce((a, b) => a + b.servings_needed, 0);
const planned = wk.options[0].days.reduce((a, d) => a + d.items.reduce((x, i) => x + i.servings, 0), 0);
assert(Math.abs(need - planned) < 1e-9 && prep.shopping.length);
console.log("planner ok");
