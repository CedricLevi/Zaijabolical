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
- **Recipes:** add or edit recipes, with live per-serving nutrition. *Plan around this* builds days around a recipe.
- **Pantry:** ingredients with nutrients from USDA FoodData Central, or typed in from a package label. *Import starters* adds 55 staples and 16 high-protein prep recipes.
- **Prep day:** shopping list by aisle, cooking order, fridge/freezer split and thaw reminders.
- **Settings:**
  - her daily targets;
  - the supplements she takes (these count in every day's totals);
  - the shape of a day;
  - device sync;
  - backups.

### Connecting a device
1. **Create an access key** at <https://github.com/settings/personal-access-tokens/new>:
   - *Repository access* → *Only select repositories* → `zaijabolical-data`
   - *Permissions* → *Repository permissions* → *Contents*: **Read and write**
   - Choose the longest expiration offered.
2. **Open the site** and enter your GitHub username, `zaijabolical-data`, and the key.
3. **Connect her phone in one tap:** go to *Settings → Copy setup link*, then send the link to her phone (e.g. by text) and open it there. The link contains the key, so don't post it anywhere public.

When the key expires, the app shows "Sync problem". Create a new key and reconnect in Settings. Your data is safe in the meantime, both on GitHub and on each device.

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
js/core.js            nutrient math, scoring, supplement advice, prep sheet
js/planner.js         day/week planner
js/store.js           storage + GitHub sync (merge by record, newest edit wins)
js/api.js             in-browser "API" the interface talks to; USDA client
js/ui.js              the interface
js/worker.js          runs the planner off the main thread
tools/cloudflare-worker.js   serves the app at cedriclevi.com/zaijabolical
tests/                node + Playwright tests (fake GitHub/USDA)
```
Run the tests with `node tests/core.test.js && node tests/planner.test.js && python tests/ui_test.py`.

## Hosting setup (one time)
1. **Cloudflare Pages:**
   - In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, and pick this repo.
   - Framework: *None*. Build command: *(empty)*. Output directory: `/`.
   - This gives `zaijabolical.pages.dev`. If Cloudflare picks a different name, put it in `APP` in `tools/cloudflare-worker.js`.
2. **Worker:**
   - Go to **Workers & Pages → Create → Worker**, name it `zaijabolical-route`, replace its code with `tools/cloudflare-worker.js`, and deploy.
   - In the Worker's **Settings → Domains & Routes → Add → Route**, enter route `cedriclevi.com/zaijabolical*` on zone `cedriclevi.com`.
3. **Open** <https://cedriclevi.com/zaijabolical/>.
