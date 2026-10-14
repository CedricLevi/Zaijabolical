/* Zaijabolical interface: importing cookbooks (EPUB/PDF) and linking ingredients to the pantry in bulk.
   Loaded after ui.js and ui-recipes.js and uses their helpers. */
"use strict";

Object.assign(ICONS, {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chain: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
});

/* ================================================================
   IMPORT A COOKBOOK
   ================================================================ */
const AI_CHUNKS_PER_RUN = 25;   // keeps one import well inside the scanner's free daily allowance

function openImportCookbook() {
  const close = () => scrim.remove();
  const body = h("div", { class: "drawer-body scan-body" });
  const input = h("input", { type: "file", accept: ".epub,.pdf,application/epub+zip,application/pdf", class: "hidden", onchange: e => { const f = e.target.files[0]; if (f) start(f); } });
  body.append(
    h("p", null, "Add recipes from a cookbook you own as an EPUB or PDF. The book is read on this device; you pick which recipes to keep before anything is saved."),
    h("ul", { class: "muted small tips" },
      h("li", null, "Copy-protected (DRM) books from Kindle, Apple Books and most stores can't be opened. DRM-free EPUBs and PDFs work."),
      h("li", null, "Only vegan recipes belong in Zaijabolical: anything with meat, dairy, eggs or honey is flagged and left unticked."),
      h("li", null, "Big books take a minute or two to read.")),
    h("label", { class: "btn primary", style: { marginTop: "14px" } }, svg("book"), "Choose EPUB or PDF", input));
  const scrim = h("div", { class: "scrim center", onclick: e => { if (e.target === scrim && !busy) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Import a cookbook" },
      h("div", { class: "drawer-head" }, h("h2", null, "Import a cookbook"), h("button", { class: "icon-btn", "aria-label": "Close", onclick: () => { if (!busy) close(); } }, svg("x"))),
      body));
  let busy = false;
  document.body.append(scrim);
  async function start(file) {
    busy = true;
    const bar = h("div", { class: "progress" }, h("i"));
    const msg = h("p", { class: "muted" }, "Opening the book…");
    body.replaceChildren(h("div", { class: "loading" }, h("h2", { style: { color: "var(--ink)" } }, file.name.replace(/\.(epub|pdf)$/i, "")), msg, bar));
    const progress = (text, frac) => { msg.textContent = text; bar.firstChild.style.width = Math.round((frac || 0) * 100) + "%"; };
    try {
      const book = await Z.cookbook.read(file, progress);
      progress("Finding recipes…", 1);
      await new Promise(r => setTimeout(r, 30));
      const found = Z.cookbook.findRecipes(book);
      busy = false; close();
      openImportReview(book, found);
    } catch (e) {
      busy = false;
      body.replaceChildren(h("div", { class: "banner" }, svg("alert"), h("div", null, e.message || String(e))),
        h("label", { class: "btn" }, "Choose another file", input));
    }
  }
}

function normName(s) { return tokens(s).join(" "); }

function openImportReview(book, found) {
  const st = {
    after: false, filter: "all", expanded: new Set(), thumbs: new Map(), aiLeft: [...found.aiWork], aiRunning: false, aiMsg: "",
    items: [],
  };
  const existing = new Set(S.data.recipes.map(r => normName(r.name)));
  const photos = Z.cookbook.assignPhotos(book, found.recipes);   // works out whether this book puts photos before or after recipes
  st.after = !!book.photosFirst;
  const addItems = (recipes, method) => {
    for (const r of recipes) {
      if (method) r.method = method;
      const draft = Z.cookbook.toDraftShape(r);
      const vegan = Z.cookbook.veganFlags([r.title, ...r.ingredients.map(i => i.text)]);
      const dup = existing.has(normName(draft.name)) || st.items.some(x => normName(x.draft.name) === normName(draft.name));
      const checks = [];
      if (!r.steps.length) checks.push("no method found");
      if (r.ingredients.length < 3) checks.push("only " + r.ingredients.length + " ingredients");
      if (draft.servings == null) checks.push("servings not stated");
      st.items.push({ r, draft, vegan, dup, checks, on: !vegan.length && !dup, photo: r.photo || null, title: draft.name });
    }
  };
  addItems(found.recipes);

  const close = () => { for (const u of st.thumbs.values()) if (u && u.startsWith("blob:")) URL.revokeObjectURL(u); scrim.remove(); };
  const list = h("div", { class: "imp-list" });
  const head = h("div", { class: "imp-head" });
  const importBtn = h("button", { class: "btn primary", onclick: () => runImport() });

  function thumb(src, cls) {
    const img = h("img", { alt: "", class: cls || null });
    if (!src) return h("div", { class: "imp-thumb placeholder" }, svg("plate"));
    const set = u => { if (u) img.src = u; };
    if (st.thumbs.has(src)) set(st.thumbs.get(src));
    else {
      st.thumbs.set(src, null);
      queueThumb(src).then(u => { st.thumbs.set(src, u); set(u); document.querySelectorAll(`img[data-src="${CSS.escape(src)}"]`).forEach(i => { i.src = u; }); });
    }
    img.dataset.src = src;
    return h("div", { class: "imp-thumb" }, img);
  }
  let chain = Promise.resolve();
  function queueThumb(src) {   // one at a time, so a PDF isn't asked to draw 50 pages at once
    const p = chain.then(async () => {
      try { const b = await book.photoBlob(src); return b ? URL.createObjectURL(b) : null; } catch { return null; }
    });
    chain = p.catch(() => null);
    return p;
  }

  function counts() {
    return {
      all: st.items.length, on: st.items.filter(x => x.on).length,
      look: st.items.filter(x => x.checks.length).length, vegan: st.items.filter(x => x.vegan.length).length, dup: st.items.filter(x => x.dup).length,
    };
  }
  function drawHead() {
    const c = counts();
    const seg = h("div", { class: "seg" });
    for (const [id, label, n] of [["all", "All", c.all], ["on", "Ticked", c.on], ["look", "Needs a look", c.look], ["vegan", "Not vegan?", c.vegan], ["dup", "Already added", c.dup]]) {
      if (id !== "all" && id !== "on" && !n) continue;
      seg.append(h("button", { class: st.filter === id ? "on" : "", onclick: () => { st.filter = id; draw(); } }, `${label} (${n})`));
    }
    const methods = st.items.reduce((m, x) => { m[x.r.method] = (m[x.r.method] || 0) + 1; return m; }, {});
    head.replaceChildren(
      h("div", { class: "banner scan-banner" }, svg("book"), h("div", { class: "small" },
        h("b", null, `${c.all} recipe${c.all === 1 ? "" : "s"} found in ${book.title}. `),
        [methods.tagged ? `${methods.tagged} from the book's recipe tags` : "", methods.structure ? `${methods.structure} from its layout` : "", methods.ai ? `${methods.ai} read by AI` : ""].filter(Boolean).join(", ") + ". ",
        c.vegan ? `${c.vegan} may not be vegan and ${c.vegan === 1 ? "is" : "are"} unticked. ` : "",
        c.dup ? `${c.dup} ${c.dup === 1 ? "is" : "are"} already in your cookbook. ` : "",
        "Untick anything you don't want, then import.")),
      st.aiLeft.length || st.aiRunning ? h("div", { class: "banner" }, svg("sparkle"), h("div", { class: "small", style: { flex: 1 } },
        st.aiRunning ? h("b", null, st.aiMsg || "Reading with AI…")
          : [h("b", null, `${st.aiLeft.length} more part${st.aiLeft.length === 1 ? "" : "s"} of the book may hold recipes the layout didn't show. `),
            "The AI on your site can read them (free allowance; about 25 parts per run).", st.aiMsg ? h("div", { class: "muted" }, st.aiMsg) : null]),
        st.aiRunning ? null : h("button", { class: "btn sm primary", onclick: runAi }, "Read with AI")) : null,
      h("div", { class: "row imp-tools" },
        h("button", { class: "btn sm", onclick: () => { visible().forEach(x => { x.on = true; }); draw(); } }, "Tick all shown"),
        h("button", { class: "btn sm", onclick: () => { visible().forEach(x => { x.on = false; }); draw(); } }, "Untick all shown"),
        seg,
        photos.length ? h("label", { class: "row small tight imp-after" }, "In this book, photos come",
          h("select", { class: "pill", onchange: e => {
            st.after = e.target.value === "first";
            Z.cookbook.assignPhotos(book, st.items.map(x => x.r), st.after);
            for (const x of st.items) x.photo = x.r.photo;
            draw();
          } }, h("option", { value: "first", selected: st.after }, "before their recipe"), h("option", { value: "last", selected: !st.after }, "after their recipe"))) : null,
        photos.length && Z.store.S.github ? h("button", { class: "btn sm", onclick: matchPhotosAi }, svg("sparkle"), "Match photos with AI") : null));
    importBtn.textContent = `Import ${c.on} recipe${c.on === 1 ? "" : "s"}`;
    importBtn.disabled = !c.on;
  }
  const visible = () => st.items.filter(x => st.filter === "all" || (st.filter === "on" && x.on) || (st.filter === "look" && x.checks.length)
    || (st.filter === "vegan" && x.vegan.length) || (st.filter === "dup" && x.dup));
  function row(x) {
    const open = st.expanded.has(x);
    const d = x.draft;
    const photoBtn = h("button", { class: "imp-photo", title: "Change photo", onclick: () => choosePhoto(x) }, thumb(x.photo));
    const el = h("div", { class: "imp-row" + (x.on ? " on" : "") },
      h("label", { class: "ck" }, h("input", { type: "checkbox", checked: x.on, "aria-label": "Import " + x.title, onchange: e => { x.on = e.target.checked; el.classList.toggle("on", x.on); drawHead(); } }),
        h("span", { class: "box" }, svg("check"))),
      photoBtn,
      h("div", { class: "imp-main" },
        h("input", { type: "text", class: "imp-title", value: x.title, "aria-label": "Recipe name", oninput: e => { x.title = e.target.value; } }),
        h("div", { class: "imp-meta muted small" },
          [x.r.chapter, d.servings ? `serves ${fmtAmount(d.servings)}` : null, `${d.ingredients.length} ingredients`, `${x.r.steps.length} steps`,
            (d.prep_min || d.cook_min) ? `${(d.prep_min || 0) + (d.cook_min || 0)} min` : null, d.category].filter(Boolean).join(" · "),
          h("span", { class: "tag imp-method " + x.r.method }, x.r.method === "tagged" ? "book tags" : x.r.method === "structure" ? "layout" : "AI")),
        x.draft.description && !open ? h("div", { class: "imp-desc muted small" }, x.draft.description) : null,
        h("div", { class: "row tight" },
          x.vegan.length ? h("span", { class: "conf bad" }, "Not vegan? " + x.vegan.join(", ")) : null,
          x.dup ? h("span", { class: "conf" }, "Already in your cookbook") : null,
          ...x.checks.map(c => h("span", { class: "conf" }, c))),
        open ? h("div", { class: "imp-preview small" },
          h("label", { class: "field" }, h("span", null, "Description"),
            h("textarea", { class: "short", rows: 3, value: d.description || "", placeholder: "The book's intro to this recipe", oninput: e => { d.description = e.target.value; } })),
          h("div", { class: "row tight", style: { margin: "6px 0" } },
            h("button", { class: "btn sm", title: "Swap the name and the description", onclick: () => {
              const t = x.title; x.title = (d.description || "").split("\n")[0].slice(0, 80) || t; d.description = t + (d.description ? "\n" + d.description.split("\n").slice(1).join("\n") : ""); draw();
            } }, "⇅ Swap name and description"),
            h("label", { class: "row tight small" }, "Servings", h("input", { type: "number", min: 0.5, step: 0.5, value: d.servings ?? "", style: { width: "70px" }, oninput: e => { d.servings = e.target.value === "" ? null : +e.target.value; } })),
            h("label", { class: "row tight small" }, "Category", h("select", { onchange: e => { d.category = e.target.value; } }, CATS.map(c => h("option", { selected: d.category === c }, c))))),
          h("b", null, "Ingredients"),
          h("ul", null, d.ingredients.map(i => h("li", null, i.text))),
          h("b", null, "Steps"),
          h("ol", null, d.steps.slice(0, 12).map(s => h("li", null, s)))) : null),
      h("button", { class: "icon-btn" + (open ? " flip" : ""), "aria-label": open ? "Hide details" : "Show details", onclick: () => { open ? st.expanded.delete(x) : st.expanded.add(x); draw(); } }, svg("chevron")));
    return el;
  }
  function draw() {
    drawHead();
    const v = visible();
    list.replaceChildren(...(v.length ? v.map(row) : [h("p", { class: "muted" }, "Nothing here.")]));
  }
  function choosePhoto(x) {
    // nearest photos first, then the rest of the book's photos
    const near = [...photos].sort((a, b) => Math.abs(a.i - x.r.firstIndex) - Math.abs(b.i - x.r.firstIndex)).map(p => p.src);
    const opts = [...new Set([x.photo, ...(x.r.photoCandidates || []), ...near].filter(Boolean))].slice(0, 80);
    const pick = src => { x.photo = src; m.remove(); draw(); };
    const m = h("div", { class: "scrim center", onclick: e => { if (e.target === m) m.remove(); } },
      h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Choose a photo" },
        h("div", { class: "drawer-head" }, h("h2", null, "Photo for " + x.title), h("button", { class: "icon-btn", "aria-label": "Close", onclick: () => m.remove() }, svg("x"))),
        h("div", { class: "drawer-body" }, h("div", { class: "imp-photos" },
          h("button", { class: "imp-photo-opt" + (!x.photo ? " on" : ""), onclick: () => pick(null) }, h("div", { class: "imp-thumb placeholder" }, svg("x")), h("span", null, "No photo")),
          ...opts.map(src => h("button", { class: "imp-photo-opt" + (x.photo === src ? " on" : ""), onclick: () => pick(src) }, thumb(src)))),
          opts.length ? null : h("p", { class: "muted" }, "No photos near this recipe in the book. You can add your own after importing."))));
    document.body.append(m);
  }

  async function runAi() {
    if (!Z.store.S.github) { toast("Reading with AI needs this device connected to GitHub (Settings → Sync).", true); return; }
    st.aiRunning = true; drawHead();
    const batch = st.aiLeft.splice(0, AI_CHUNKS_PER_RUN);
    let added = 0, failed = 0;
    for (let i = 0; i < batch.length; i++) {
      st.aiMsg = `Reading part ${i + 1} of ${batch.length} with AI… (${added} recipe${added === 1 ? "" : "s"} so far)`; drawHead();
      try {
        const res = await api("POST", "/api/scan", { kind: "text", text: batch[i].text.slice(0, 22000) });
        const recipes = (res.result.recipes || []).filter(r => r && r.name && (r.ingredients || []).length >= 2).map(r => ({
          title: r.name, chapter: (batch[i].blocks[0] || {}).chapter || "", method: "ai", yieldText: r.servings ? `Serves ${r.servings}` : "",
          description: r.description || "", notes: r.notes || "", steps: (r.steps || []).map(String),
          ingredients: (r.ingredients || []).map(g => ({ text: g.text || [g.amount, g.unit, g.name].filter(x => x != null && x !== "").join(" ") + (g.note ? ", " + g.note : "") })),
          blocks: batch[i].blocks, docs: [], pages: [...new Set(batch[i].blocks.map(b => b.page).filter(Boolean))],
          firstIndex: (batch[i].blocks[0] || {}).i || 0, lastIndex: (batch[i].blocks[batch[i].blocks.length - 1] || {}).i || 0, photoSrcs: [],
          _ai: r,
        }));
        for (const r of recipes) r.photoCandidates = [];
        addItems(recipes, "ai");
        for (const x of st.items.slice(-recipes.length)) {   // AI gave numbers directly; keep them
          const a = x.r._ai;
          if (a.servings) x.draft.servings = a.servings;
          if (a.prep_min != null) x.draft.prep_min = a.prep_min;
          if (a.cook_min != null) x.draft.cook_min = a.cook_min;
          if (CATS.includes(a.category)) x.draft.category = a.category;
          x.checks = x.checks.filter(c => !(c === "servings not stated" && x.draft.servings));
        }
        added += recipes.length;
      } catch (e) {
        failed++;
        st.aiLeft.unshift(batch[i]);
        if (/allowance|limit|neuron|quota|429|capacity/i.test(e.message)) { st.aiMsg = "The free AI allowance for today is used up. Try again tomorrow."; break; }
        st.aiMsg = e.message;
        if (failed >= 3) break;
      }
      draw();
    }
    st.aiRunning = false;
    if (!st.aiMsg || /^Reading part/.test(st.aiMsg)) st.aiMsg = `Found ${added} more recipe${added === 1 ? "" : "s"}.`;
    draw();
  }
  async function matchPhotosAi() {
    const between = photos.filter(p => !st.items.some(x => (x.r.photoSrcs || []).includes(p.src)));
    if (!between.length) { toast("Every photo is already inside its recipe."); return; }
    let done = 0;
    for (const p of between.slice(0, 60)) {
      const cands = st.items.filter(x => (x.r.photoCandidates || []).includes(p.src)).slice(0, 3);
      if (cands.length < 2) continue;
      toast(`Matching photos… ${++done}`);
      try {
        const blob = await book.photoBlob(p.src);
        const small = await Z.media.scanImage(new File([blob], "p.jpg", { type: blob.type || "image/jpeg" }));
        const res = await api("POST", "/api/scan", { kind: "photo", images: ["data:image/jpeg;base64," + await Z.media.blobToB64(small)], candidates: cands.map(x => x.title) });
        const k = res.result.index;
        for (const x of cands) if (x.photo === p.src) x.photo = null;
        if (k >= 0) cands[k].photo = p.src;
      } catch (e) { toast(e.message, true); break; }
    }
    draw();
    toast("Photos matched. Tap any photo to change it.");
  }

  async function runImport() {
    const chosen = st.items.filter(x => x.on);
    if (!chosen.length) return;
    const msg = h("p", { class: "muted" }), bar = h("div", { class: "progress" }, h("i"));
    const pane = h("div", { class: "scrim center" }, h("div", { class: "modal" }, h("div", { class: "drawer-body" },
      h("div", { class: "loading" }, h("h2", { style: { color: "var(--ink)" } }, "Importing…"), msg, bar))));
    document.body.append(pane);
    const shortTitle = book.title.split(/[:(]/)[0].trim().slice(0, 40);
    let n = 0, unlinked = 0;
    for (const x of chosen) {
      msg.textContent = `${x.title} (${n + 1} of ${chosen.length})`;
      bar.firstChild.style.width = Math.round(n / chosen.length * 100) + "%";
      try {
        const shape = { ...x.draft, name: x.title };
        const R = draftFromScan(shape);
        R.attachments = R.attachments || [];
        R.description = shape.description || ""; R.notes = shape.notes || "";
        if (shape.prep_min == null) R.prep_min = 15;
        if (shape.cook_min == null) R.cook_min = 30;
        R.tags = [shortTitle, x.r.chapter].filter(Boolean);
        R.source = { book: book.title, chapter: x.r.chapter || "", author: book.author || "" };
        R.created = new Date().toISOString();
        R.ingredients = R.ingredients.map(({ _flag, ...l }) => l);
        if (x.photo) {
          try { const b = await book.photoBlob(x.photo); if (b) R.photos.push(await Z.media.addPhoto(new File([b], "photo.jpg", { type: b.type || "image/jpeg" }))); } catch { /* photo is optional */ }
        }
        try {
          if (book.kind === "epub") {
            const html = Z.cookbook.recipePageHtml({ ...x.r, title: x.title }, book);
            R.attachments.push(await Z.media.addAttachment(new File([html], `${x.title} (book page).html`, { type: "text/html" })));
          } else for (const pg of (x.r.pages || []).slice(0, 3)) {
            const b = await book.pageImage(pg, 1.6);
            R.attachments.push(await Z.media.addAttachment(new File([b], `${x.title} (page ${pg}).jpg`, { type: "image/jpeg" })));
          }
        } catch { /* the page copy is optional */ }
        unlinked += R.ingredients.filter(l => !l.ingredient_id).length;
        await api("POST", "/api/recipes", R);
      } catch (e) { toast(`${x.title}: ${e.message}`, true); }
      n++;
      if (n % 10 === 0) await new Promise(r => setTimeout(r, 20));
    }
    await reload();
    pane.remove(); close();
    S.recipeFilter.q = ""; S.recipeFilter.cat = "All";
    if (location.hash !== "#recipes") location.hash = "#recipes"; else render();
    const note = h("div", { class: "banner scan-banner", id: "import-done" }, svg("check"), h("div", { style: { flex: 1 } },
      h("b", null, `${n} recipe${n === 1 ? "" : "s"} imported from ${book.title}.`),
      unlinked ? h("p", { class: "small", style: { margin: "4px 0 8px" } }, `${unlinked} ingredient lines aren't linked to your pantry yet, so their nutrition isn't counted. Linking them takes a few taps per ingredient, not per recipe.`) : null,
      unlinked ? h("a", { class: "btn sm primary", href: "#link" }, svg("chain"), "Link ingredients") : null));
    setTimeout(() => { const head = document.querySelector(".page-head"); if (head) head.after(note); }, 50);
  }

  const scrim = h("div", { class: "scrim" },
    h("div", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Choose recipes to import" },
      h("div", { class: "drawer-head" },
        h("button", { class: "btn ghost", onclick: () => { if (confirm("Stop importing? Nothing has been saved yet.")) close(); } }, "Cancel"),
        h("h2", null, "Import recipes"), importBtn),
      h("div", { class: "drawer-body" }, head, list)));
  document.body.append(scrim);
  draw();
  if (!st.items.length && !st.aiLeft.length) {
    list.replaceChildren(h("div", { class: "empty" }, h("h2", null, "No recipes found"),
      h("p", null, book.kind === "pdf" && book.scanned ? "This PDF is made of scanned page pictures without text. Use Scan a recipe on the pages you want instead."
        : "This book's layout didn't show any recipes. If it has some, use Scan a recipe on those pages instead.")));
  }
}

/* ================================================================
   LINK INGREDIENTS (bulk)
   ================================================================ */
function unlinkedGroups() {
  const groups = new Map();
  for (const r of S.data.recipes) for (const l of r.ingredients) {
    if (l.ingredient_id || l.ignore || !l.name) continue;
    const key = normName(l.name) || l.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { key, names: new Map(), recipes: new Set(), samples: new Set() });
    const g = groups.get(key);
    g.names.set(l.name, (g.names.get(l.name) || 0) + 1);
    g.recipes.add(r.id);
    const sample = [l.amount != null ? fmtAmount(l.amount) : "", l.unit || ""].join(" ").trim();
    if (sample) g.samples.add(sample);
  }
  return [...groups.values()].map(g => ({ ...g, name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.recipes.size - a.recipes.size || a.name.localeCompare(b.name));
}
function unlinkedCount() { return unlinkedGroups().length; }

async function applyLink(keys, ing) {
  const set = new Set(keys);
  let changed = 0;
  for (const r of S.data.recipes) {
    let touched = false;
    const lines = r.ingredients.map(l => {
      if (l.ingredient_id || l.ignore || !l.name || !set.has(normName(l.name) || l.name.toLowerCase())) return l;
      touched = true;
      if (!ing) return { ...l, ignore: true };
      const [amount, unit, ok] = mapUnit(l.amount, l.unit, ing);
      const was = !ok && (l.amount != null || l.unit) ? `recipe says: ${[l.amount != null ? fmtAmount(l.amount) : "", l.unit].filter(Boolean).join(" ")}` : "";
      return { ingredient_id: ing.id, amount, unit, note: [l.note, was].filter(Boolean).join("; ") };
    });
    if (touched) {
      const copy = JSON.parse(JSON.stringify(r)); delete copy.nutrition;
      copy.ingredients = lines;
      await api("PUT", `/api/recipes/${r.id}`, copy);
      changed++;
    }
  }
  await reload();
  return changed;
}

const AISLE_GUESS = [
  ["Produce", /\b(onions?|garlic|ginger|carrots?|celery|peppers?|tomato(es)?|potato(es)?|spinach|kale|lettuce|cabbage|broccoli|cauliflower|zucchini|squash|mushrooms?|lemons?|limes?|apples?|bananas?|berries|cilantro|parsley|basil|mint|scallions?|leeks?|cucumbers?|avocados?|corn|beets?|herbs?|chiles?|jalape|fruit|greens|sprouts|radish|eggplant|shallots?)\b/i],
  ["Tofu & Plant Protein", /\b(tofu|tempeh|seitan|tvp|textured|soy curls|vital wheat gluten)\b/i],
  ["Beans & Legumes", /\b(beans?|lentils?|chickpeas?|peas|edamame|split peas)\b/i],
  ["Grains & Pasta", /\b(rice|quinoa|oats?|pasta|noodles?|flour|bread|tortillas?|couscous|barley|farro|millet|polenta|cornmeal|panko|breadcrumbs)\b/i],
  ["Nuts & Seeds", /\b(almonds?|cashews?|walnuts?|pecans?|peanuts?|pistachios?|hazelnuts?|seeds?|tahini|nut butter|peanut butter)\b/i],
  ["Dairy-Free & Fridge", /\b(milk|yogh?urt|vegan butter|cream cheese|vegan cheese|kimchi|miso)\b/i],
  ["Frozen", /\bfrozen\b/i],
  ["Pantry & Spices", /\b(salt|pepper|cumin|paprika|turmeric|cinnamon|spice|powder|oil|vinegar|sauce|syrup|sugar|stock|broth|extract|yeast|baking|cocoa|chocolate|mustard|ketchup|paste|tamari|gochujang|gochugaru|sesame|coconut|cornstarch|agar|nutritional yeast)\b/i],
];
const guessAisle = name => (AISLE_GUESS.find(([, re]) => re.test(name)) || ["Other"])[0];
const titleCase = s => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());

function viewLink() {
  if (!S.link) S.link = { usda: {}, busy: false, msg: "" };
  const L = S.link;
  const root = h("div");
  const groups = unlinkedGroups();
  root.append(pageHead("Link ingredients", "Connect ingredients from imported and scanned recipes to your pantry, so their nutrition counts. Each one is linked once for every recipe that uses it.",
    h("a", { class: "btn", href: "#pantry" }, svg("back"), "Pantry")));
  if (!groups.length) {
    root.append(h("div", { class: "empty" }, h("h2", null, "Everything is linked"), h("p", null, "Every ingredient in every recipe is connected to the pantry (or marked as having no nutrition, like water).")));
    return root;
  }
  const withSuggestion = groups.map(g => { const m = matchIngredientScored(g.name); return { g, s: m && m.score >= 0.6 ? m.ing : null, maybe: m && m.score >= 0.34 && m.score < 0.6 && !/\b(and|or)\b|&/.test(g.name) ? m.ing : null }; });
  const sugg = withSuggestion.filter(x => x.s);
  const usdaReady = groups.filter(g => L.usda[g.key] && L.usda[g.key].pick);
  const noKey = !S.data.settings.usda_api_key;
  root.append(h("div", { class: "panel link-tools" },
    h("div", null, h("b", null, `${groups.length} ingredient${groups.length === 1 ? "" : "s"} to link`),
      h("span", { class: "muted small" }, ` · used ${groups.reduce((a, g) => a + g.recipes.size, 0)} times across your recipes`)),
    h("div", { class: "row" },
      sugg.length ? h("button", { class: "btn primary", disabled: L.busy, onclick: async () => {
        L.busy = true; render();
        let n = 0;
        for (const { g, s } of sugg) { await applyLink([g.key], s); n++; }
        L.busy = false; toast(`Linked ${n} ingredient${n === 1 ? "" : "s"} to your pantry`); render();
      } }, svg("chain"), `Link ${sugg.length} pantry match${sugg.length === 1 ? "" : "es"}`) : null,
      h("button", { class: "btn", disabled: L.busy || noKey, title: noKey ? "Add your USDA key in Settings first" : null, onclick: lookupAll }, svg("search"), "Look up the rest in USDA"),
      usdaReady.length ? h("button", { class: "btn primary", disabled: L.busy, onclick: () => addUsdaAll(usdaReady) }, svg("plus"), `Add & link ${usdaReady.length} USDA match${usdaReady.length === 1 ? "" : "es"}`) : null),
    L.msg ? h("p", { class: "muted small", style: { margin: "8px 0 0" } }, L.msg) : null));
  const list = h("div", { class: "link-list" });
  for (const { g, s, maybe } of withSuggestion) list.append(linkRow(g, s, maybe));
  root.append(h("div", { class: "panel" }, list));
  return root;

  async function lookupAll() {
    L.busy = true;
    const todo = groups.filter(g => !matchIngredient(g.name) && !L.usda[g.key]);
    let n = 0;
    for (const g of todo) {
      L.msg = `Looking up ${g.name} in USDA… (${++n} of ${todo.length})`; render();
      try {
        const res = await api("GET", `/api/usda/search?q=${encodeURIComponent(g.name)}&types=${encodeURIComponent("Foundation,SR Legacy")}`);
        const want = tokens(g.name);
        const scored = res.slice(0, 8).map(f => {
          const t = tokens(f.description);
          const hit = want.filter(w => t.some(x => x.startsWith(w) || w.startsWith(x))).length;
          return { f, score: hit / Math.max(1, want.length) - 0.03 * t.length + (/\braw\b/i.test(f.description) ? 0.05 : 0) + (f.data_type === "Foundation" ? 0.04 : 0) };
        }).sort((a, b) => b.score - a.score);
        L.usda[g.key] = { results: res.slice(0, 5), pick: scored[0] && scored[0].score > 0.3 ? scored[0].f : null };
      } catch (e) { L.msg = e.message; if (/rate limit|key/i.test(e.message)) break; }
      await new Promise(r => setTimeout(r, 250));
    }
    L.busy = false; if (/^Looking up/.test(L.msg)) L.msg = "Check the USDA matches below, then add them."; render();
  }
  async function addUsdaAll(list) {
    L.busy = true;
    let n = 0;
    for (const g of list) { L.msg = `Adding ${g.name}… (${++n} of ${list.length})`; render(); await addFromUsda(g, L.usda[g.key].pick, true); }
    L.busy = false; L.msg = `Added and linked ${n} ingredient${n === 1 ? "" : "s"}. Brand-name and fortified items are worth checking against a package label.`; render();
  }
}
async function addFromUsda(g, f, quiet) {
  let detail = f;
  try { detail = await api("GET", `/api/usda/food/${f.fdc_id}`); } catch { /* search data is enough */ }
  const ing = await api("POST", "/api/ingredients", {
    name: titleCase(g.name), source: "usda", fdc_id: f.fdc_id, usda_description: f.description, data_type: f.data_type,
    nutrients: { ...f.nutrients, ...(detail.nutrients || {}) }, portions: detail.portions || [], aisle: guessAisle(g.name), verify: f.data_type === "Branded",
  });
  await reload();
  await applyLink([g.key], S.data.ingredients.find(i => i.id === ing.id) || ing);
  delete S.link.usda[g.key];
  if (!quiet) { toast(`${ing.name} added to the pantry and linked`); render(); }
}
function linkRow(g, suggestion, maybe) {
  const L = S.link;
  const u = L.usda[g.key];
  const recipes = [...g.recipes].map(id => (recipeById(id) || {}).name).filter(Boolean);
  const row = h("div", { class: "link-row" },
    h("div", { class: "link-name" }, h("b", null, g.name),
      h("div", { class: "muted small" }, `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`, g.samples.size ? ` · ${[...g.samples].slice(0, 3).join(", ")}` : "",
        h("span", { class: "link-recipes", title: recipes.join("\n") }, recipes.length ? ` · ${recipes.slice(0, 2).join(", ")}${recipes.length > 2 ? "…" : ""}` : ""))),
    h("div", { class: "link-actions" },
      suggestion ? h("button", { class: "btn sm primary", disabled: L.busy, onclick: async () => { await applyLink([g.key], suggestion); toast(`Linked to ${suggestion.name}`); render(); } },
        svg("chain"), suggestion.name) : null,
      !suggestion && maybe ? h("button", { class: "btn sm", disabled: L.busy, title: "A possible match in your pantry", onclick: async () => { await applyLink([g.key], maybe); toast(`Linked to ${maybe.name}`); render(); } },
        svg("chain"), "Maybe: " + maybe.name) : null,
      !suggestion && u && u.pick ? h("button", { class: "btn sm primary", disabled: L.busy, title: u.pick.description, onclick: () => addFromUsda(g, u.pick) },
        svg("plus"), "USDA: " + u.pick.description.split(",").slice(0, 2).join(",")) : null,
      !suggestion && u && !u.pick ? h("span", { class: "muted small" }, "No close USDA match") : null,
      h("button", { class: "btn sm", disabled: L.busy, onclick: () => choosePantry(g) }, "Choose…"),
      h("button", { class: "btn sm ghost", disabled: L.busy, title: "For water, ice and the like: nothing to count", onclick: async () => { await applyLink([g.key], null); toast(`${g.name}: marked as no nutrition`); render(); } }, "No nutrition")));
  return row;
}
function choosePantry(g) {
  const q0 = g.name;
  const close = () => m.remove();
  const results = h("div", { class: "pick-list" });
  const input = h("input", { type: "search", value: q0, placeholder: "Search pantry", oninput: () => draw() });
  const draw = () => {
    const q = input.value.toLowerCase().trim(), want = tokens(q);
    const scored = S.data.ingredients.map(i => {
      const t = tokens(i.name);
      const hit = want.filter(w => t.some(x => x.startsWith(w) || w.startsWith(x))).length;
      return { i, s: (i.name.toLowerCase().includes(q) ? 2 : 0) + hit / Math.max(1, want.length) };
    }).filter(x => x.s > 0 || !q).sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name)).slice(0, 40);
    results.replaceChildren(...scored.map(({ i }) => h("button", { class: "pick-item", onclick: async () => { close(); await applyLink([g.key], i); toast(`Linked to ${i.name}`); render(); } },
      h("b", null, i.name), h("span", { class: "muted small" }, i.aisle))),
      h("button", { class: "pick-item new", onclick: () => { close(); openAddIngredient(input.value.trim(), async ing => { if (ing) { await applyLink([g.key], ing); toast(`Linked to ${ing.name}`); render(); } }); } },
        svg("plus"), `Add “${input.value.trim() || g.name}” to the pantry (USDA or label)`));
  };
  const m = h("div", { class: "scrim center", onclick: e => { if (e.target === m) close(); } },
    h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Link " + g.name },
      h("div", { class: "drawer-head" }, h("h2", null, `Link “${g.name}”`), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
      h("div", { class: "picker-tools" }, input),
      h("div", { class: "drawer-body" }, results)));
  document.body.append(m);
  draw();
  input.focus();
}

/* the book page saved with an imported recipe: shown in a sandbox where scripts can't run */
function openHtmlAttachment(a) {
  Z.media.blob(a.path, "text/html").then(async b => {
    if (!b) { toast("Couldn't load that page. Check your connection.", true); return; }
    const html = await b.text();
    const close = () => m.remove();
    const frame = h("iframe", { sandbox: "", title: a.name, class: "page-frame" });
    frame.srcdoc = html;
    const m = h("div", { class: "scrim center", onclick: e => { if (e.target === m) close(); } },
      h("div", { class: "modal wide", role: "dialog", "aria-modal": "true", "aria-label": a.name },
        h("div", { class: "drawer-head" }, h("h2", null, a.name.replace(/\.html$/, "")), h("button", { class: "icon-btn", "aria-label": "Close", onclick: close }, svg("x"))),
        frame));
    document.body.append(m);
  });
}
