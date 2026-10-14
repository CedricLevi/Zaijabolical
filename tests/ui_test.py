"""Browser test: serves the site locally, fakes GitHub + USDA, and clicks through the app.
Run:  python tests/ui_test.py  (needs: pip install playwright)"""
import base64, hashlib, http.server, json, os, sys, threading, time, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tests", "out")
os.makedirs(OUT, exist_ok=True)
FX = json.load(open(os.path.join(ROOT, "tests", "fixtures", "starter.json")))
NUTS = json.loads(open(os.path.join(ROOT, "tests", "fixtures", "nutrient_ids.json")).read())

# ---------- local static server ----------
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:8765/"

# ---------- fake USDA ----------
by_seed = {i["seed_key"]: i for i in FX["ingredients"]}
AA_NUM = {"aa_trp": "501", "aa_thr": "502", "aa_ile": "503", "aa_leu": "504", "aa_lys": "505", "aa_met": "506", "aa_cys": "507",
          "aa_phe": "508", "aa_tyr": "509", "aa_val": "510", "aa_his": "512"}
def amino(item, protein):   # plausible g/100 g: legumes low in methionine, grains low in lysine
    legume = item["aisle"] in ("Beans & Legumes", "Tofu & Plant Protein")
    mg_per_g = {"aa_trp": 12, "aa_thr": 38, "aa_ile": 44, "aa_leu": 78, "aa_lys": 64 if legume else 33, "aa_met": 12 if legume else 20,
                "aa_cys": 11 if legume else 18, "aa_phe": 52, "aa_tyr": 36, "aa_val": 48, "aa_his": 27}
    return {k: protein * v / 1000 for k, v in mg_per_g.items()}
def usda_food(item, idx):
    ing = by_seed[item["key"]]
    nuts = [{"nutrientId": NUTS[k], "value": v} for k, v in ing["nutrients"].items() if k in NUTS]
    if idx % 5:   # leave some foods without amino acid data, like the real database
        nuts += [{"nutrient": {"number": AA_NUM[k], "name": k}, "amount": v} for k, v in amino(item, ing["nutrients"].get("protein", 0)).items()]
    desc = ", ".join(w.capitalize() if j == 0 else w for j, w in enumerate(item["must"])) + " (test data)"
    return {"fdcId": 900000 + idx, "description": desc, "dataType": item["types"][0], "foodNutrients": nuts}
PANTRY = json.load(open(os.path.join(ROOT, "tests", "fixtures", "pantry.json")))
FOODS = {p["query"]: usda_food(p, i) for i, p in enumerate(PANTRY)}
usda_calls = []
def handle_usda(route, request):
    usda_calls.append(request.url)
    if "/fdc/v1/foods?" in request.url:   # amino acid backfill
        ids = json.loads(request.post_data)["fdcIds"]
        body = [x for x in FOODS.values() if x["fdcId"] in ids]
    elif "/foods/search" in request.url:
        q = json.loads(request.post_data)["query"]
        f = FOODS.get(q)
        other = {"fdcId": 1, "description": "Something else entirely", "dataType": "SR Legacy", "foodNutrients": [{"nutrientId": 1003, "value": 1}]}
        body = {"foods": ([f] if f else []) + [other]}
    else:
        fid = int(request.url.split("/food/")[1].split("?")[0])
        f = next((x for x in FOODS.values() if x["fdcId"] == fid), None) or {"fdcId": fid, "description": "Something", "foodNutrients": []}
        body = dict(f, foodPortions=[{"amount": 1, "measureUnit": {"name": "cup"}, "gramWeight": 150}])
    route.fulfill(status=200, content_type="application/json", body=json.dumps(body), headers={"Access-Control-Allow-Origin": "*"})

# ---------- fake GitHub ----------
GH = {"files": {}, "puts": 0}
def handle_gh(route, request):
    url, m = request.url, request.method
    h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS"}
    if m == "OPTIONS": return route.fulfill(status=204, headers=h)
    if request.headers.get("authorization") != "Bearer test-token":
        return route.fulfill(status=401, content_type="application/json", body='{"message":"Bad credentials"}', headers=h)
    path = url.split("/repos/cedric/zaijabolical-data")[1] if "/repos/cedric/zaijabolical-data" in url else None
    if path is None:
        return route.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}', headers=h)
    if path == "" and m == "GET":
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"private": True, "permissions": {"push": True}}), headers=h)
    if path.startswith("/contents/media/"):
        name = path[len("/contents/"):]
        f = GH["files"].get(name)
        if m == "GET":
            if not f: return route.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}', headers=h)
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": f[0], "sha": f[1]}), headers=h)
        if m == "PUT":
            b = json.loads(request.post_data)
            if f: return route.fulfill(status=422, content_type="application/json", body='{"message":"sha wasn\'t supplied"}', headers=h)
            GH["files"][name] = (b["content"], hashlib.sha1(b["content"].encode()).hexdigest()); GH["media_puts"] = GH.get("media_puts", 0) + 1
            return route.fulfill(status=201, content_type="application/json", body=json.dumps({"content": {"sha": GH["files"][name][1]}}), headers=h)
        if m == "DELETE":
            GH["files"].pop(name, None)
            return route.fulfill(status=200, content_type="application/json", body="{}", headers=h)
    if path.startswith("/contents/data.json"):
        f = GH["files"].get("data.json")
        if m == "GET":
            if not f: return route.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}', headers=h)
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": f[0], "sha": f[1]}), headers=h)
        if m == "PUT":
            b = json.loads(request.post_data)
            if f and b.get("sha") != f[1]:
                return route.fulfill(status=409, content_type="application/json", body='{"message":"conflict"}', headers=h)
            sha = hashlib.sha1(b["content"].encode()).hexdigest()
            GH["files"]["data.json"] = (b["content"], sha); GH["puts"] += 1
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"content": {"sha": sha}}), headers=h)
    route.fulfill(status=404, headers=h, body="{}")

