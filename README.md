# Zaijabolical

A vegan meal-prep planner. It keeps a cookbook of recipes, then finds 3–4 dishes to batch-cook on prep day that cover her macro and micronutrient targets for the whole week, and recommends supplements for anything food can't reach.

It runs entirely in the browser at **cedriclevi.com/zaijabolical**. Nothing is installed or running on your computer.

| Where | What |
|---|---|
| This repo (public) | The app's code. No personal data. |
| `zaijabolical-data` (private repo) | Your recipes, pantry, plans, settings and USDA key, in one `data.json` file. The app reads and writes it with an access key that works only for that repo. |
| Each browser | A copy of the data, so the app keeps working offline and syncs when it's back online. |

## Using it
- **Plan → Week plan:** finds sets of 3–4 dishes (you set the range) to cook on prep day, and offers several weeks to choose from, fewest dishes first.
  - Dishes that don't freeze are only scheduled while they're still within their fridge life. Later days come from the freezer.
  - Under *Build around*, pick a dish to build the week around.
- **Plan → Day ideas / Build a day:** the best single-day combinations, or assemble a day yourself and watch the nutrient bars fill.
- **Recipes:** your cookbook, in three views:
  - *Simple*: photo cards.
  - *Advanced*: labelled bars for every recipe (Macros, Vitamins or Minerals), with the essential amino acids as mini-bars under Protein.
  - *List*: a sortable table.
  - Search, filter by rating and sort in every view. Tapping a recipe opens its page (photos, rating, about, ingredients, steps, nutrition, notes, links, attachments); **Edit** unlocks it, and **Print** gives a clean one-page version.
  - **Scan a recipe** turns a photo of a cookbook page or card into a draft recipe for you to check.
  - **Import cookbook** reads a DRM-free EPUB or PDF you own, on your device, and lists the recipes it finds for you to tick. It uses the book's own recipe tags when it has them, then the page layout (titles, ingredient lines, "Serves 4", "Method"…), and offers to have the site's AI read anything left over. Photos are matched to recipes (with an optional AI check), the recipe's page from the book is attached, and anything that isn't vegan (meat, dairy, eggs, honey…) is flagged and left unticked.
