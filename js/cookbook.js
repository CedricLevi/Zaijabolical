/* Zaijabolical cookbook import: reads an EPUB or PDF on this device and finds the recipes in it.
   Recipes are found in layers, so very different book layouts still work:
     1. tagged:    the book marks recipes up (classes like "ingredient", "step", "yield", or schema.org Recipe)
     2. structure: a title, then ingredient-looking lines, then method paragraphs ("Serves 4", "Method", …)
     3. AI:        anything left that still looks like a recipe is read by the site's scanner (text only)
   Nothing leaves this device except the text/photos sent to the scanner in layer 3 (and photo matching). */
(function (Z) {
  "use strict";

  /* ================================================================ text helpers */
  const FRAC = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
    "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6 };
  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, half: 0.5, dozen: 12 };
  const clean = s => String(s || "").replace(/ /g, " ").replace(/[   ]/g, " ").replace(/\s+/g, " ").trim();
  const FRAC_RE = "[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]";
  const NUM_RE = `(?:\\d+(?:[.,]\\d+)?(?:\\s*${FRAC_RE}|\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|${FRAC_RE})`;
  function num(s) {
    s = String(s).trim().replace(",", ".");
    let v = 0;
    for (const part of s.split(/\s+/)) {
      if (/^\d+\/\d+$/.test(part)) { const [a, b] = part.split("/"); v += +a / +b; continue; }
      const m = /^(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])?$/.exec(part);
      if (m) v += (m[1] ? +m[1] : 0) + (m[2] ? FRAC[m[2]] : 0);
    }
    return v || null;
  }
  const UNITS = ["fluid ounces?", "fl\\.? ?oz", "cups?", "c\\.", "tablespoons?", "tbsps?\\.?", "tbs\\.?", "tbl\\.?", "teaspoons?", "tsps?\\.?",
    "grams?", "g", "kilograms?", "kg", "ounces?", "oz\\.?", "pounds?", "lbs?\\.?", "millilit(?:er|re)s?", "ml", "lit(?:er|re)s?", "l",
    "quarts?", "qt", "pints?", "pt", "cans?", "tins?", "jars?", "packages?", "pkgs?\\.?", "packets?", "bags?", "boxes", "box", "blocks?", "bottles?",
    "cloves?", "heads?", "bunch(?:es)?", "handfuls?", "pinch(?:es)?", "dash(?:es)?", "sprigs?", "slices?", "stalks?", "ribs?", "pieces?",
    "sheets?", "inch(?:es)?", "inch", "leaves", "leaf", "knobs?", "thumbs?", "scoops?", "drops?", "splash(?:es)?", "sticks?", "cubes?",
    "large", "medium", "small", "big", "whole"];
  const UNIT_RE = new RegExp(`^(${UNITS.join("|")})(?=[\\s,.)]|$)\\.?\\s*(?:of\\s+)?`, "i");
  const LEAD_RE = new RegExp(`^(?:about|approx\\.?|approximately|scant|heaping|generous|rounded)?\\s*(${NUM_RE})(?:\\s*(?:-|–|to|or)\\s*(${NUM_RE}))?\\s*`, "i");

  /** "1 1/2 cups red lentils, rinsed" -> {amount:1.5, unit:"cups", name:"red lentils", note:"rinsed"} */
  function parseIngredient(line) {
    let t = clean(line).replace(/^[•·\-–*▪◦]\s*/, "");
    const text = t;
    let amount = null, unit = "", note = [];
    const m = LEAD_RE.exec(t);
    if (m && m[0].trim()) { amount = num(m[1]); t = t.slice(m[0].length); }
    else {
      const w = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half a|half|a dozen)\s+/i.exec(t);
      if (w) { amount = WORDNUM[w[1].toLowerCase().replace(/ a$/, "").replace(/^a /, "")] || 1; t = t.slice(w[0].length); }
    }
    // "2 (15-ounce) cans …": the size in brackets is a note
    const size = /^\(([^)]{1,40})\)\s*/.exec(t);
    if (size) { note.push(size[1]); t = t.slice(size[0].length); }
    const u = UNIT_RE.exec(t);
    if (u && (amount != null || /^(pinch|dash|handful|splash)/i.test(u[1]))) { unit = u[1].replace(/\.$/, ""); t = t.slice(u[0].length); if (amount == null) amount = 1; }
    // second size: "1 (14-ounce) block tofu" handled above; "2 large onions" -> unit large
    const paren = t.match(/\(([^)]*)\)/g);
    if (paren) { for (const p of paren) note.push(p.slice(1, -1)); t = t.replace(/\s*\([^)]*\)\s*/g, " "); }
    let name = t;
    const comma = name.indexOf(",");
    if (comma > 0) { note.push(name.slice(comma + 1)); name = name.slice(0, comma); }
    const taste = /\b(to taste|as needed|for serving|for garnish|optional)\b/i.exec(name);
    if (taste) { note.push(taste[1]); name = name.replace(taste[0], ""); }
    name = clean(name.replace(/^(of|the)\s+/i, "").replace(/[;:.]+$/, ""));
    return { amount, unit, name: name || text, note: clean(note.join(", ")), text };
  }

  const LABEL_RE = /^(ingredients?|for (the|a|serving|garnish)\b.*|to (make|serve|finish|assemble)\b.*|method|directions?|instructions?|preparation|procedure|steps?|notes?|cook'?s notes?|tips?|variations?|equipment|you('| wi)ll need.*|serves.*|makes.*|yields?.*|garnish.*|topping.*|sauce|dressing|marinade|glaze|filling|frosting)\s*:?$/i;
  const YIELD_RE = /^(serves|makes|yields?|servings?|portions?|feeds|for \d+ (people|servings)|active time|total time|prep time|cook time|time|hands-on time)\b/i;
  const looksIngredient = t => {
    t = clean(t);
    if (!t || t.length > 140 || LABEL_RE.test(t) || YIELD_RE.test(t)) return false;
    if (/[.!?]\s+[A-Z][a-z]+\s+\w+/.test(t)) return false;              // several sentences: that's prose
    if (LEAD_RE.test(t) && /^\S*\d|^[½¼¾⅓⅔⅛⅜⅝⅞]/.test(t)) return true;
    if (/^(a|an|one|two|three|four|half)\s+(cups?|tablespoons?|teaspoons?|pinch|handful|dash|large|medium|small|can|clove|bunch|head|package)\b/i.test(t)) return true;
    if (/^(pinch|dash|handful|splash)\b/i.test(t)) return true;
    if (/\b(to taste|for (serving|garnish)|as needed)\b/i.test(t) && t.length < 70) return true;
    return false;
  };
  const looksStep = t => { t = clean(t); return t.length >= 25 && /[a-z]/.test(t) && (/[.!]$/.test(t) || /^\d+[.)]\s/.test(t) || t.length > 80); };

  /** "Serves 4 to 6 · Time: 1 hour 10 minutes (20 active)" -> {servings, total, active} */
  function minutes(s) {
    let m = 0, found = false;
    const re = new RegExp(`(${NUM_RE})\\s*(hours?|hrs?|h|minutes?|mins?|m)\\b`, "gi");
    let x;
    while ((x = re.exec(s))) { found = true; m += num(x[1]) * (/^h/i.test(x[2]) ? 60 : 1); }
    return found ? Math.round(m) : null;
  }
  function parseYield(text) {
    const t = clean(text);
    const out = { servings: null, total: null, prep: null, cook: null };
    const s = new RegExp(`\\b(?:serves|servings?|feeds|for|yields?|makes)\\s*:?\\s*(?:about\\s*)?(${NUM_RE})(?:\\s*(?:-|–|to)\\s*(${NUM_RE}))?`, "i").exec(t);
    if (s) {
      const word = /^\s*(cups?|quarts?|pints?|ounces?|oz|pounds?|lbs?|grams?|g|liters?|ml|tablespoons?|teaspoons?|loaf|loaves|pan|dozen|jars?|batch)\b/i.test(t.slice(s.index + s[0].length));
      if (!word) out.servings = num(s[1]);
      else if (/^\s*jars?\b/i.test(t.slice(s.index + s[0].length))) out.servings = num(s[1]) * 2;
    }
    const grab = re => { const m = re.exec(t); return m ? minutes(m[m.length - 1]) : null; };
    out.prep = grab(/\b(active|hands[- ]on|prep(?:aration)?)\s*(?:time)?\s*:?\s*([^;,|·]*)/i);
    out.cook = grab(/\b(cook(?:ing)?|bake|baking|simmer)\s*(?:time)?\s*:?\s*([^;,|·]*)/i);
    out.total = grab(/\b(total|ready in|start to finish)\s*(?:time)?\s*:?\s*([^;,|·]*)/i) ?? grab(/\btime\s*:?\s*([^;,|·(]*)/i);
    const paren = /\((\d+)\s*(?:min(?:utes)?)?\s*(active|hands[- ]on)\)/i.exec(t);
    if (paren && out.prep == null) out.prep = +paren[1];
    if (out.total == null && out.prep == null && out.cook == null) out.total = minutes(t);
    return out;
  }

  /* ---------------- vegan check ---------------- */
  const NONVEGAN = ["beef", "pork", "bacon", "ham", "lard", "chicken", "turkey", "duck", "lamb", "veal", "venison", "sausage", "prosciutto", "pancetta",
    "salami", "pepperoni", "chorizo", "anchov(?:y|ies)", "fish", "salmon", "tuna", "cod", "tilapia", "trout", "sardines?", "shrimp", "prawns?",
    "crab", "lobster", "scallops?", "clams?", "mussels?", "oysters?", "squid", "octopus", "gelatin(?:e)?", "honey", "eggs?", "egg yolks?",
    "egg whites?", "butter", "buttermilk", "ghee", "cream", "heavy cream", "sour cream", "cream cheese", "milk", "whole milk", "cheese",
    "parmesan", "parmigiano", "pecorino", "mozzarella", "cheddar", "feta", "ricotta", "gruy[eè]re", "brie", "yogh?urt", "whey", "casein",
    "fish sauce", "oyster sauce", "worcestershire", "bone broth", "chicken (?:stock|broth)", "beef (?:stock|broth)", "mayonnaise", "mayo",
    // words that turn up on package ingredient lists
    "lactose", "caseinates?", "sodium caseinate", "milk (?:powder|solids|fat|protein)", "nonfat (?:dry )?milk", "skim milk", "butterfat", "butter ?oil",
    "albumen", "albumin", "egg (?:powder|albumen)", "carmine", "cochineal", "shellac", "confectioner'?s glaze", "lanolin", "isinglass", "beeswax",
    "royal jelly", "tallow", "suet", "collagen", "fish oil", "anchovy paste", "bonito", "dashi"];
  const VEGAN_PREFIX = /\b(vegan|plant[- ]based|non[- ]?dairy|dairy[- ]free|egg[- ]free|soy|almond|oat|coconut|cashew|rice|hemp|flax|chia|pea|nut|vegetable|veggie|mushroom|no[- ]chicken|no[- ]beef|meatless|faux|mock|imitation|vegetarian|seitan|tofu|jackfruit|sunflower|macadamia|hazelnut|pistachio|banana|apple|aquafaba|"|')\s*$/i;
  const VEGAN_WORDS = /\b(eggplants?|butternut|peanut butter|almond butter|cashew butter|nut butter|seed butter|sunflower butter|cocoa butter|apple butter|pumpkin butter|shea butter|butter (beans?|lettuce)|cream of tartar|coconut (milk|cream|butter|yogh?urt)|cream(ed|y)? corn|ice cream maker|egg replacer|flax eggs?|chia eggs?|cheesecloth|creamy|eggless|milk thistle|milkweed|honeydew|honeycrisp|hen[- ]of[- ]the[- ]woods|chicken[- ]of[- ]the[- ]woods|fish[- ]free|beefsteak tomato(es)?|beefsteak|oyster mushrooms?|king oyster|lion'?s mane|nutritional yeast|nooch)\b/gi;
  const NV_RE = new RegExp(`\\b(${[...NONVEGAN].sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");   // longest first: "fish sauce" before "fish"
  /** non-vegan words in a recipe's ingredient lines (and title), ignoring "vegan butter", "eggplant", "coconut milk"… */
  function veganFlags(lines) {
    const hits = new Set();
    for (const raw of lines) {
      const line = clean(raw).replace(VEGAN_WORDS, " ");
      let m;
      NV_RE.lastIndex = 0;
      while ((m = NV_RE.exec(line))) {
        const before = line.slice(Math.max(0, m.index - 28), m.index);
        if (VEGAN_PREFIX.test(before) || /\bor\s+\w+\s*$/i.test(before) && /vegan/i.test(line)) continue;
        if (/\b(vegan|plant[- ]based|dairy[- ]free|non[- ]?dairy|egg[- ]free)\b/i.test(line.slice(m.index, m.index + m[0].length + 30))) continue;
        hits.add(m[1].toLowerCase());
      }
    }
    return [...hits];
  }

  /* ---------------- is a pantry item vegan? ---------------- */
  // ingredients that are often (not always) from animals: worth a look at the package
  const MAYBE = [
    [/\bvitamin d-?3\b|\bcholecalciferol\b/i, /\b(vegan|lichen|plant[- ]based)\b/i, "vitamin D3 (often from lanolin)"],
    [/\bnatural flavou?rs?\b/i, /\bvegan\b/i, "“natural flavors” (can be animal-derived)"],
    [/\bmono-? ?(?:and|&) ?diglycerides\b/i, /\bvegan\b/i, "mono- and diglycerides (sometimes animal fat)"],
    [/\bl-?cysteine\b/i, null, "L-cysteine (often from feathers)"],
    [/\bomega[- ]?3\b/i, /\b(ala|flax|chia|alga[el]?|algal|vegan)\b/i, "omega-3 (often from fish)"],
    [/\bvitamin a palmitate\b/i, null, "vitamin A palmitate (sometimes animal-derived)"],
  ];
  /**
   * { status, reasons } for a pantry item:
   *   "yes" you confirmed it · "no" you said it isn't, or an animal ingredient was found ·
   *   "check" something worth a look (or a brand-name/label item with no ingredient list) · "likely" nothing found.
   * Homemade items take the worst status of their recipe's ingredients (pass ingById and recipeById).
   */
  function pantryVegan(i, ingById, recipeById, seen = new Set()) {
    if (!i) return { status: "check", reasons: [] };
    if (i.vegan === "yes") return { status: "yes", reasons: [] };
    if (i.vegan === "no") return { status: "no", reasons: ["marked not vegan"] };
    if (i.from_recipe && recipeById && ingById) {
      const r = recipeById[i.from_recipe];
      if (!r || seen.has(i.id)) return { status: "check", reasons: [] };
      seen.add(i.id);
      const rank = { yes: 0, likely: 1, check: 2, no: 3 };
      let worst = "yes";
      const reasons = [];
      for (const l of r.ingredients || []) {
        const sub = ingById[l.ingredient_id];
        if (!sub) continue;
        const v = pantryVegan(sub, ingById, recipeById, seen);
        if (rank[v.status] > rank[worst]) worst = v.status;
        if (v.status === "no" || v.status === "check") reasons.push(`${sub.name}: ${v.reasons[0] || (v.status === "no" ? "not vegan" : "unchecked")}`);
      }
      return { status: worst, reasons };
    }
    const text = [i.name, i.usda_description, i.brand, i.ingredients_text].filter(Boolean).join(". ");
    const hits = veganFlags(text.split(/[.;]|,(?![^()]*\))/));
    if (hits.length) return { status: "no", reasons: hits.map(x => `contains ${x}`) };
    const maybe = MAYBE.filter(([re, okIf]) => re.test(text) && !(okIf && okIf.test(text))).map(m => m[2]);
    if (maybe.length) return { status: "check", reasons: maybe };
    if (i.data_type === "Branded" && !i.ingredients_text) return { status: "check", reasons: ["brand-name product: check its ingredient list"] };
    if (i.source === "manual" && !i.ingredients_text) return { status: "check", reasons: ["entered from a label: check its ingredient list"] };
    return { status: "likely", reasons: [] };
  }

  /* ---------------- categories ---------------- */
  const CAT_RULES = [
    ["Breakfast", /\b(breakfast|brunch|morning|pancakes?|waffles?|granola|oats?|oatmeal|porridge|muffins?|scramble|french toast|smoothies?|chia pudding|hash)\b/i],
    ["Add-on", /\b(sauces?|dressings?|condiments?|dips?|spreads?|pesto|gravy|salsa|chutney|relish|pickles?|staples|basics|building blocks|pantry|toppings?|marinades?|glazes?|stocks?|broths?|butters?|creams?|cheeses?|seasonings?|spice (mix|blends?)|kimchi|banchan)\b/i],
    ["Snack", /\b(snacks?|appeti[sz]ers?|starters?|bites|balls|bars|desserts?|sweets|cookies?|cakes?|cupcakes?|brownies?|pies?|tarts?|puddings?|treats?|candy|ice cream|small plates|nibbles|baked goods)\b/i],
    ["Main", /\b(mains?|entr[ée]es?|dinners?|suppers?|lunch|soups?|stews?|chilis?|curr(y|ies)|casseroles?|bowls?|pastas?|noodles?|burgers?|tacos?|burritos?|sandwich(es)?|wraps?|pizzas?|stir[- ]fr(y|ies)|bakes?|one[- ]pot|big plates|hearty|meals?|dumplings|ramen|bibimbap|jjigae|tteok)\b/i],
    ["Side", /\b(sides?|salads?|slaws?|vegetables?|veggies|greens|grains?|rice|breads?|rolls?|biscuits?|potatoes|fries|roasted)\b/i],
  ];
  function guessCategory(chapter, title) {
    for (const s of [title, chapter]) for (const [cat, re] of CAT_RULES) if (s && re.test(s)) return cat;
    return "Main";
  }

  /* ================================================================ blocks
     Every book is turned into a flat list of blocks in reading order:
     {kind: "h"|"p"|"li"|"img", level, text, cls (class names of the block and its parents), doc, page, el, img} */
  const BLOCK_TAGS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "DT", "DD", "FIGCAPTION", "TR", "BLOCKQUOTE", "PRE", "CAPTION"]);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "HEAD", "NAV", "TEMPLATE", "NOSCRIPT"]);
  function hasBlockChild(el) {
    for (const c of el.children) if (BLOCK_TAGS.has(c.tagName.toUpperCase()) || ["DIV", "SECTION", "UL", "OL", "TABLE", "FIGURE", "ASIDE", "ARTICLE", "HEADER", "FOOTER"].includes(c.tagName.toUpperCase())) return true;
    return false;
  }
  function classChain(el, depth = 4) {
    const parts = [];
    for (let e = el, d = 0; e && e.nodeType === 1 && d < depth; e = e.parentElement, d++) {
      const c = (e.getAttribute("class") || "") + " " + (e.getAttribute("epub:type") || e.getAttribute("data-type") || "") + " " + (e.getAttribute("itemprop") || "");
      parts.push(c.trim());
    }
    return parts.join(" | ").toLowerCase();
  }
  function blocksFromDoc(doc, docIndex, resolve) {
    const out = [];
    const body = doc.body || doc.documentElement;
    const walk = el => {
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) return;
      if (tag === "IMG" || tag === "IMAGE") {
        const src = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("xlink:href") || el.getAttributeNS && el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (src) out.push({ kind: "img", src: resolve(src), alt: clean(el.getAttribute("alt") || ""), cls: classChain(el), doc: docIndex, el });
        return;
      }
      const isText = BLOCK_TAGS.has(tag) || ((tag === "DIV" || tag === "SPAN" || tag === "SECTION") && !hasBlockChild(el) && clean(el.textContent));
      if (isText && !(tag === "LI" && hasBlockChild(el) && el.querySelector("p,div"))) {
        el.querySelectorAll("img,image").forEach(walk);
        const text = tag === "TR" ? clean([...el.children].map(c => c.textContent).join(" ")) : clean(el.textContent);   // "1 cup | lentils" -> one line
        if (text) {
          const h = /^H([1-6])$/.exec(tag);
          const strong = [...el.querySelectorAll("b,strong")].map(x => clean(x.textContent)).join(" ");
          out.push({ kind: h ? "h" : tag === "LI" ? "li" : "p", level: h ? +h[1] : 0, text, cls: classChain(el), doc: docIndex, el, tag,
            bold: strong.length >= text.length * 0.9 });
        }
        return;
      }
      for (const c of el.children) walk(c);
    };
    if (body) for (const c of body.children) walk(c);
    return out;
  }

  /* ================================================================ EPUB */
  const dirOf = p => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
  function resolvePath(base, href) {
    try { return decodeURIComponent(new URL(href, "http://book/" + base).pathname.slice(1)); } catch { return href; }
  }
  function parseXml(text, type) {
    const p = new DOMParser();
    let d = p.parseFromString(text, type || "application/xhtml+xml");
    if (d.getElementsByTagName("parsererror").length) d = p.parseFromString(text, "text/html");
    return d;
  }
  async function readEpub(file, progress) {
    const zip = await Z.zip.open(file);
    if (zip.has("META-INF/encryption.xml")) {
      const enc = await zip.text("META-INF/encryption.xml");
      if (/EncryptedData/.test(enc) && !/obfuscation|font/i.test(enc.replace(/<!--[\s\S]*?-->/g, "").replace(/Algorithm="[^"]*(obfuscation|font)[^"]*"/gi, ""))) {
        throw new Error("This book is copy-protected (DRM), so it can't be opened. Books from Kindle, Apple Books and most stores are locked to their own reader.");
      }
    }
    const container = parseXml(await zip.text("META-INF/container.xml") || "", "application/xml");
    const opfPath = (container.querySelector("rootfile") || {}).getAttribute?.("full-path");
    if (!opfPath) throw new Error("This EPUB is missing its table of contents (container.xml).");
    const opf = parseXml(await zip.text(opfPath), "application/xml");
    const base = dirOf(opfPath);
    const meta = t => clean((opf.getElementsByTagName(t)[0] || opf.getElementsByTagNameNS("*", t.split(":")[1] || t)[0] || {}).textContent || "");
    const title = meta("dc:title") || file.name.replace(/\.epub$/i, "");
    const author = meta("dc:creator");
    const manifest = {};
    for (const it of opf.getElementsByTagNameNS("*", "item")) manifest[it.getAttribute("id")] = { href: resolvePath(base, it.getAttribute("href")), type: it.getAttribute("media-type") || "", props: it.getAttribute("properties") || "" };
    const spine = [...opf.getElementsByTagNameNS("*", "itemref")].map(r => manifest[r.getAttribute("idref")]).filter(x => x && /html|xml/.test(x.type));
    let coverId = null;
    for (const m of opf.getElementsByTagNameNS("*", "meta")) if (m.getAttribute("name") === "cover") coverId = m.getAttribute("content");
    const coverHref = (manifest[coverId] || Object.values(manifest).find(x => /cover-image/.test(x.props)) || {}).href || null;

    // table of contents -> chapter names
    const toc = [];
    const navItem = Object.values(manifest).find(x => /\bnav\b/.test(x.props));
    if (navItem) {
      const nav = parseXml(await zip.text(navItem.href));
      const tocNav = [...nav.getElementsByTagName("nav")].find(n => /toc/.test(n.getAttribute("epub:type") || n.getAttributeNS?.("http://www.idpf.org/2007/ops", "type") || "toc")) || nav.getElementsByTagName("nav")[0];
      const walkOl = (ol, depth) => { for (const li of ol.children) {
        if (li.tagName.toUpperCase() !== "LI") continue;
        const a = li.querySelector("a");
        if (a && a.getAttribute("href")) toc.push({ title: clean(a.textContent), href: resolvePath(dirOf(navItem.href), a.getAttribute("href")).split("#")[0], depth });
        const sub = [...li.children].find(c => /^(ol|ul)$/i.test(c.tagName));
        if (sub) walkOl(sub, depth + 1);
      } };
      const ol = tocNav && [...tocNav.children].find(c => /^(ol|ul)$/i.test(c.tagName));
      if (ol) walkOl(ol, 1);
    }
    if (!toc.length) {
      const ncxItem = Object.values(manifest).find(x => /ncx/.test(x.type));
      if (ncxItem) {
        const ncx = parseXml(await zip.text(ncxItem.href), "application/xml");
        const walkNp = (el, depth) => { for (const np of el.children) {
          if (np.localName !== "navPoint") continue;
          const label = np.getElementsByTagNameNS("*", "text")[0], content = np.getElementsByTagNameNS("*", "content")[0];
          if (label && content) toc.push({ title: clean(label.textContent), href: resolvePath(dirOf(ncxItem.href), content.getAttribute("src")).split("#")[0], depth });
          walkNp(np, depth + 1);
        } };
        const navMap = ncx.getElementsByTagNameNS("*", "navMap")[0];
        if (navMap) walkNp(navMap, 1);
      }
    }
    const nested = toc.some(t => t.depth > 1);
    const chapterAt = new Map();
    for (const t of toc) if ((nested ? t.depth === 1 : true) && !chapterAt.has(t.href)) chapterAt.set(t.href, t.title);

    const blocks = [], docs = [];
    let chapter = "";
    for (let i = 0; i < spine.length; i++) {
      const it = spine[i];
      if (chapterAt.has(it.href)) chapter = chapterAt.get(it.href);
      progress && progress(`Reading page ${i + 1} of ${spine.length}…`, i / spine.length);
      const html = await zip.text(it.href);
      if (!html) continue;
      const doc = parseXml(html);
      const bs = blocksFromDoc(doc, i, src => resolvePath(it.href, src));
      for (const b of bs) b.chapter = chapter;
      docs.push({ index: i, href: it.href, chapter, doc, blocks: bs });
      blocks.push(...bs);
      if (i % 20 === 19) await new Promise(r => setTimeout(r));   // keep the page responsive
    }
    // photos: pictures at least 300 × 200 that aren't the cover or a decoration
    const dims = {};
    for (const b of blocks) if (b.kind === "img" && !(b.src in dims)) {
      try { dims[b.src] = zip.size(b.src) > 6000 ? await imageSize(await zip.blob(b.src)) : null; } catch { dims[b.src] = null; }
    }
    for (const b of blocks) if (b.kind === "img") {
      const d = dims[b.src];
      const big = d ? d.w >= 300 && d.h >= 200 && d.w / d.h < 4 && d.h / d.w < 4 : zip.size(b.src) > 30000;
      b.photo = b.src !== coverHref && big && !/\b(ornament|decor\w*|divider|icon|logo|flourish|border|rule|spacer)\b/.test(b.cls + " " + b.src.toLowerCase());
    }
    return { kind: "epub", title, author, blocks, docs, zip,
      photoBlob: async src => zip.blob(src), coverHref };
  }
  /** width/height from the first bytes of a JPEG, PNG, GIF or WebP */
  async function imageSize(blob) {
    const b = new Uint8Array(await blob.slice(0, 131072).arrayBuffer());
    if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
    if (b[0] === 0x47 && b[1] === 0x49) return { w: b[6] | b[7] << 8, h: b[8] | b[9] << 8 };
    if (b[0] === 0x52 && b[8] === 0x57) {   // WebP
      const t = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (t === "VP8X") return { w: 1 + (b[24] | b[25] << 8 | b[26] << 16), h: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
      if (t === "VP8 ") return { w: (b[26] | b[27] << 8) & 0x3fff, h: (b[28] | b[29] << 8) & 0x3fff };
      if (t === "VP8L") return { w: 1 + (b[21] | (b[22] & 0x3f) << 8), h: 1 + ((b[22] >> 6) | b[23] << 2 | (b[24] & 0x0f) << 10) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {   // JPEG: find the frame header
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b[i + 2] << 8 | b[i + 3];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b[i + 7] << 8 | b[i + 8], h: b[i + 5] << 8 | b[i + 6] };
        i += 2 + len;
      }
    }
    return null;
  }

  /* ================================================================ PDF */
  let pdfjs = null;
  async function loadPdfjs() {
    if (pdfjs) return pdfjs;
    const base = new URL("vendor/pdfjs/", document.baseURI).href;
    const lib = await import(base + "pdf.min.mjs");
    lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
    pdfjs = { lib, base };
    return pdfjs;
  }
  async function readPdf(file, progress) {
    const { lib, base } = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    let pdf;
    try {
      pdf = await lib.getDocument({ data, cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/",
        wasmUrl: base + "wasm/", isEvalSupported: false }).promise;
    } catch (e) {
      if (/password/i.test(e && (e.name + e.message))) throw new Error("This PDF is password-protected, so it can't be opened.");
      throw new Error("That PDF couldn't be opened (" + (e && e.message || e) + ").");
    }
    let title = file.name.replace(/\.pdf$/i, "");
    try { const md = await pdf.getMetadata(); if (md && md.info && clean(md.info.Title)) title = clean(md.info.Title); } catch { /* ignore */ }
    const blocks = [], pages = [];
    const OPS = lib.OPS;
    const chapterAtPage = {};
    try {
      const outline = await pdf.getOutline();
      for (const o of outline || []) {
        let dest = o.dest;
        if (typeof dest === "string") dest = await pdf.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) chapterAtPage[(await pdf.getPageIndex(dest[0])) + 1] = clean(o.title);
      }
    } catch { /* no bookmarks */ }
    let chapter = "";
    for (let n = 1; n <= pdf.numPages; n++) {
      progress && progress(`Reading page ${n} of ${pdf.numPages}…`, (n - 1) / pdf.numPages);
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const lines = pdfLines(tc.items, vp);
      // images: walk the drawing operations and note where each picture lands on the page
      const photos = [];
      try {
        const ops = await page.getOperatorList();
        let ctm = [1, 0, 0, 1, 0, 0];
        const stack = [];
        const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
          a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i], args = ops.argsArray[i];
          if (fn === OPS.save) stack.push(ctm.slice());
          else if (fn === OPS.restore) ctm = stack.pop() || ctm;
          else if (fn === OPS.transform) ctm = mul(ctm, args);
          else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintJpegXObject) {
            const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => vp.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
            const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
            const box = [Math.max(0, Math.min(...xs)), Math.max(0, Math.min(...ys)), Math.min(vp.width, Math.max(...xs)), Math.min(vp.height, Math.max(...ys))];
            const area = (box[2] - box[0]) * (box[3] - box[1]) / (vp.width * vp.height);
            if (area > 0.08 && box[2] - box[0] > 90 && box[3] - box[1] > 90) photos.push({ box, area });
          }
        }
      } catch { /* pictures are optional */ }
      const textLen = lines.reduce((a, l) => a + l.text.length, 0);
      pages.push({ n, width: vp.width, height: vp.height, textLen, photos: dedupeBoxes(photos) });
      if (chapterAtPage[n]) chapter = chapterAtPage[n];
      const body = lines.map(l => ({ ...l, page: n, chapter }));
      for (const ph of pages[n - 1].photos) body.push({ kind: "img", src: `pdf:${n}:${ph.box.map(Math.round).join(",")}`, alt: "", cls: "", page: n,
        y: ph.box[1], photo: true, box: ph.box, fullPage: ph.area > 0.55, chapter });
      body.sort((a, b) => (a.col || 0) - (b.col || 0) || a.y - b.y);
      for (const b of body) { b.doc = n - 1; blocks.push(b); }
      page.cleanup();
      if (n % 10 === 0) await new Promise(r => setTimeout(r));
    }
    // a book that is all pictures and no text was scanned: its pages need the photo scanner
    const scanned = pages.filter(p => p.textLen < 40 && p.photos.some(ph => ph.area > 0.5)).length;
    return { kind: "pdf", title, author: "", blocks, pages, pdf, scanned: scanned > pages.length * 0.6,
      photoBlob: async src => renderPdfRegion(pdf, src), pageImage: async (n, scale) => renderPdfPage(pdf, n, scale) };
  }
  function dedupeBoxes(list) {
    const out = [];
    for (const p of list.sort((a, b) => b.area - a.area)) {
      if (!out.some(o => p.box[0] >= o.box[0] - 4 && p.box[1] >= o.box[1] - 4 && p.box[2] <= o.box[2] + 4 && p.box[3] <= o.box[3] + 4)) out.push(p);
    }
    return out;
  }
  /** text items -> lines in reading order (handles two-column pages), headings by font size */
  function pdfLines(items, vp) {
    const segs = [];
    for (const it of items) {
      if (!it.str || !it.str.trim()) { if (it.hasEOL && segs.length) segs[segs.length - 1].eol = true; continue; }
      const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      segs.push({ x, y, w: it.width, size, str: it.str, font: it.fontName });
    }
    segs.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = [];
    for (const s of segs) {
      const r = rows.find(r => Math.abs(r.y - s.y) < Math.max(2.5, s.size * 0.35));
      if (r) r.segs.push(s); else rows.push({ y: s.y, segs: [s] });
    }
    const W = vp.width;
    const pieces = [];
    for (const r of rows) {
      r.segs.sort((a, b) => a.x - b.x);
      let cur = null;
      for (const s of r.segs) {
        if (cur && s.x - (cur.x2) > Math.max(W * 0.05, s.size * 2.2)) { pieces.push(cur); cur = null; }
        if (!cur) cur = { x: s.x, x2: s.x + s.w, y: r.y, size: s.size, str: s.str, fonts: [s.font] };
        else { cur.str += (s.x - cur.x2 > s.size * 0.15 && !/\s$/.test(cur.str) ? " " : "") + s.str; cur.x2 = s.x + s.w; cur.size = Math.max(cur.size, s.size); cur.fonts.push(s.font); }
      }
      if (cur) pieces.push(cur);
    }
    // two columns when plenty of text starts right of the middle
    const right = pieces.filter(p => p.x > W * 0.45).length, left = pieces.filter(p => p.x2 < W * 0.55).length;
    const twoCol = right > 6 && left > 6 && right / pieces.length > 0.25;
    for (const p of pieces) p.col = twoCol && p.x > W * 0.45 ? 1 : 0;
    const sizes = pieces.map(p => p.size).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)] || 10;
    pieces.sort((a, b) => a.col - b.col || a.y - b.y || a.x - b.x);
    // join wrapped lines into paragraphs; keep ingredient lines and headings separate
    const out = [];
    for (const p of pieces) {
      const text = clean(p.str);
      if (!text || /^\d{1,3}$/.test(text)) continue;   // page numbers
      const heading = p.size >= median * 1.25 && text.length < 90;
      const last = out[out.length - 1];
      const gap = last ? p.y - last.yEnd : 99;
      const startsNew = heading || !last || last.kind === "h" || last.col !== p.col || gap > p.size * 1.65 || gap < 0 || looksIngredient(text) || /^\d+[.)]\s/.test(text)
        || looksIngredient(last.text) || YIELD_RE.test(text) || LABEL_RE.test(text) || LABEL_RE.test(last.text);
      if (startsNew) out.push({ kind: heading ? "h" : "p", level: heading ? (p.size >= median * 1.8 ? 1 : 2) : 0, text, y: p.y, yEnd: p.y, col: p.col, size: p.size, cls: "" });
      else { last.text = clean(last.text.replace(/-$/, "") + (last.text.endsWith("-") ? "" : " ") + text); last.yEnd = p.y; }
    }
    return out;
  }
  async function renderPdfPage(pdf, n, scale = 1.6) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise;
    page.cleanup();
    return new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  }
  async function renderPdfRegion(pdf, src) {
    const [, n, box] = src.split(":");
    const [x0, y0, x1, y1] = box.split(",").map(Number);
    const page = await pdf.getPage(+n);
    const scale = Math.min(3, Math.max(1, 1600 / Math.max(1, x1 - x0)));
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise;
    page.cleanup();
    const crop = document.createElement("canvas");
    crop.width = Math.round((x1 - x0) * scale); crop.height = Math.round((y1 - y0) * scale);
    crop.getContext("2d").drawImage(c, x0 * scale, y0 * scale, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return new Promise(r => crop.toBlob(r, "image/jpeg", 0.88));
  }

  /* ================================================================ finding recipes */
  const ROLE = {
    ingredient: /\b[\w-]*ingred[\w-]*\b|recipeingredient/,
    step: /\b[\w-]*(step|direction|method|procedure|instruction|prep-?step|recipeinstructions)[\w-]*\b/,
    yield: /\b[\w-]*(yield|serv(es|ing)|makes|portion|recipeyield|cooktime|preptime|totaltime|rec-?time)[\w-]*\b/,
    headnote: /\b[\w-]*(headnote|head-note|intro|description|chapeau|recipe-?desc|blurb)[\w-]*\b/,
    note: /\b[\w-]*(note|tip|variation|cooks-?note|hint|sidebar)[\w-]*\b/,
    title: /\b[\w-]*(recipe-?title|rec-?title|recipe-?name|recipe-?head|recipetitle|recipe_title|rhead|rtitle)[\w-]*\b|\bname\b/,
  };
  const ownCls = b => (b.cls || "").split(" | ")[0];
  function role(b) {
    const own = ownCls(b), near = (b.cls || "").split(" | ").slice(0, 2).join(" ");
    if (ROLE.title.test(own) && !ROLE.ingredient.test(own)) return "title";
    if (ROLE.ingredient.test(near) && !/title|head|label/.test(own)) return "ingredient";
    if (ROLE.yield.test(own)) return "yield";
    if (ROLE.step.test(near) && !/title|head|label/.test(own)) return "step";
    if (ROLE.headnote.test(near)) return "headnote";
    if (ROLE.note.test(own)) return "note";
    return null;
  }
  /** could this be a recipe title (short, not a sentence)? Long text in a heading style is a description. */
  const isTitleText = t => { t = clean(t); return t.length > 1 && t.length <= 80 && t.split(" ").length <= 13 && !/[.!?;:,]$/.test(t) && !/[a-z]\.\s+[A-Z]/.test(t); };
  const nonLatin = t => /[^\u0000-\u024f\u2000-\u206f\s\d]/.test(t);
  const isLabel = t => LABEL_RE.test(clean(t)) || /^(ingredients|method|directions|instructions)\b/i.test(t);
  /** a short, title-like paragraph (books that style titles with classes instead of headings) */
  const TITLE_CLS = /\b(rt|title|head|heading|name|recipe-?name|rec-?head|hd)\b/;
  const pseudoHeading = (b, next) => {
    if (b.kind !== "p" || b.text.length > 70 || /[.,;:!?]$/.test(b.text) || looksIngredient(b.text) || YIELD_RE.test(b.text) || /^(FIGCAPTION|CAPTION|TD|TH)$/.test(b.tag || "")) return false;
    if ((b.bold || TITLE_CLS.test(ownCls(b))) && b.text.length > 2) return true;
    const titleCase = b.text === b.text.toUpperCase() || /^([A-Z0-9][\w'’&-]*\s*)+$/.test(b.text.replace(/\b(and|or|with|of|the|a|an|in|on|for|to)\b/g, "X"));
    return titleCase && next.slice(0, 5).some(n => n.kind !== "img" && (looksIngredient(n.text) || YIELD_RE.test(n.text)));
  };

  function makeRecipe(o) {
    const ings = o.ingredients.map(t => (typeof t === "string" ? { text: t } : t)).filter(x => clean(x.text));
    return {
      title: clean(o.title) || "Untitled recipe", chapter: o.chapter || "", method: o.method, yieldText: clean(o.yieldText || ""),
      description: clean(o.description || ""), ingredients: ings, steps: (o.steps || []).map(clean).filter(Boolean), notes: clean(o.notes || ""),
      blocks: o.blocks || [], docs: [...new Set((o.blocks || []).map(b => b.doc))], pages: [...new Set((o.blocks || []).map(b => b.page).filter(Boolean))],
      firstIndex: o.firstIndex ?? 0, lastIndex: o.lastIndex ?? 0, photoSrcs: o.photoSrcs || [],
    };
  }

  /** layer 1: recipes the book has tagged */
  function taggedRecipes(book) {
    const found = [], used = new Set();
    const byDoc = new Map();
    book.blocks.forEach((b, i) => { b.i = i; if (!byDoc.has(b.doc)) byDoc.set(b.doc, []); byDoc.get(b.doc).push(b); });
    for (const [, bs] of byDoc) {
      const roles = bs.map(role);
      if (roles.filter(r => r === "ingredient").length < 2) continue;
      // split the page into recipes: a new recipe starts at a title (tagged or heading) that comes after ingredients
      let cur = null;
      const flush = () => { if (cur && cur.ingredients.length >= 2) found.push(cur); cur = null; };
      for (let k = 0; k < bs.length; k++) {
        const b = bs[k], r = roles[k];
        const titleish = (r === "title" || (b.kind === "h" && !isLabel(b.text)) || (b.el && b.el.closest && b.el.closest("[itemprop=name]"))) && isTitleText(b.text);
        if (b.kind === "img") { if (cur) cur.photoSrcs.push(b.src); else (bs.pendingImgs = bs.pendingImgs || []).push(b.src); continue; }
        if (titleish && r !== "ingredient" && r !== "step") {
          if (!cur || cur.ingredients.length) { flush(); cur = { title: b.text, chapter: b.chapter, method: "tagged", ingredients: [], steps: [], blocks: [b], firstIndex: b.i, lastIndex: b.i, photoSrcs: bs.pendingImgs || [], description: "", notes: "", yieldText: "" }; bs.pendingImgs = []; }
          else if (cur && !cur.ingredients.length) {
            // a second title-like line before the ingredients: a subtitle (often the dish's name in another language)
            if (!cur.title) cur.title = b.text;
            else if ((nonLatin(b.text) || /^\(.*\)$/.test(b.text)) && !cur.title.includes(b.text)) cur.title += ` (${b.text.replace(/^\(|\)$/g, "")})`;
            else cur.description += (cur.description ? "\n" : "") + b.text;
            cur.blocks.push(b);
          }
          continue;
        }
        if (!cur) {
          if (r === "ingredient" || r === "yield" || r === "headnote") {
            // no title yet: use the nearest earlier heading on this page
            const prevH = [...bs.slice(0, k)].reverse().find(x => x.kind === "h" && !isLabel(x.text))
              || [...book.blocks.slice(Math.max(0, b.i - 12), b.i)].reverse().find(x => x.kind === "h" && !isLabel(x.text) && x.doc !== b.doc);
            cur = { title: prevH ? prevH.text : "", chapter: b.chapter, method: "tagged", ingredients: [], steps: [], blocks: [], firstIndex: b.i, lastIndex: b.i, photoSrcs: bs.pendingImgs || [], description: "", notes: "", yieldText: "" };
          } else continue;
        }
        cur.blocks.push(b); cur.lastIndex = b.i;
        if (isLabel(b.text) && b.text.length < 40 && r !== "yield") {
          if (/^for |^to /i.test(b.text)) cur.group = b.text.replace(/:$/, "");
          continue;
        }
        if (r === "ingredient") cur.ingredients.push({ text: b.text, group: cur.group || "" });
        else if (r === "step") cur.steps.push(b.text);
        else if (r === "yield") cur.yieldText += (cur.yieldText ? " · " : "") + b.text;
        else if (r === "headnote") cur.description += (cur.description ? "\n" : "") + b.text;
        else if (r === "note") cur.notes += (cur.notes ? "\n" : "") + b.text;
        else if (cur.ingredients.length && !cur.steps.length && looksStep(b.text)) cur.steps.push(b.text);
        else if (cur.steps.length && b.kind !== "h") cur.notes += (cur.notes ? "\n" : "") + b.text;
        else if (!cur.ingredients.length && b.kind === "p") cur.description += (cur.description ? "\n" : "") + b.text;
      }
      flush();
    }
    for (const r of found) for (const b of r.blocks) used.add(b.i);
    return { recipes: found.map(makeRecipe), used };
  }

  /** layer 2: recipes found from the shape of the text */
  function structuralRecipes(book, used) {
    const bs = book.blocks.filter(b => !used.has(b.i));
    const found = [];
    const titleAt = k => {
      const b = bs[k];
      if (b.kind === "img" || isLabel(b.text) || looksIngredient(b.text) || YIELD_RE.test(b.text)) return false;
      if (b.kind === "h") return isTitleText(b.text);
      return pseudoHeading(b, bs.slice(k + 1, k + 6));
    };
    let k = 0;
    while (k < bs.length) {
      if (!titleAt(k)) { k++; continue; }
      const start = k, title = bs[k];
      let j = k + 1;
      const sec = [];
      let sawIng = 0, sawSteps = 0, subtitle = "";
      while (j < bs.length) {
        const b = bs[j];
        if (!sawIng && b.kind === "h" && title.kind === "h" && b.level > title.level && !sawSteps && !isLabel(b.text) && (nonLatin(b.text) || /^\(.*\)$/.test(b.text)) && isTitleText(b.text)
          && !sec.some(x => x.kind === "h")) { subtitle = b.text; sec.push(b); j++; continue; }   // a subtitle, often the dish's name in another language
        if (!sawIng && b.kind !== "img" && b.text !== title.text && (b.kind === "h" || title.kind !== "h") && titleAt(j)) break;   // a closer title before any ingredients: the recipe starts there
        if (b.kind !== "img" && b.text === title.text) { j++; continue; }   // a caption repeating the title
        if (b.kind === "h" && !isLabel(b.text) && (sawIng || b.level && title.level && b.level <= title.level) && !(b.level > (title.level || 1) && !sawSteps)) break;
        if (b.kind !== "img" && titleAt(j) && sawIng >= 2 && sawSteps) break;
        if (b.kind === "p" && pseudoHeading(b, bs.slice(j + 1, j + 6)) && sawIng >= 2 && sawSteps) break;
        sec.push(b);
        if (b.kind !== "img" && looksIngredient(b.text)) sawIng++;
        else if (sawIng && b.kind !== "img" && looksStep(b.text)) sawSteps++;
        j++;
        if (sec.length > 140) break;
      }
      if (sawIng >= 2 && sawSteps >= 1) {
        const r = { title: subtitle ? `${title.text} (${subtitle})` : title.text, chapter: title.chapter, method: "structure", ingredients: [], steps: [], description: "", notes: "", yieldText: "",
          blocks: [title, ...sec], firstIndex: title.i, lastIndex: (sec[sec.length - 1] || title).i, photoSrcs: [] };
        let mode = "intro", group = "";
        for (const b of sec) {
          if (b.kind === "h" && b.text === subtitle) continue;
          if (b.kind === "img") { const lastText = [...sec].reverse().find(x => x.kind !== "img"); if (lastText && lastText.i > b.i) r.photoSrcs.push(b.src); continue; }
          const t = b.text;
          if (YIELD_RE.test(t) || /^(serves|makes)\s/i.test(t) || (/\b(serves|makes|yield)\s*:?\s*\d/i.test(t) && t.length < 120)) { r.yieldText += (r.yieldText ? " · " : "") + t; continue; }
          if (isLabel(t) && t.length < 50) {
            if (/^ingredients?/i.test(t)) mode = "ing";
            else if (/^(method|directions?|instructions?|preparation|procedure|steps?)/i.test(t)) mode = "steps";
            else if (/^(notes?|tips?|variations?|cook'?s notes?)/i.test(t)) mode = "notes";
            else if (/^(for|to) /i.test(t)) { group = t.replace(/:$/, ""); if (mode !== "steps") mode = "ing"; }
            continue;
          }
          if (mode !== "notes" && looksIngredient(t)) { r.ingredients.push({ text: t, group }); mode = "ing"; continue; }
          if (mode === "notes") { r.notes += (r.notes ? "\n" : "") + t; continue; }
          if (r.ingredients.length && (looksStep(t) || mode === "steps")) { r.steps.push(t); mode = "steps"; continue; }
          if (!r.ingredients.length) { r.description += (r.description ? "\n" : "") + t; continue; }
          r.notes += (r.notes ? "\n" : "") + t;
        }
        found.push(r);
        k = j;
      } else k = start + 1;
    }
    const usedNow = new Set(used);
    for (const r of found) for (const b of r.blocks) usedNow.add(b.i);
    return { recipes: found.map(makeRecipe), used: usedNow };
  }

  /** layer 3: stretches of text that still look like recipes, for the AI to read */
  function leftovers(book, used) {
    const groups = new Map();
    for (const b of book.blocks) {
      if (used.has(b.i) || b.kind === "img") continue;
      const key = book.kind === "pdf" ? b.page : b.doc;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
    const out = [];
    let run = null;
    const finish = () => { if (run && run.score >= 3) out.push(run); run = null; };
    for (const [key, bs] of groups) {
      const all = bs.map(b => b.text).join(" ");
      const qty = (all.match(/\b(\d+|a|an|one|two|three|four|half a)\s+(cups?|tablespoons?|teaspoons?|cloves?|cans?|grams?|ounces?|pounds?|handfuls?|pinch)\b/gi) || []).length;
      const score = bs.filter(b => looksIngredient(b.text)).length + 2 * bs.filter(b => YIELD_RE.test(b.text)).length
        + qty + (/\b(serves|makes)\s+(about\s+)?\d/i.test(all) ? 2 : 0);
      const text = bs.map(b => (b.kind === "h" ? "\n## " : "") + b.text).join("\n");
      if (score < 2) { finish(); continue; }
      if (run && run.text.length + text.length < 9000) { run.text += "\n\n" + text; run.score += score; run.keys.push(key); run.blocks.push(...bs); }
      else { finish(); run = { text, score, keys: [key], blocks: [...bs] }; }
    }
    finish();
    return out;
  }

  /** photos: which recipe does each picture belong to? */
  /** does this book put each photo before its recipe? Votes from photos that sit on a recipe's own page:
      before the title -> photos come first; after the title -> photos follow. Captions naming a recipe vote too. */
  function guessPhotosFirst(book, recipes) {
    let first = 0, last = 0;
    for (const r of recipes) {
      const t = book.blocks[r.firstIndex];
      if (!t) continue;
      for (const b of book.blocks.filter(x => x.kind === "img" && x.photo && (book.kind === "pdf" ? x.page === t.page : x.doc === t.doc))) {
        if (b.i < r.firstIndex) first++; else if (b.i <= r.lastIndex + 3) last++;
      }
    }
    return first > last;
  }
  function assignPhotos(book, recipes, after) {
    if (after == null) after = guessPhotosFirst(book, recipes);
    book.photosFirst = after;
    const photos = book.blocks.filter(b => b.kind === "img" && b.photo);
    const seen = new Set();
    const list = [];
    for (const p of photos) { if (seen.has(p.src)) continue; seen.add(p.src); list.push(p); }
    const sorted = [...recipes].sort((a, b) => a.firstIndex - b.firstIndex);
    for (const r of sorted) { r.photoCandidates = []; r.photo = null; }
    const words = s => new Set(String(s || "").toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3));
    for (const p of list) {
      // inside a recipe's own blocks: that recipe
      const own = sorted.find(r => r.photoSrcs.includes(p.src) || (book.kind === "pdf" && r.pages.includes(p.page) && !p.fullPage));
      if (own) { own.photoCandidates.push(p.src); continue; }
      const idx = p.i;
      const before = [...sorted].reverse().find(r => r.firstIndex <= idx);
      const nextR = sorted.find(r => r.firstIndex > idx);
      // a caption or alt text naming the recipe decides it
      const inRecipe = new Set(sorted.flatMap(r => r.blocks.map(b => b.i)));
      const near = book.blocks.slice(Math.max(0, idx - 2), idx + 3)
        .filter(b => b.kind !== "img" && b.text.length < 120 && !inRecipe.has(b.i) && (book.kind === "pdf" ? b.page === p.page : b.doc === p.doc))
        .map(b => b.text).join(" ") + " " + (/^(book image|image|photo|picture|figure)\b/i.test(p.alt) ? "" : p.alt);
      const w = words(near);
      const score = r => (r ? [...words(r.title)].filter(x => w.has(x)).length : 0);
      let pick;
      if (score(before) || score(nextR)) pick = score(nextR) > score(before) ? nextR : before;
      else pick = after ? nextR || before : before || nextR;
      for (const r of [before, nextR]) if (r && !r.photoCandidates.includes(p.src)) r.photoCandidates.push(p.src);
      if (pick) { pick.photoAuto = pick.photoAuto || []; pick.photoAuto.push(p.src); }
    }
    for (const r of sorted) r.photo = (r.photoSrcs.find(s => list.some(p => p.src === s)) || (r.photoAuto || [])[0] || null);
    return list;
  }

  /** everything together: layers 1 and 2 now; layer 3 is returned as work for the AI */
  function findRecipes(book) {
    book.blocks.forEach((b, i) => { b.i = i; });
    const t = taggedRecipes(book);
    const s = structuralRecipes(book, t.used);
    const recipes = [...t.recipes, ...s.recipes].sort((a, b) => a.firstIndex - b.firstIndex);
    const left = leftovers(book, s.used);
    return { recipes, aiWork: left };
  }

  /** turn a found recipe into the shape the recipe editor/draft uses */
  function toDraftShape(r) {
    if (!isTitleText(r.title)) {
      const alt = (r.blocks || []).find(b => b.kind !== "img" && isTitleText(b.text) && !isLabel(b.text) && !looksIngredient(b.text) && !YIELD_RE.test(b.text));
      if (!r.description) r.description = r.title;
      r.title = alt ? alt.text : r.title.split(/[.!?:;]/)[0].split(" ").slice(0, 8).join(" ");
    }
    const y = parseYield(r.yieldText + " " + (r.description.match(/\b(serves|makes)\s+\d[^.]*/i) || [""])[0]);
    let prep = y.prep, cook = y.cook;
    if (y.total != null) {
      if (prep == null && cook == null) prep = Math.min(30, Math.round(y.total / 3));
      if (cook == null) cook = Math.max(0, y.total - (prep || 0));
      if (prep == null) prep = Math.max(0, y.total - cook);
    }
    return {
      name: r.title.replace(/\s+/g, " ").replace(/^(\d+[.)]\s*)/, "").replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase()),
      servings: y.servings, category: guessCategory(r.chapter, r.title), prep_min: prep, cook_min: cook,
      description: r.description,
      ingredients: r.ingredients.map(i => {
        const p = parseIngredient(i.text);
        return { ...p, note: [p.note, i.group ? i.group.toLowerCase() : ""].filter(Boolean).join("; "), unclear: !p.name || p.name.length > 60 };
      }).filter(i => i.name),
      steps: r.steps.map(s => s.replace(/^\d+[.)]\s*/, "")), notes: r.notes,
    };
  }
  /** the recipe's own page from the book as a small, script-free web page */
  function recipePageHtml(r, book) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const body = r.blocks.filter(b => b.kind !== "img").map(b => (b.kind === "h" ? `<h${Math.min(4, Math.max(1, b.level || 2))}>${esc(b.text)}</h${Math.min(4, Math.max(1, b.level || 2))}>`
      : b.kind === "li" || role(b) === "ingredient" ? `<p class="ing">${esc(b.text)}</p>` : `<p>${esc(b.text)}</p>`)).join("\n");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
body{font:16px/1.55 Georgia,serif;max-width:680px;margin:24px auto;padding:0 18px;color:#222;background:#fffdf7}
h1,h2,h3,h4{font-family:system-ui,sans-serif;line-height:1.2}.ing{margin:.2em 0;padding-left:1em;text-indent:-1em}.src{color:#777;font:13px system-ui,sans-serif}
</style></head><body><p class="src">${esc(book.title)}${r.chapter ? " · " + esc(r.chapter) : ""}</p>
${body}</body></html>`;
  }

  async function read(file, progress) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file, progress);
    if (name.endsWith(".epub") || file.type === "application/epub+zip") return readEpub(file, progress);
    throw new Error("Choose an EPUB or PDF file.");
  }

  Z.cookbook = { read, findRecipes, assignPhotos, toDraftShape, recipePageHtml, parseIngredient, parseYield, veganFlags, pantryVegan, guessCategory,
    looksIngredient, looksStep, _blocksFromDoc: blocksFromDoc };
})(globalThis.Z = globalThis.Z || {});
