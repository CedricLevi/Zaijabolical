// Vegan check for pantry items (name, USDA description, package ingredient list; homemade items follow their recipe).
const assert = require("node:assert");
globalThis.DecompressionStream = globalThis.DecompressionStream || class {};
require("../js/cookbook.js");
const V = Z.cookbook.pantryVegan;
const st = i => V(i).status;
const usda = (description, extra = {}) => ({ name: description, usda_description: description, data_type: "SR Legacy", source: "usda", ...extra });
const brand = (name, ingredients_text) => ({ name, data_type: "Branded", source: "usda", ingredients_text });

// whole foods
assert.strictEqual(st(usda("Soymilk, original, unfortified")), "likely");
assert.strictEqual(st(usda("Nuts, coconut milk, canned")), "likely");
assert.strictEqual(st(usda("Peanut butter, smooth style")), "likely");
assert.strictEqual(st(usda("Eggplant, raw")), "likely");
assert.strictEqual(st(usda("Cheese, cheddar")), "no");
assert.strictEqual(st(usda("Honey")), "no");
assert.strictEqual(st(usda("Egg, whole, raw")), "no");
// brand-name products: the ingredient list decides
assert.strictEqual(st(brand("Protein bar", "Soy protein isolate, sugar, whey protein concentrate")), "no");
assert.strictEqual(st(brand("Gummies", "Glucose syrup, sugar, gelatin, carmine")), "no");
assert.strictEqual(st(brand("Milk chocolate", "Sugar, cocoa butter, whole milk powder")), "no");
assert.strictEqual(st(brand("Dark chocolate", "Cocoa mass, sugar, cocoa butter, soy lecithin")), "likely");
assert.strictEqual(st(brand("Oat milk", "Oats, water, calcium carbonate, vitamin D3, salt")), "check");
assert.strictEqual(st(brand("Oat milk", "Oats, water, vitamin D3 (from lichen)")), "likely");
assert.strictEqual(st(brand("Veggie burger", "Pea protein, coconut oil, natural flavors")), "check");
assert.strictEqual(st({ name: "Nutritional yeast", data_type: "Branded", source: "usda" }), "check");   // no ingredient list
assert.strictEqual(st({ name: "Tempeh", source: "manual" }), "check");   // typed from a label
// your own check wins
assert.strictEqual(st({ ...brand("Oat milk", "vitamin D3"), vegan: "yes" }), "yes");
assert.strictEqual(st({ ...usda("Tofu"), vegan: "no" }), "no");
// homemade items take the worst status of their recipe's ingredients
const ing = { a: { id: "a", ...usda("Carrots, raw") }, b: { id: "b", ...brand("Stock cube", "Salt, yeast extract, natural flavors") },
  c: { id: "c", ...usda("Butter, salted") } };
const rec = { r1: { id: "r1", ingredients: [{ ingredient_id: "a" }, { ingredient_id: "b" }] }, r2: { id: "r2", ingredients: [{ ingredient_id: "a" }, { ingredient_id: "c" }] } };
assert.strictEqual(V({ id: "h1", name: "Broth", from_recipe: "r1" }, ing, rec).status, "check");
const v2 = V({ id: "h2", name: "Sauce", from_recipe: "r2" }, ing, rec);
assert.strictEqual(v2.status, "no"); assert.ok(/Butter/.test(v2.reasons[0]), v2.reasons);
console.log("vegan check ok");