SCANS = []
SCAN_RECIPE = {"name": "Smoky Lentil Stew", "servings": 4, "category": "Main", "prep_min": 10, "cook_min": 35,
    "description": "A thick, smoky stew from a library cookbook.",
    "ingredients": [{"name": "red lentils", "amount": 1, "unit": "cup", "note": "rinsed", "text": "1 cup red lentils, rinsed"},
                    {"name": "smoked paprika", "amount": 2, "unit": "tsp", "note": "", "text": "2 tsp smoked paprika"},
                    {"name": "onion", "amount": 1, "unit": "", "note": "diced", "text": "1 onion, diced"},
                    {"name": "spinach", "amount": 2, "unit": "handfuls", "note": "", "text": "2 handfuls spinach", "unclear": True}],
    "steps": ["Cook the onion in a little oil for 5 minutes.", "Add lentils, paprika and 4 cups water; simmer 30 minutes.", "Stir in spinach."],
    "notes": "Freezes well."}
SCAN_LABEL = {"product": "Soy milk, unsweetened", "serving_text": "1 cup (240 mL)", "serving_grams": None, "serving_ml": 240,
    "nutrients": {"calories": {"amount": 80, "unit": "kcal"}, "protein": {"amount": 7, "unit": "g"}, "total_fat": {"amount": 4, "unit": "g"},
                  "calcium": {"amount": 300, "unit": "mg"}, "vitamin_d": {"amount": 2.7, "unit": "mcg"}, "vitamin_b12": {"amount": None, "unit": "", "dv": 120}}}
def handle_scan(route, request):
    b = json.loads(request.post_data)
    SCANS.append((b["kind"], request.headers.get("x-zaija-key"), len(b.get("images", []))))
    if request.headers.get("x-zaija-key") != "test-token":
        return route.fulfill(status=401, content_type="application/json", body='{"error":"bad key"}')
    if b["kind"] == "ping": res = {"ok": True, "engine": "workers-ai"}
    elif b["kind"] == "text":
        assert "Garlic Bread Crumbs" in b["text"], b["text"][:200]
        res = {"kind": "text", "engine": "workers-ai", "result": {"recipes": [{"name": "Garlic Bread Crumbs", "servings": 4, "category": "Add-on",
            "ingredients": [{"name": "stale bread", "amount": 1, "unit": "cup", "text": "1 cup stale bread"}, {"name": "olive oil", "amount": 2, "unit": "tablespoons", "text": "2 tablespoons olive oil"},
                            {"name": "garlic", "amount": 1, "unit": "clove", "text": "1 clove garlic"}], "steps": ["Blitz the bread into crumbs.", "Toast with the oil and garlic until golden."]}]}}
    elif b["kind"] == "photo": res = {"kind": "photo", "engine": "workers-ai", "result": {"index": 0}}
    else:
        assert b["images"] and b["images"][0].startswith("data:image/jpeg;base64,")
        res = {"kind": b["kind"], "engine": "workers-ai", "result": SCAN_RECIPE if b["kind"] == "recipe" else SCAN_LABEL}
    route.fulfill(status=200, content_type="application/json", body=json.dumps(res))

