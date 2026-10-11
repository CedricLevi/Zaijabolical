// Planner speed with a bigger cookbook (40 recipes). Phones are roughly 3x slower than this machine.
const Z = require("./load");
const fx = require("./fixtures/starter.json");
const ingById = Object.fromEntries(fx.ingredients.map(i => [i.id, i]));
const S = fx.settings;
const recipes = [];
let k = 0;
while (recipes.length < 40) for (const r of fx.recipes) {
  if (recipes.length >= 40) break;
  const f = 0.8 + ((k * 37) % 9) / 20;
  recipes.push({ ...r, id: r.id + "-" + k, name: r.name + " v" + k, ingredients: r.ingredients.map((l, j) => ({ ...l, amount: l.amount * (j % 2 ? f : 2 - f) })) });
  k++;
}
let t = Date.now();
const bd = Z.bestDays(recipes, ingById, S.targets, [], S.structure, { n: 6 });
console.log(`40 recipes: 6 day ideas in ${Date.now() - t} ms (scores ${bd.combos.map(c => c.score)})`);
t = Date.now();
const wk = Z.planWeek(recipes, ingById, S.targets, [], S.structure, S.week, {});
console.log(`40 recipes: ${wk.options.length} week options in ${Date.now() - t} ms (scores ${wk.options.map(o => o.n_dishes + ":" + o.score)})`);
