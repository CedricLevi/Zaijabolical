"""Checks the cookbook reader on the test books in very different layouts (tests/make_books.py builds them).
Run: python tests/cookbook_test.py"""
import os, http.server, threading, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8778), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
EXPECT = {
    "tagged.epub": {"titles": ["Smoky Black Bean Soup", "Peanut Tofu Noodles", "Lemony Lentil Salad", "Honey Butter Carrots"],
                    "photos": {"Smoky Black Bean Soup": "p0.jpg", "Peanut Tofu Noodles": "p1.jpg"}, "nonvegan": ["Honey Butter Carrots"],
                    "servings": {"Lemony Lentil Salad": 6}, "categories": {"Smoky Black Bean Soup": "Main", "Lemony Lentil Salad": "Side"}},
    "headings.epub": {"titles": ["Overnight Oats with Berries", "Chickpea Scramble"], "photos": {"Overnight Oats with Berries": "b0.jpg", "Chickpea Scramble": "b1.jpg"},
                      "times": {"Chickpea Scramble": (5, 10)}, "categories": {"Overnight Oats with Berries": "Breakfast"}},
    "plain.epub": {"titles": ["Green Tahini Sauce", "Quick Pickled Onions"], "ai": 1, "categories": {"Green Tahini Sauce": "Add-on"}},
    "microdata.epub": {"titles": ["Baked Sweet Potato Fries"], "servings": {"Baked Sweet Potato Fries": 3}},
    "book.pdf": {"titles": ["Roasted Chickpea Wraps", "Coconut Red Lentil Curry"], "photos": {"Roasted Chickpea Wraps": "pdf:2:", "Coconut Red Lentil Curry": "pdf:4:"},
                 "servings": {"Coconut Red Lentil Curry": 6}, "categories": {"Roasted Chickpea Wraps": "Main"}},
}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://127.0.0.1:8778/tests/cookbook_harness.html")
    for f, exp in EXPECT.items():
        r = pg.evaluate(f"analyse('tests/fixtures/books/{f}', false)")
        got = {x["title"]: x for x in r["recipes"]}
        assert [x["title"] for x in r["recipes"]] == exp["titles"], (f, list(got))
        for t, ph in exp.get("photos", {}).items(): assert got[t]["photo"] and ph in got[t]["photo"], (f, t, got[t]["photo"])
        for t in exp.get("nonvegan", []): assert got[t]["vegan"], (f, t)
        for t in exp["titles"]:
            if t not in exp.get("nonvegan", []): assert not got[t]["vegan"], (f, t, got[t]["vegan"])
            assert got[t]["n_ing"] >= 4 and got[t]["n_steps"] >= 1, (f, t)
        for t, n in exp.get("servings", {}).items(): assert got[t]["draft"]["servings"] == n, (f, t, got[t]["draft"]["servings"])
        for t, (pr, ck) in exp.get("times", {}).items(): assert (got[t]["draft"]["prep_min"], got[t]["draft"]["cook_min"]) == (pr, ck), (f, t)
        for t, c in exp.get("categories", {}).items(): assert got[t]["draft"]["category"] == c, (f, t, got[t]["draft"]["category"])
        assert len(r["ai"]) == exp.get("ai", 0), (f, r["ai"])
        print("ok", f, len(r["recipes"]), "recipes")
    # ingredient lines and yields
    cases = pg.evaluate("""() => [
      Z.cookbook.parseIngredient('1 1/2 cups red lentils, rinsed'), Z.cookbook.parseIngredient('2 (15-ounce) cans chickpeas, drained'),
      Z.cookbook.parseIngredient('½ teaspoon smoked paprika'), Z.cookbook.parseIngredient('Salt and pepper to taste'),
      Z.cookbook.parseIngredient('1 to 2 tablespoons maple syrup'), Z.cookbook.parseIngredient('3 cloves garlic, minced'),
      Z.cookbook.parseYield('Serves 4 to 6 · Active time: 20 minutes · Total time: 1 hour 10 minutes'),
      Z.cookbook.veganFlags(['1 cup coconut milk', '2 tbsp vegan butter', '1 eggplant', '2 tbsp peanut butter', '1 flax egg', 'cream of tartar']),
      Z.cookbook.veganFlags(['2 eggs', '1 cup whole milk', '¼ cup grated parmesan', '1 tbsp fish sauce'])]""")
    assert cases[0]["amount"] == 1.5 and cases[0]["unit"] == "cups" and cases[0]["name"] == "red lentils" and cases[0]["note"] == "rinsed"
    assert cases[1]["amount"] == 2 and cases[1]["unit"] == "cans" and cases[1]["name"] == "chickpeas" and "15-ounce" in cases[1]["note"]
    assert cases[2]["amount"] == 0.5 and cases[2]["unit"] == "teaspoon" and cases[2]["name"] == "smoked paprika"
    assert cases[3]["amount"] is None and "to taste" in cases[3]["note"]
    assert cases[4]["amount"] == 1 and cases[4]["unit"] == "tablespoons" and cases[4]["name"] == "maple syrup"
    assert cases[5]["amount"] == 3 and cases[5]["unit"] == "cloves" and cases[5]["name"] == "garlic"
    assert cases[6] == {"servings": 4, "total": 70, "prep": 20, "cook": None}, cases[6]
    assert cases[7] == [], cases[7]
    assert sorted(cases[8]) == ["eggs", "fish sauce", "parmesan", "whole milk"], cases[8]
    print("ingredient and yield parsing ok")
    assert not errs, errs
    b.close()
srv.shutdown()
print("cookbook ok")