def remote_doc():
    return json.loads(base64.b64decode(GH["files"]["data.json"][0]))

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def new_page(**kw):
        ctx = b.new_context(bypass_csp=True, **kw)  # lets the test script inspect the page
        ctx.route("https://api.github.com/**", handle_gh)
        ctx.route("https://api.nal.usda.gov/**", handle_usda)
        ctx.route("https://fonts.googleapis.com/**", lambda r, q: r.fulfill(status=200, content_type="text/css", body=""))
        ctx.route(BASE + "api/scan", handle_scan)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        return pg

    pg = new_page(viewport={"width": 1440, "height": 1000})
    pg.goto(BASE); pg.wait_for_selector(".connect", timeout=15000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/01-connect.png")
    # wrong key first
    pg.fill(".connect input >> nth=0", "cedric"); pg.fill(".connect input[type=password]", "wrong")
    pg.click(".connect .btn.primary"); pg.wait_for_selector(".connect .banner", timeout=10000)
    assert "access key" in pg.inner_text(".connect .banner").lower(), pg.inner_text(".connect .banner")
    pg.fill(".connect input[type=password]", "test-token")
    pg.click(".connect .btn.primary"); pg.wait_for_selector(".page-head h1:text('Plan')", timeout=15000)
    pg.screenshot(path=f"{OUT}/02-plan-empty.png")

    # USDA key + starters
    pg.goto(BASE + "#pantry"); pg.wait_for_timeout(300)
    pg.fill(".banner input", "TESTKEY"); pg.click(".banner .btn.primary"); pg.wait_for_timeout(300)
    pg.click("text=Import starters")
    pg.wait_for_function("document.querySelector('.drawer-foot .btn.primary') && !document.querySelector('.drawer-foot .btn.primary').disabled", timeout=60000)
    pg.screenshot(path=f"{OUT}/03-wizard.png")
    pg.click(".drawer-foot .btn.primary"); pg.wait_for_selector("table.table", timeout=10000); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{OUT}/04-pantry.png")
    assert GH["puts"] >= 1, "data saved to GitHub"
    d = remote_doc(); assert len(d["recipes"]) == 16 and len(d["ingredients"]) == 55, (len(d["recipes"]), len(d["ingredients"]))
    assert d["settings"]["usda_api_key"] == "TESTKEY"

    # week plan: nothing shows until a week is planned
    pg.goto(BASE + "#plan"); pg.wait_for_timeout(300)
    assert pg.locator(".week-options").count() == 0 and pg.locator(".empty h2:text('Plan a week from a few big batches')").count() == 1
    pg.goto(BASE + "#prep"); pg.wait_for_selector(".empty h2:text('Plan a week first')")
    pg.goto(BASE + "#plan"); pg.wait_for_timeout(300)
    t = time.time(); pg.click(".options .btn.primary"); pg.wait_for_selector(".week-options", timeout=60000)
    print("week planned in", round(time.time() - t, 1), "s")
    pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/05-week.png", full_page=True)
    assert pg.locator(".confirm-plan").count() == 1, "a new plan is a preview until it's used"
    pg.click(".wopt >> nth=1"); pg.wait_for_timeout(300)
    # pick the dates: default prep is the next prep day (Sunday) with meals from the day after
    today = pg.evaluate("Z.tracker.dayKey(new Date())")
    tomorrow = pg.evaluate("Z.tracker.addDays(Z.tracker.dayKey(new Date()), 1)")
    dates = pg.locator(".plan-dates input[type=date]")
    assert dates.count() == 2
    prep0, start0 = dates.nth(0).input_value(), dates.nth(1).input_value()
    assert pg.evaluate(f"Z.tracker.weekdayName('{prep0}')") == "Sunday" and pg.evaluate(f"Z.tracker.daysBetween('{prep0}', '{start0}')") == 1, (prep0, start0)
    dates.nth(0).fill(today); pg.wait_for_timeout(600)
    assert dates.nth(1).input_value() == tomorrow, "first day of meals follows the prep day"
    assert pg.inner_text(".day >> nth=0 >> .day-head b") == pg.evaluate(f"Z.tracker.weekdayName('{tomorrow}')")[:3], "days relabelled"
    dates.nth(1).fill(today); pg.wait_for_timeout(600)   # prep and eat from today
    assert pg.inner_text(".day >> nth=0 >> .day-head b") == pg.evaluate(f"Z.tracker.weekdayName('{today}')")[:3]
    pg.screenshot(path=f"{OUT}/05a-plan-dates.png")
    pg.click(".confirm-plan >> text=Use this plan"); pg.wait_for_timeout(2500)
    assert pg.locator(".confirm-plan").count() == 0 and pg.locator(".wopt .in-use").count() == 1
    chosen = pg.inner_text(".panel-head .muted.small")
    d = remote_doc(); assert d["current_week"] and d["current_week"]["choice"] == 1 and d["week_options"]
    assert d["current_week"]["week_of"] == today and d["current_week"]["prep_date"] == today, d["current_week"]
    assert d["current_week"]["week"]["days"][0]["day"] == pg.evaluate(f"Z.tracker.weekdayName('{today}')")
    # Change dates reopens the plan as a preview; Keep current plan leaves it alone
    pg.click(".panel-head >> text=Change dates"); pg.wait_for_selector(".confirm-plan .plan-dates")
    pg.click(".confirm-plan >> text=Keep current plan"); pg.wait_for_timeout(300)
    assert pg.locator(".confirm-plan").count() == 0 and remote_doc()["current_week"]["week_of"] == today
    # add a dish to a day through the cookbook pop-up
    pg.click(".day >> nth=0 >> .add-dish"); pg.wait_for_selector(".modal.wide .pcard"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/05b-picker.png")
    before = pg.locator(".day >> nth=0 >> .dish").count()
    pg.fill(".picker-tools input", "brown rice"); pg.wait_for_timeout(300)
    # the picker has the same Simple / Advanced / List views as the Recipes page
    pg.click(".picker-tools .viewswitch button:has-text('Advanced')"); pg.wait_for_selector(".modal.wide .acard")
    assert pg.locator(".modal.wide .adv-head").count() == 1 and pg.locator(".modal.wide .pcard").count() == 0
    pg.screenshot(path=f"{OUT}/05c-picker-advanced.png")
    pg.click(".picker-tools .viewswitch button:has-text('List')"); pg.wait_for_selector(".modal.wide table.ltable tr.click")
    pg.click(".modal.wide .sorter:has-text('Protein')"); pg.wait_for_timeout(200)
    assert pg.locator(".modal.wide .sorter.on:has-text('Protein')").count() == 1
    pg.click(".modal.wide tr.click >> nth=0"); pg.wait_for_timeout(800)
    assert pg.locator(".modal.wide").count() == 0
    assert pg.locator(".day >> nth=0 >> .dish").count() >= before
    pg.click(".day >> nth=0 >> .add-dish"); pg.wait_for_selector(".modal.wide tr.click")   # remembered
    pg.click(".picker-tools .viewswitch button:has-text('Simple')"); pg.wait_for_selector(".modal.wide .pcard"); pg.keyboard.press("Escape")

    # build around + day ideas
    pg.click(".anchors .btn"); pg.wait_for_selector(".modal.wide .pcard")
    pg.click(".modal.wide .pcard:has-text('Black Bean, Sweet Potato & TVP Chili')")
    assert "Black Bean" in pg.inner_text(".anchors")
    pg.click("text=Day ideas"); assert pg.locator(".empty h2:text('Find day ideas')").count() == 1
    pg.click(".empty >> text=Find combinations"); pg.wait_for_selector(".combo", timeout=60000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/06-ideas.png")
    assert pg.locator(".combo .anchor-mark").count() >= 3
    pg.click(".combo >> nth=0 >> text=Open in day builder"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/07-builder.png", full_page=True)

    # recipes: three views, recipe page, editor
    PHOTO = os.path.join(ROOT, "assets", "icon-512.png")
    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(1500); pg.screenshot(path=f"{OUT}/08-recipes.png")
    assert pg.locator(".pcard").count() == 16
    pg.click(".viewswitch button:has-text('Advanced')"); pg.wait_for_timeout(300)
    assert pg.locator(".acard .aa").count() >= 8, "amino acid mini-bars under protein (after backfill)"
    pg.screenshot(path=f"{OUT}/08b-advanced.png")
    pg.click(".adv-head button:has-text('Minerals')"); pg.wait_for_timeout(200)
    assert "Iron" in pg.inner_text(".acard >> nth=0")
    pg.click(".viewswitch button:has-text('List')"); pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/08c-list.png")
    pg.click(".ltable th >> nth=4 >> button"); pg.wait_for_timeout(200)   # sort by protein
    prot = pg.eval_on_selector_all(".ltable tbody td:nth-child(5)", "els => els.map(e => parseFloat(e.textContent))")
    assert prot == sorted(prot, reverse=True), prot
    pg.click(".viewswitch button:has-text('Simple')")
    pg.click(".pcard >> nth=2"); pg.wait_for_selector(".detail-title"); pg.wait_for_timeout(300)
    rid = pg.evaluate("location.hash.split('/')[1]")
    pg.click(".detail-meta .stars button >> nth=3"); pg.wait_for_timeout(500)   # 4 stars from the recipe page
    assert pg.evaluate(f"Z.store.S.doc.recipes.find(r => r.id === '{rid}').rating") == 4
    pg.screenshot(path=f"{OUT}/09-recipe-page.png", full_page=True)
    pg.click(".detail-bar >> text=Edit"); pg.wait_for_timeout(800); pg.screenshot(path=f"{OUT}/09b-editor.png")
    # every ingredient line shows its name and its household unit (regression: blank names / "g")
    names = pg.eval_on_selector_all(".ing-line:not(.head) .ing-pick input", "els => els.map(e => e.value)")
    units = pg.eval_on_selector_all(".ing-line select", "els => els.map(e => e.value)")
    assert names and all(names), names
    assert any(u not in ("g", "oz", "lb") for u in units), units
    # add a photo, description, a link and an attachment
    pg.set_input_files(".padd input", PHOTO); pg.wait_for_selector(".pthumb img", timeout=10000)
    pg.fill("textarea >> nth=0", "Our favourite Sunday bowl.")
    pg.click("text=Add link"); pg.fill(".link-line input >> nth=0", "Original"); pg.fill(".link-line input >> nth=1", "https://example.com/recipe")
    pg.set_input_files(".panel:has-text('Attachments') input[type=file]", {"name": "card.txt", "mimeType": "text/plain", "buffer": b"Grandma's card"})
    pg.wait_for_selector(".filerow", timeout=5000)
    pg.click(".drawer-head .btn.primary"); pg.wait_for_selector(".detail .hero img", timeout=10000); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{OUT}/09c-recipe-photo.png")
    rr = next(r for r in remote_doc()["recipes"] if r["id"] == rid)
    assert rr["description"] == "Our favourite Sunday bowl." and rr["links"][0]["url"] == "https://example.com/recipe" and rr["rating"] == 4
    assert len(rr["photos"]) == 1 and len(rr["attachments"]) == 1
    assert rr["photos"][0]["path"] in GH["files"] and rr["photos"][0]["thumb"] in GH["files"], "photo uploaded to the data repo"
    assert rr["attachments"][0]["path"] in GH["files"]
    # print view
    pg.evaluate("() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }")
    pg.click(".detail-bar >> text=Print"); pg.wait_for_timeout(600)
    assert pg.evaluate("window.__printed") == 1 and pg.locator("#print-root .pr-ing li").count() > 3
    pg.emulate_media(media="print"); pg.screenshot(path=f"{OUT}/09d-print.png", full_page=True); pg.emulate_media(media="screen")
    pg.evaluate("window.dispatchEvent(new Event('afterprint'))")

    # new recipe by hand
    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=New recipe"); pg.fill(".drawer .field:has-text('Name') input", "Test lentil bowl")
    pg.click(".drawer >> text=Add ingredient"); pg.click(".ing-line:not(.head) .ing-pick input"); pg.fill(".ing-line:not(.head) .ing-pick input", "lent")
    pg.click(".ing-pick .menu button >> nth=0"); pg.wait_for_timeout(600)
    pg.click(".drawer-head .btn.primary"); pg.wait_for_timeout(2500)
    assert any(r["name"] == "Test lentil bowl" for r in remote_doc()["recipes"])

    # scan a recipe
    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=Scan a recipe")
    pg.set_input_files(".scan-pick label:nth-child(2) input", PHOTO)
    pg.click(".modal .drawer-foot .btn.primary"); pg.wait_for_selector(".drawer-head h2:text('Draft recipe')", timeout=15000); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/15-scan-draft.png")
    assert pg.input_value(".drawer .field:has-text('Name') input") == "Smoky Lentil Stew"
    flags = pg.eval_on_selector_all(".ing-line .conf", "els => els.map(e => e.textContent)")
    print("scan flags:", flags)
    assert "matched" in flags and "new" in flags, flags
    pg.click(".drawer-head .btn.primary"); pg.wait_for_selector(".detail-title", timeout=10000); pg.wait_for_timeout(2500)
    sr = next(r for r in remote_doc()["recipes"] if r["name"] == "Smoky Lentil Stew")
    assert any(l.get("name") == "smoked paprika" and not l.get("ingredient_id") for l in sr["ingredients"]), "unmatched line kept"
    assert sr["attachments"] and sr["attachments"][0]["name"].startswith("Scanned page")
    assert pg.locator(".ingl li.unlinked").count() >= 1
    pg.screenshot(path=f"{OUT}/15b-scanned-recipe.png")

    # scan a nutrition label from the pantry
    pg.goto(BASE + "#pantry"); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=Add ingredient"); pg.click("text=From a nutrition label"); pg.click("text=Scan the label")
    pg.set_input_files(".scan-pick label:nth-child(2) input", PHOTO)
    pg.click(".modal .drawer-foot .btn.primary"); pg.wait_for_selector(".modal h2:text('Check the label')", timeout=15000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/16-label-review.png")
    pg.click(".modal .btn.primary:has-text('Add to pantry')"); pg.wait_for_timeout(2500)
    soy = next(i for i in remote_doc()["ingredients"] if i["name"] == "Soy milk, unsweetened")
    assert abs(soy["nutrients"]["protein"] - 7 * 100 / 240) < 0.01 and abs(soy["nutrients"]["b12"] - 2.4 * 1.2 * 100 / 240) < 0.01, soy["nutrients"]
    assert soy["portions"][0]["grams"] == 240

    # import cookbooks: tagged EPUB, then a PDF, then a plain EPUB that needs the AI
    BOOKS = os.path.join(ROOT, "tests", "fixtures", "books")
    before_n = len(remote_doc()["recipes"])
    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=Import cookbook"); pg.set_input_files(".modal input[type=file]", os.path.join(BOOKS, "tagged.epub"))
    pg.wait_for_selector(".imp-row", timeout=20000); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/18-import-review.png")
    titles = pg.eval_on_selector_all(".imp-title", "els => els.map(e => e.value)")
    ticked = pg.eval_on_selector_all(".imp-row input[type=checkbox]", "els => els.map(e => e.checked)")
    print("import found:", list(zip(titles, ticked)))
    assert titles == ["Smoky Black Bean Soup", "Peanut Tofu Noodles", "Lemony Lentil Salad", "Honey Butter Carrots"], titles
    assert ticked == [True, True, True, False], "the non-vegan recipe starts unticked"
    assert "Not vegan" in pg.inner_text(".imp-row >> nth=3")
    assert pg.evaluate("document.querySelectorAll('.imp-row')[0].querySelector('.imp-thumb img').src.startsWith('blob:')"), "photo found for the soup"
    pg.click(".drawer-head .btn.primary"); pg.wait_for_selector("#import-done", timeout=30000); pg.wait_for_timeout(2500)
    d = remote_doc(); soup = next(r for r in d["recipes"] if r["name"] == "Smoky Black Bean Soup")
    assert len(d["recipes"]) == before_n + 3 and not any(r["name"] == "Honey Butter Carrots" for r in d["recipes"])
    assert soup["servings"] == 4 and soup["source"]["book"] == "Tagged Test Kitchen" and soup["category"] == "Main" and soup["description"]
    assert len(soup["photos"]) == 1 and soup["attachments"][0]["type"] == "text/html", soup["attachments"]
    assert any(l.get("ingredient_id") for l in soup["ingredients"]) and any(l.get("name") for l in soup["ingredients"])
    pg.screenshot(path=f"{OUT}/18b-imported.png")
    # the saved book page opens in a sandbox
    pg.goto(BASE + "#recipe/" + soup["id"]); pg.wait_for_selector(".filerow"); pg.click(".filerow:has-text('book page')")
    pg.wait_for_selector("iframe.page-frame"); assert pg.get_attribute("iframe.page-frame", "sandbox") == ""
    assert "black beans" in pg.frame_locator("iframe.page-frame").locator("body").inner_text().lower()
    pg.keyboard.press("Escape"); pg.click(".modal .icon-btn")

    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=Import cookbook"); pg.set_input_files(".modal input[type=file]", os.path.join(BOOKS, "book.pdf"))
    pg.wait_for_selector(".imp-row", timeout=30000); pg.wait_for_timeout(1500)
    titles = pg.eval_on_selector_all(".imp-title", "els => els.map(e => e.value)")
    print("pdf found:", titles)
    assert titles == ["Roasted Chickpea Wraps", "Coconut Red Lentil Curry"], titles
    pg.screenshot(path=f"{OUT}/18c-import-pdf.png")
    pg.click(".drawer-head .btn.primary"); pg.wait_for_selector("#import-done", timeout=40000); pg.wait_for_timeout(2500)
    curry = next(r for r in remote_doc()["recipes"] if r["name"] == "Coconut Red Lentil Curry")
    assert len(curry["photos"]) == 1 and curry["attachments"][0]["type"] == "image/jpeg" and curry["servings"] == 6

    pg.click(".page-head >> text=Import cookbook"); pg.set_input_files(".modal input[type=file]", os.path.join(BOOKS, "plain.epub"))
    pg.wait_for_selector(".imp-row", timeout=20000)
    pg.click("text=Read with AI"); pg.wait_for_function("[...document.querySelectorAll('.imp-title')].some(e => e.value === 'Garlic Bread Crumbs')", timeout=20000)
    titles = pg.eval_on_selector_all(".imp-title", "els => els.map(e => e.value)")
    print("plain found:", titles)
    assert "Green Tahini Sauce" in titles and "Quick Pickled Onions" in titles
    pg.once("dialog", lambda dlg: dlg.accept())
    pg.click(".drawer-head .btn.ghost"); pg.wait_for_timeout(300)   # cancel without importing

    # link ingredients in bulk
    pg.goto(BASE + "#link"); pg.wait_for_selector(".link-row", timeout=10000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/19-link.png", full_page=True)
    n_before = pg.locator(".link-row").count()
    if pg.locator(".link-tools .btn.primary").count(): pg.click(".link-tools .btn.primary"); pg.wait_for_timeout(4000)    # link every pantry match
    if pg.locator(".link-row .btn:has-text('Maybe:')").count(): pg.click(".link-row .btn:has-text('Maybe:') >> nth=0"); pg.wait_for_timeout(1500)
    n_after = pg.locator(".link-row").count()
    print("link rows", n_before, "->", n_after)
    assert n_after < n_before
    pg.click(".link-tools >> text=Look up the rest in USDA"); pg.wait_for_timeout(n_after * 450 + 2000)
    pg.screenshot(path=f"{OUT}/19b-link-usda.png", full_page=True)
    nn = pg.locator(".link-row").count()
    pg.click(".link-row >> nth=0 >> text=No nutrition"); pg.wait_for_timeout(1500)
    assert pg.locator(".link-row").count() == nn - 1

    # a recipe as a pantry item (homemade broth, sauce…)
    pg.goto(BASE + "#pantry"); pg.wait_for_selector("table.table")
    pg.click(".page-head >> text=From a recipe"); pg.wait_for_selector(".modal.wide .pcard")
    pg.fill(".picker-tools input", "Simple Brown Rice"); pg.wait_for_timeout(300)
    pg.click(".modal.wide .pcard >> nth=0"); pg.wait_for_selector(".home-form")
    pg.fill(".home-form input[type=number]", "1000"); pg.wait_for_timeout(200)
    assert "kcal" in pg.inner_text(".home-preview")
    pg.screenshot(path=f"{OUT}/19c-homemade-form.png")
    pg.click(".home-form >> text=Add to pantry"); pg.wait_for_selector("tr.homemade"); pg.wait_for_timeout(300)
    home = pg.evaluate("Z.store.S.doc.ingredients.find(i => i.from_recipe)")
    src = home["from_recipe"]
    assert home["yield_g"] == 1000 and home["nutrients"]["kcal"] > 0 and home["source"] == "recipe", home
    assert "Homemade" in pg.inner_text("tr.homemade") and "From the recipe" in pg.inner_text("tr.homemade")
    pg.click(".toolbar .seg >> text=Homemade"); pg.wait_for_timeout(200)
    assert pg.locator("tbody tr").count() == 1
    pg.screenshot(path=f"{OUT}/19d-pantry-homemade.png")
    pg.click(".toolbar .seg >> text=All"); pg.wait_for_timeout(200)
    pg.screenshot(path=f"{OUT}/19e-pantry-all.png", full_page=True)
    # editing the recipe updates the pantry item's nutrients
    kcal0 = home["nutrients"]["kcal"]
    pg.evaluate(f"""async () => {{ const r = JSON.parse(JSON.stringify(Z.store.S.doc.recipes.find(x => x.id === '{src}')));
      r.ingredients[0].amount = Number(r.ingredients[0].amount) * 2; await Z.api.request('PUT', '/api/recipes/' + r.id, r); }}""")
    kcal1 = pg.evaluate("Z.store.S.doc.ingredients.find(i => i.from_recipe).nutrients.kcal")
    assert kcal1 > kcal0, (kcal0, kcal1)
    # and it can't be put inside its own recipe
    err = pg.evaluate(f"""async () => {{ const r = JSON.parse(JSON.stringify(Z.store.S.doc.recipes.find(x => x.id === '{src}')));
      r.ingredients.push({{ ingredient_id: '{home["id"]}', amount: 1, unit: 'cup' }});
      try {{ await Z.api.request('PUT', '/api/recipes/' + r.id, r); return null; }} catch (e) {{ return e.message; }} }}""")
    assert err and "made from this recipe" in err, err
    # it's usable in another recipe and shows up first on the shopping list as something to make
    pg.evaluate(f"""async () => {{ const r = JSON.parse(JSON.stringify(Z.store.S.doc.recipes.find(x => x.id !== '{src}' && x.ingredients.length)));
      r.ingredients.push({{ ingredient_id: '{home["id"]}', amount: 1, unit: 'cup' }}); await Z.api.request('PUT', '/api/recipes/' + r.id, r); }}""")
    pg.evaluate("reload()"); pg.wait_for_timeout(300)
    pg.goto(BASE + "#recipe/" + src); pg.wait_for_selector(".detail-bar")
    assert pg.locator(".detail-bar .btn.in-pantry").count() == 1

    # prep + settings
    pg.goto(BASE + "#prep"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/10-prep.png", full_page=True)
    assert pg.locator(".prep-tl .lane").count() >= 2 and "start to finish" in pg.inner_text(".prep-tl")

    # tracker: today is pre-filled from the plan; check things off
    pg.goto(BASE + "#tracker"); pg.wait_for_selector(".meals", timeout=10000); pg.wait_for_timeout(300)
    pg.click(".page-head >> text=Refresh"); pg.wait_for_selector(".meals", timeout=10000); pg.wait_for_timeout(300)
    assert pg.locator("text=Return to Today").count() == 0
    # look ahead: tomorrow shows its planned meals, view-only, with a planned score
    pg.click("[aria-label='Next day']"); pg.wait_for_selector(".day-nav h2:text('Tomorrow')"); pg.wait_for_timeout(300)
    assert pg.locator(".meal").count() >= 1 and pg.locator(".meal input[type=checkbox]:disabled").count() == pg.locator(".meal").count()
    assert "planned" in pg.inner_text(".day-nav .score") and pg.locator(".p-nut h2:text('Planned')").count() == 1
    pg.screenshot(path=f"{OUT}/16b-tracker-tomorrow.png", full_page=True)
    pg.click("[aria-label='Next week']"); pg.wait_for_selector(".p-week h2:text('Next week')"); pg.wait_for_timeout(300)
    pg.click("text=Return to Today"); pg.wait_for_selector(".day-nav h2:text('Today')"); pg.wait_for_timeout(300)
    assert pg.locator("text=Return to Today").count() == 0 and pg.locator(".p-week h2:text('This week')").count() == 1
    assert not any(l["date"] > today for l in remote_doc().get("logs", [])), "looking ahead saves nothing"
    n_items = pg.locator(".meal").count()
    if n_items == 0:   # on prep day the new plan is for next week, so today has nothing pre-filled
        for name in ("Tofu Scramble", "Tempeh Bolognese"):
            pg.click(".trk-add >> text=Add a dish"); pg.wait_for_selector(".modal.wide .pcard")
            pg.click(f".modal.wide .pcard:has-text('{name}')"); pg.wait_for_timeout(600)
        pg.evaluate("() => { S.trk.day.items.forEach(i => { i.eaten = false; }); }")
        n_items = pg.locator(".meal").count()
    pg.click("text=Ate everything"); pg.wait_for_timeout(800)
    today = pg.evaluate("Z.tracker.dayKey(new Date())")
    score = pg.evaluate(f"Z.store.S.doc.logs.find(l => l.date === '{today}').score")
    print("tracker items", n_items, "score", score)
    assert n_items >= 2 and score > 0
    # Clear empties the day (and the plan doesn't refill it)
    pg.once("dialog", lambda dlg: dlg.accept())
    pg.click(".trk-add >> text=Clear"); pg.wait_for_timeout(800)
    assert pg.locator(".meal").count() == 0 and pg.evaluate(f"Z.store.S.doc.logs.find(l => l.date === '{today}').items.length") == 0
    pg.click(".trk-add >> text=Add a dish"); pg.wait_for_selector(".modal.wide .pcard"); pg.click(".modal.wide .pcard >> nth=0"); pg.wait_for_timeout(600)
    assert pg.locator(".meal").count() == 1
    # fill four good weeks this month directly, to see cheeks and a sticker
    pg.evaluate("""() => { const T = Z.tracker; const s = T.weekStart(T.dayKey(new Date()), 'Monday');
      for (let w = 1; w <= 8; w++) for (let d = 0; d < 6; d++) { const k = T.addDays(s, -7 * w + d);
        Z.store.upsert('logs', { id: 'log-' + k, date: k, items: [], score: 88 + d, eaten: 3 }); } }""")
    pg.evaluate("S.trk = null"); pg.goto(BASE + "#plan"); pg.goto(BASE + "#tracker"); pg.wait_for_selector(".cheeks", timeout=10000); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/17-tracker.png", full_page=True)
    assert pg.locator(".cheeks .w.done").count() >= 2 and pg.locator(".shelf .sticker:not(.locked)").count() >= 1
    assert pg.evaluate("[...document.querySelectorAll('.shelf img')].every(i => i.complete && i.naturalWidth > 0)"), "sticker images load"
    pg.goto(BASE + "#settings"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/11-settings.png")
    pg.click("text=Check scanning"); pg.wait_for_timeout(500)
    assert "Scanning works" in pg.inner_text(".panel:has-text('Scanning')")
    link = pg.evaluate("Z.store.setupLink()")
    assert "#connect=" in link

    # second device via setup link (phone)
    ph = new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ph.goto(link.replace("http://127.0.0.1:8765/", BASE)); ph.wait_for_selector(".week, .week-options", timeout=20000); ph.wait_for_timeout(800)
    assert "connect=" not in ph.url, "token removed from the address bar"
    print("phone scrollWidth", ph.evaluate("document.documentElement.scrollWidth"))
    # tabs sit at the top of the phone screen, big enough to tap; Settings can move them to the bottom
    nav = ph.locator(".nav").bounding_box(); tab = ph.locator(".nav a >> nth=0").bounding_box()
    assert nav["y"] == 0 and tab["height"] >= 50 and tab["width"] >= 55, (nav, tab)
    ph.goto(BASE + "#settings"); ph.wait_for_timeout(300); ph.screenshot(path=f"{OUT}/12b-phone-settings.png")
    ph.click(".theme-panel >> text=Bottom"); ph.wait_for_timeout(300)
    nav = ph.locator(".nav").bounding_box(); assert abs(nav["y"] + nav["height"] - 844) < 2, nav
    ph.click(".theme-panel >> text=Top"); ph.wait_for_timeout(300)
    assert ph.locator(".nav").bounding_box()["y"] == 0
    ph.goto(BASE + "#plan"); ph.wait_for_selector(".week, .week-options", timeout=20000); ph.wait_for_timeout(500)
    ph.screenshot(path=f"{OUT}/12-phone.png")
    assert ph.inner_text(".panel-head .muted.small") == chosen, "phone shows the same chosen week"
    ph.goto(BASE + "#recipes"); ph.wait_for_timeout(1500); ph.screenshot(path=f"{OUT}/13-phone-recipes.png")
    # recipe cards show the recipe's main photo (here and in the picker)
    main_is_shown = """async ([sel, rid]) => { const r = recipeById(rid); const img = document.querySelector(sel);
      return !!img && img.complete && img.naturalWidth > 0 && img.src === await Z.media.url(r.photos[0].path, 'image/jpeg'); }"""
    pname = ph.evaluate(f"recipeById('{rid}').name")
    ph.fill(".rsearch", pname); ph.wait_for_timeout(1500)
    ph.wait_for_function(f"document.querySelector('.pcard .ph img') && document.querySelector('.pcard .ph img').naturalWidth > 0", timeout=10000)
    assert ph.evaluate(main_is_shown, [".pcard .ph img", rid]), "simple card shows the main photo"
    ph.screenshot(path=f"{OUT}/13h-phone-card-photo.png")
    # the photo uploaded on the desktop downloads on the phone
    ph.goto(BASE + "#recipe/" + rid); ph.wait_for_selector(".hero img[src^='blob:']", timeout=10000); ph.wait_for_timeout(400)
    print("phone scrollWidth (recipe)", ph.evaluate("document.documentElement.scrollWidth"))
    ph.screenshot(path=f"{OUT}/13b-phone-recipe.png", full_page=True)
    ph.goto(BASE + "#plan"); ph.wait_for_selector(".add-dish"); ph.click(".add-dish >> nth=0"); ph.wait_for_selector(".modal.wide .pcard"); ph.wait_for_timeout(500)
    ph.screenshot(path=f"{OUT}/13d-phone-picker.png")
    ph.fill(".picker-tools input", pname); ph.wait_for_timeout(800)
    ph.wait_for_function("document.querySelector('.modal.wide .pcard .ph img') && document.querySelector('.modal.wide .pcard .ph img').naturalWidth > 0", timeout=10000)
    assert ph.evaluate(main_is_shown, [".modal.wide .pcard .ph img", rid]), "picker card shows the main photo"
    ph.click(".picker-tools .viewswitch button:has-text('Advanced')"); ph.wait_for_selector(".modal.wide .acard"); ph.wait_for_timeout(600)
    assert ph.evaluate("document.querySelector('.modal.wide').scrollWidth <= 390"), "advanced picker fits the phone"
    ph.screenshot(path=f"{OUT}/13i-phone-picker-advanced.png")
    ph.click(".picker-tools .viewswitch button:has-text('List')"); ph.wait_for_selector(".modal.wide tr.click"); ph.wait_for_timeout(600)
    ph.screenshot(path=f"{OUT}/13j-phone-picker-list.png")
    ph.click(".picker-tools .viewswitch button:has-text('Simple')"); ph.keyboard.press("Escape")
    ph.goto(BASE + "#link"); ph.wait_for_timeout(800); ph.screenshot(path=f"{OUT}/13e-phone-link.png", full_page=True)
    assert ph.evaluate("document.documentElement.scrollWidth") <= 390, "link screen fits the phone"
    ph.goto(BASE + "#recipes"); ph.wait_for_timeout(500)
    ph.click(".page-head .btn:has(svg) >> nth=0"); ph.set_input_files(".modal input[type=file]", os.path.join(ROOT, "tests", "fixtures", "books", "tagged.epub"))
    ph.wait_for_selector(".imp-row", timeout=20000); ph.wait_for_timeout(800); ph.screenshot(path=f"{OUT}/13f-phone-import.png")
    ph.once("dialog", lambda dlg: dlg.accept()); ph.click(".drawer-head .btn.ghost"); ph.wait_for_timeout(300)
    ph.goto(BASE + "#tracker"); ph.wait_for_selector(".cheeks", timeout=10000); ph.wait_for_timeout(500)
    print("phone scrollWidth (tracker)", ph.evaluate("document.documentElement.scrollWidth"))
    assert ph.evaluate("document.documentElement.scrollWidth") <= 390, "no sideways scrolling on the phone"
    ph.screenshot(path=f"{OUT}/13c-phone-tracker.png", full_page=True)
    ph.click("[aria-label='Next day']"); ph.wait_for_selector("text=Return to Today"); ph.wait_for_timeout(400)
    assert ph.evaluate("document.documentElement.scrollWidth") <= 390, "look-ahead fits the phone"
    ph.screenshot(path=f"{OUT}/13g-phone-tomorrow.png")
    ph.click("text=Return to Today"); ph.wait_for_selector(".day-nav h2:text('Today')")

    # concurrent edit merge: phone renames a recipe while desktop adds a supplement
    ph.goto(BASE + "#settings"); ph.wait_for_timeout(300)
    pg.goto(BASE + "#settings"); pg.wait_for_timeout(300)
    sp = pg.locator(".panel", has_text="Supplements she takes")
    sp.locator("input[placeholder='e.g. Vegan D3']").fill("Vegan D3")
    sp.locator("select").select_option(label="Vitamin D (µg)"); sp.locator("input[type=number]").fill("25")
    ph.evaluate("Z.api.request('PUT', '/api/settings/profile', {value: {name: 'phone edit', weight_lb: 140}})")
    ph.wait_for_timeout(2500)   # phone saves first; desktop then hits a conflict and must merge
    sp.locator(".btn", has_text="Add").click(); pg.wait_for_timeout(3500)
    d = remote_doc()
    print("desktop local supps:", pg.evaluate("JSON.stringify(Z.store.S.doc.settings.supplements)"), pg.evaluate("Z.store.S.status"), pg.evaluate("Z.store.S.error"))
    print("remote supps:", d["settings"]["supplements"], "profile:", d["settings"]["profile"])
    assert d["settings"]["profile"]["name"] == "phone edit", "phone edit kept"
    assert any(s["name"] == "Vegan D3" for s in d["settings"]["supplements"]), "desktop edit kept"

    # an old week's plan stops showing once its week is over
    pg.goto(BASE + "#plan"); pg.click("text=Week plan"); pg.wait_for_selector(".week")
    pg.evaluate("() => { const cw = JSON.parse(JSON.stringify(Z.store.S.doc.current_week)); cw.week_of = '2020-01-06'; Z.store.setDocField('current_week', cw); }")
    pg.wait_for_timeout(2500)
    pg.reload(); pg.wait_for_selector(".page-head h1:text('Plan')"); pg.wait_for_timeout(800)
    assert pg.locator(".week").count() == 0 and pg.locator(".week-options").count() == 0, "stale plan hidden"
    pg.click(".options .btn.primary"); pg.wait_for_selector(".week", timeout=60000); pg.wait_for_timeout(500)
    assert "current_week" not in remote_doc() or remote_doc()["current_week"]["week_of"] == "2020-01-06", "previews aren't saved"
    pg.click(".confirm-plan >> text=Use this plan"); pg.wait_for_timeout(1500)
    assert remote_doc()["current_week"]["week_of"] != "2020-01-06"
    pg.once("dialog", lambda dlg: dlg.accept())
    pg.click("text=Clear plan"); pg.wait_for_timeout(1500)
    assert pg.locator(".week").count() == 0 and remote_doc()["current_week"] is None
    pg.goto(BASE + "#prep"); pg.wait_for_selector(".empty h2:text('Plan a week first')")

    dk = new_page(viewport={"width": 1440, "height": 1000}, color_scheme="dark")
    dk.goto(link); dk.wait_for_selector(".page-head h1", timeout=20000); dk.wait_for_timeout(800)
    dk.screenshot(path=f"{OUT}/14-dark.png")
    b.close()
srv.shutdown()
bad = [e for e in errors if "fonts.g" not in e and "Failed to load resource" not in e]  # 401/404/409 are expected in this test
print("console/page errors:", bad)
assert not bad
print("ui ok")
