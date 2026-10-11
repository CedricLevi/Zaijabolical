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
def usda_food(item, idx):
    ing = by_seed[item["key"]]
    nuts = [{"nutrientId": NUTS[k], "value": v} for k, v in ing["nutrients"].items() if k in NUTS]
    desc = ", ".join(w.capitalize() if j == 0 else w for j, w in enumerate(item["must"])) + " (test data)"
    return {"fdcId": 900000 + idx, "description": desc, "dataType": item["types"][0], "foodNutrients": nuts}
PANTRY = json.load(open(os.path.join(ROOT, "tests", "fixtures", "pantry.json")))
FOODS = {p["query"]: usda_food(p, i) for i, p in enumerate(PANTRY)}
usda_calls = []
def handle_usda(route, request):
    usda_calls.append(request.url)
    if "/foods/search" in request.url:
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
    h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,PUT,OPTIONS"}
    if m == "OPTIONS": return route.fulfill(status=204, headers=h)
    if request.headers.get("authorization") != "Bearer test-token":
        return route.fulfill(status=401, content_type="application/json", body='{"message":"Bad credentials"}', headers=h)
    path = url.split("/repos/cedric/zaijabolical-data")[1] if "/repos/cedric/zaijabolical-data" in url else None
    if path is None:
        return route.fulfill(status=404, content_type="application/json", body='{"message":"Not Found"}', headers=h)
    if path == "" and m == "GET":
        return route.fulfill(status=200, content_type="application/json", body=json.dumps({"private": True, "permissions": {"push": True}}), headers=h)
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

    # week plan
    pg.goto(BASE + "#plan"); pg.wait_for_timeout(300)
    t = time.time(); pg.click(".options .btn.primary"); pg.wait_for_selector(".week-options", timeout=60000)
    print("week planned in", round(time.time() - t, 1), "s")
    pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/05-week.png", full_page=True)
    pg.click(".wopt >> nth=1"); pg.wait_for_timeout(2500)
    chosen = pg.inner_text(".panel-head .muted.small")
    d = remote_doc(); assert d["current_week"] and d["current_week"]["choice"] == 1 and d["week_options"]

    # build around + day ideas
    pg.select_option(".anchors select", label="Black Bean, Sweet Potato & TVP Chili")
    pg.click("text=Day ideas"); pg.click("text=Find combinations"); pg.wait_for_selector(".combo", timeout=60000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{OUT}/06-ideas.png")
    assert pg.locator(".combo .anchor-mark").count() >= 3
    pg.click(".combo >> nth=0 >> text=Open in day builder"); pg.wait_for_timeout(800)
    pg.screenshot(path=f"{OUT}/07-builder.png", full_page=True)

    # recipes + editor + new recipe
    pg.goto(BASE + "#recipes"); pg.wait_for_timeout(400); pg.screenshot(path=f"{OUT}/08-recipes.png")
    pg.click(".rcard >> nth=2"); pg.wait_for_timeout(800); pg.screenshot(path=f"{OUT}/09-editor.png")
    pg.keyboard.press("Escape")
    pg.click("text=New recipe"); pg.fill(".drawer input >> nth=0", "Test lentil bowl")
    pg.click("text=Add ingredient >> nth=0"); pg.click(".ing-pick input"); pg.fill(".ing-pick input", "lent")
    pg.click(".ing-pick .menu button >> nth=0"); pg.wait_for_timeout(600)
    pg.click("text=Add recipe"); pg.wait_for_timeout(2500)
    assert any(r["name"] == "Test lentil bowl" for r in remote_doc()["recipes"])

    # prep + settings
    pg.goto(BASE + "#prep"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/10-prep.png", full_page=True)
    pg.goto(BASE + "#settings"); pg.wait_for_timeout(500); pg.screenshot(path=f"{OUT}/11-settings.png")
    link = pg.evaluate("Z.store.setupLink()")
    assert "#connect=" in link

    # second device via setup link (phone)
    ph = new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ph.goto(link.replace("http://127.0.0.1:8765/", BASE)); ph.wait_for_selector(".week, .week-options", timeout=20000); ph.wait_for_timeout(800)
    assert "connect=" not in ph.url, "token removed from the address bar"
    print("phone scrollWidth", ph.evaluate("document.documentElement.scrollWidth"))
    ph.screenshot(path=f"{OUT}/12-phone.png")
    assert ph.inner_text(".panel-head .muted.small") == chosen, "phone shows the same chosen week"
    ph.goto(BASE + "#recipes"); ph.wait_for_timeout(500); ph.screenshot(path=f"{OUT}/13-phone-recipes.png")

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

    dk = new_page(viewport={"width": 1440, "height": 1000}, color_scheme="dark")
    dk.goto(link); dk.wait_for_selector(".week", timeout=20000); dk.wait_for_timeout(800)
    dk.screenshot(path=f"{OUT}/14-dark.png")
    b.close()
srv.shutdown()
bad = [e for e in errors if "fonts.g" not in e and "Failed to load resource" not in e]  # 401/404/409 are expected in this test
print("console/page errors:", bad)
assert not bad
print("ui ok")