- **Pantry → Link ingredients:** imported and scanned recipes can contain ingredients that aren't in the pantry yet. This screen lists each one once (with how many recipes use it) so one tap links it everywhere: to a pantry match, a USDA lookup, or "no nutrition" for things like water.
- **Tracker:** check off what she actually ate (the day's planned meals are filled in). Each day gets a coverage score. A good day scores 85+, 5 good days make a good week (the squirrel's cheeks fill), and 4 good weeks in a month earn a seasonal acorn sticker for that month. All three numbers are in Settings.
- **Pantry:** ingredients with nutrients from USDA FoodData Central, typed in from a package label, or read from a photo of the label (*Scan the label*). *Import starters* adds 55 staples and 16 high-protein prep recipes.
- **Prep day:** a timeline (longest-cooking dish first, prep the next while it simmers), step-by-step clock times, shopping list by aisle, fridge/freezer split and thaw reminders.
- **Settings:**
  - her daily targets;
  - the supplements she takes (these count in every day's totals);
  - the shape of a day;
  - tracker thresholds and her weight (for amino acid needs);
  - device sync, scanning check, backups.

Photos and attachments are shrunk and saved in the private data repo under `media/`, next to `data.json`, so both phones see them.

### Connecting a device
1. **Create an access key** at <https://github.com/settings/personal-access-tokens/new>:
   - *Repository access* → *Only select repositories* → `zaijabolical-data`
   - *Permissions* → *Repository permissions* → *Contents*: **Read and write**
   - Choose the longest expiration offered.
2. **Open the site** and enter your GitHub username, `zaijabolical-data`, and the key.
3. **Connect her phone in one tap:** go to *Settings → Copy setup link*, then send the link to her phone (e.g. by text) and open it there. The link contains the key, so don't post it anywhere public.

When the key expires, the app shows "Sync problem". Create a new key and reconnect in Settings. Your data is safe in the meantime, both on GitHub and on each device.

## Scanning (one-time setup)
Photos are read by AI on your own Cloudflare site, using **Workers AI's free daily allowance** (10,000 "neurons" a day, enough for roughly 50+ scans). No API key or billing is needed. Only a device that holds your GitHub key for the private data repo can use it, and photos aren't stored.

1. **Turn on Workers AI for the site:** in Cloudflare, go to **Workers & Pages → zaijabolical (the Pages project) → Settings → Bindings → Add → Workers AI**. Set the variable name to `AI` and save.
2. **Redeploy:** go to **Deployments**, open the latest deployment's **⋯** menu and choose **Retry deployment** (bindings apply from the next deploy).
3. **Update the route Worker once** so it passes photos through: open the `zaijabolical-route` Worker, choose **Edit code**, paste in `tools/cloudflare-worker.js`, and **Deploy**.
4. In the app, open **Settings → Scanning → Check scanning**. It should say "Scanning works".

Optional:
- **Claude instead of Workers AI** (more accurate on handwriting and messy pages, about 1–3¢ a scan): add a secret `ANTHROPIC_API_KEY` under the Pages project's **Settings → Variables and Secrets**, then redeploy.
- **Different data repo name:** set a variable `DATA_REPO` (e.g. `CedricLevi/zaijabolical-data`).

## Amino acids
USDA lists amino acids for most whole foods (SR Legacy), but not for many brand-name products. The app fills them in automatically for USDA ingredients. The mini-bars show each essential amino acid per gram of protein against the WHO/FAO/UNU (2007) reference pattern; the line marks 100%. They're information only and don't change plan scores.

## How the planner works
It searches over servings in half-serving steps (iterated local search, seeded so results are repeatable). It minimizes:
- **Micronutrient and fiber shortfalls.** The part below 70% of target costs 3× more, so it prefers "everything decent" over "some perfect, some terrible".
- **Macro deviation**, above or below target.
- **Anything over a limit** (sodium, saturated fat).
- **Exceeding a safe upper limit**, which is effectively forbidden.

B12, vitamin D, iodine and algae omega-3 are given low weight. A vegan diet realistically covers them with supplements, so the planner recommends doses instead of contorting the menu.

Results match the HiGHS optimizer used in the original Python version: identical scores on the starter cookbook (see `tests/`).

Default targets are US Dietary Reference Intakes for women 19–30, with iron ×1.8 and zinc ×1.5 for a vegan diet. They're a starting point, not medical advice. Her doctor or a registered dietitian, plus periodic bloodwork (B12, ferritin, vitamin D), is the real check.

## Editing the app
- **Get a local copy:** `tools/install-zaijabolical.bat` clones this repo into your GitHub folder.
- **Preview your changes:** double-click `index.html` to open it in your browser. No server needed.
- **Publish:** commit and push. Cloudflare Pages redeploys in about a minute.

Files:
```
index.html            page shell (+ Content-Security-Policy)
app.css               styles
js/data.js            nutrient catalogue, default targets, starter pantry & recipes
js/core.js            nutrient math, amino acids, scoring, supplement advice, prep sheet & timeline
js/tracker.js         tracker weeks, months and stickers
js/art.js             squirrel drawings (monthly acorn stickers: assets/stickers/)
js/planner.js         day/week planner
js/store.js           storage + GitHub sync (merge by record, newest edit wins)
js/media.js           photos & attachments (this browser + media/ in the data repo)
js/api.js             in-browser "API" the interface talks to; USDA client
js/ui.js              the interface (plan, pantry, prep, settings)
js/ui-recipes.js      recipe views, recipe page, editor, printing, scanning
js/ui-tracker.js      the Tracker
js/ui-import.js       cookbook import (review screen) and Link ingredients
js/cookbook.js        reads EPUB/PDF cookbooks and finds the recipes in them
js/zip.js             tiny ZIP reader for EPUB files
vendor/pdfjs/         Mozilla pdf.js (Apache-2.0), loaded only when importing a PDF
js/worker.js          runs the planner off the main thread
functions/api/scan.js Cloudflare function that reads recipe/label photos
tools/cloudflare-worker.js   serves the app at cedriclevi.com/zaijabolical
tests/                node + Playwright tests (fake GitHub/USDA/scanner; make_books.py builds small test cookbooks)
```
Run the tests with `node tests/core.test.js && node tests/planner.test.js && node tests/worker.test.mjs && node tests/scan.test.mjs && python tests/cookbook_test.py && python tests/ui_test.py`.

## Hosting setup (one time)
1. **Cloudflare Pages:**
   - In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, and pick this repo.
   - Framework: *None*. Build command: *(empty)*. Output directory: `/`.
   - This gives `zaijabolical.pages.dev`. If Cloudflare picks a different name, put it in `APP` in `tools/cloudflare-worker.js`.
2. **Worker:**
   - Go to **Workers & Pages → Create → Worker**, name it `zaijabolical-route`, replace its code with `tools/cloudflare-worker.js`, and deploy.
   - In the Worker's **Settings → Domains & Routes → Add → Route**, enter route `cedriclevi.com/zaijabolical*` on zone `cedriclevi.com`.
3. **Open** <https://cedriclevi.com/zaijabolical/>.
