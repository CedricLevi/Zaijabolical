/* Zaijabolical interface: the Tracker (what she ate, daily scores, squirrel cheeks, acorn stickers).
   Loaded after ui.js and uses its helpers. */
"use strict";

const T_ = () => Z.tracker;
function trackerOpts() {
  const t = S.data.settings.tracker || {};
  return { startDay: S.data.settings.week.start_day || "Monday", today: T_().dayKey(new Date()),
    good_day: t.good_day ?? 85, good_days_per_week: t.good_days_per_week ?? 5, weeks_per_sticker: t.weeks_per_sticker ?? 4 };
}
function trk() {
  if (!S.trk) S.trk = { date: T_().dayKey(new Date()), day: null, logs: null, adding: null };
  return S.trk;
}
async function loadTrackerDay(date) {
  const st = trk();
  st.date = date;
  try {
    const [day, logs] = await Promise.all([api("GET", `/api/logs/${date}`), api("GET", "/api/logs")]);
    if (st.date !== date) return;
    st.day = day; st.logs = logs;
  } catch (e) { toast(e.message, true); }
  if (S.view === "tracker") render();
}
async function saveTrackerDay() {
  const st = trk();
  const date = st.date;
  try {
    const res = await api("PUT", `/api/logs/${date}`, { items: st.day.items });
    if (st.date !== date) return;
    st.day = res;
    st.logs = await api("GET", "/api/logs");
  } catch (e) { toast(e.message, true); }
  if (S.view === "tracker") render();
}
function niceDate(k, today) {
  if (k === today) return "Today";
  if (k === T_().addDays(today, -1)) return "Yesterday";
  return T_().parseDay(k).toLocaleDateString(undefined, { weekday: "long" });
}
function ring(score, good) {
  const c = 2 * Math.PI * 12, p = Math.max(0, Math.min(100, score || 0));
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 30 30"); s.setAttribute("class", "ring"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = `<circle cx="15" cy="15" r="12" fill="none" stroke="var(--empty)" stroke-width="4"/>` +
    (score != null ? `<circle cx="15" cy="15" r="12" fill="none" stroke="${score >= good ? "var(--leaf)" : "var(--squash)"}" stroke-width="4" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 15 15)" stroke-linecap="round"/>` : "");
  return s;
}
const artEl = (html, cls) => h("span", { class: cls || "art", html });

function viewTracker() {
  const st = trk();
  const o = trackerOpts();
  const root = h("div");
  const usable = S.data.recipes.some(r => r.ingredients.length);
  root.append(pageHead("Tracker", "Check off what she ate. Every good week puffs up the squirrel's cheeks."));
  if (!usable) {
    root.append(h("div", { class: "empty" }, h("h2", null, "Add some recipes first"),
      h("p", null, "The tracker logs servings of your recipes (and pantry items), then scores each day against her targets."),
      h("a", { class: "btn primary", href: "#recipes" }, "Go to recipes")));
    return root;
  }
  if (!st.day || st.day.date !== st.date || !st.logs) {
    root.append(loading("Opening the log…"));
    loadTrackerDay(st.date);
    return root;
  }
  const sum = Z.tracker.summarize(st.logs, o);
  root.append(h("div", { class: "trk" },
    h("div", { class: "trk-main" }, dayPanel(st, o), weekPanel(st, sum, o), dayNutrients(st)),
    h("div", { class: "trk-side" }, cheeksPanel(sum, o), shelfPanel(sum, o), trendPanel(sum, o))));
  return root;
}

/* ---------------- the day's log ---------------- */
function dayPanel(st, o) {
  const d = st.day, today = o.today;
  const isFuture = st.date > today;
  const go = n => { st.day = null; st.adding = null; loadTrackerDay(Z.tracker.addDays(st.date, n)); };
  const head = h("div", { class: "panel-head day-nav" },
    h("div", { class: "row nowrap" },
      h("button", { class: "icon-btn", "aria-label": "Previous day", onclick: () => go(-1) }, svg("back")),
      h("div", null, h("h2", null, niceDate(st.date, today)),
        h("div", { class: "muted small" }, Z.tracker.parseDay(st.date).toLocaleDateString(undefined, { weekday: niceDate(st.date, today) === "Today" || niceDate(st.date, today) === "Yesterday" ? "long" : undefined, month: "long", day: "numeric" }))),
      h("button", { class: "icon-btn", "aria-label": "Next day", disabled: st.date >= today, onclick: () => go(1) }, svg("next")),
      st.date !== today ? h("button", { class: "btn sm ghost", onclick: () => { st.day = null; loadTrackerDay(today); } }, "Today") : null),
    h("span", { class: "score", title: "Coverage of her targets from what was eaten (supplements included)" },
      d.score != null ? Math.round(d.score) : "–", h("small", null, st.date === today ? "/100 so far" : "/100")));
  const list = h("div", { class: "meals" });
  const recipeName = id => (recipeById(id) || {}).name || "Deleted recipe";
  d.items.forEach((it, i) => {
    const name = it.recipe_id ? recipeName(it.recipe_id) : ((ingById(it.ingredient_id) || {}).name || "Deleted ingredient");
    const qty = it.recipe_id
      ? h("span", { class: "mini-step" },
        h("button", { "aria-label": "Less " + name, onclick: () => { it.servings = Math.max(0.5, it.servings - 0.5); saveTrackerDay(); } }, "−"),
        h("span", { title: "Servings" }, fmtServ(it.servings) + "×"),
        h("button", { "aria-label": "More " + name, onclick: () => { it.servings += 0.5; saveTrackerDay(); } }, "+"))
      : h("span", { class: "muted small" }, `${fmtAmount(it.amount)} ${it.unit}`);
    list.append(h("div", { class: "meal" + (it.eaten ? " on" : "") },
      h("label", { class: "ck" }, h("input", { type: "checkbox", checked: !!it.eaten, disabled: isFuture, "aria-label": "Ate " + name,
        onchange: e => { it.eaten = e.target.checked; saveTrackerDay(); } }), h("span", { class: "box" }, svg("check"))),
      h("span", { class: "nm" }, name, it.planned ? h("span", { class: "muted small" }, " · planned") : null),
      qty,
      h("button", { class: "icon-btn", "aria-label": "Remove " + name, onclick: () => { d.items.splice(i, 1); saveTrackerDay(); } }, svg("x"))));
  });
  if (!d.items.length) list.append(h("p", { class: "muted", style: { margin: "6px 0" } },
    S.week ? "Nothing planned for this day. Add what she ate below." : "No week plan yet, so nothing is pre-filled. Add what she ate below."));
  const anyPlannedOpen = d.items.some(i => !i.eaten);
  const actions = h("div", { class: "row trk-add" },
    h("select", { class: "pill", "aria-label": "Add a dish", disabled: isFuture, onchange: e => {
      const id = e.target.value; if (!id) return;
      const ex = d.items.find(x => x.recipe_id === id);
      if (ex) { ex.servings += ex.eaten ? 1 : 0; ex.eaten = true; } else d.items.push({ recipe_id: id, servings: 1, eaten: true });
      saveTrackerDay();
    } }, h("option", { value: "" }, "+ Add a dish"),
      CATS.map(c => h("optgroup", { label: c }, S.data.recipes.filter(r => r.category === c && r.ingredients.length).map(r => h("option", { value: r.id }, r.name))))),
    h("button", { class: "btn sm", disabled: isFuture, onclick: () => { st.adding = st.adding ? null : { ingredient_id: "", amount: 1, unit: "" }; render(); } }, svg("plus"), "Pantry item"),
    anyPlannedOpen && !isFuture ? h("button", { class: "btn sm", onclick: () => { d.items.forEach(i => { i.eaten = true; }); saveTrackerDay(); } }, svg("check"), "Ate everything") : null);
  return h("div", { class: "panel p-day" }, head, list, st.adding ? addIngredientRow(st) : null, actions,
    isFuture ? h("p", { class: "muted small" }, "This day hasn't happened yet.") : null);
}
function addIngredientRow(st) {
  const a = st.adding;
  const ing = ingById(a.ingredient_id);
  const units = ing ? [...ing.portions.map(p => p.label), "g", "oz"] : ["g"];
  if (!units.includes(a.unit)) a.unit = units[0];
  return h("div", { class: "add-ing" },
    h("select", { "aria-label": "Pantry item", onchange: e => { a.ingredient_id = e.target.value; a.unit = ""; render(); } },
      h("option", { value: "" }, "Choose a pantry item…"),
      [...S.data.ingredients].sort((x, y) => x.name.localeCompare(y.name)).map(i => h("option", { value: i.id, selected: i.id === a.ingredient_id }, i.name))),
    h("input", { type: "number", min: 0, step: "any", value: a.amount, "aria-label": "Amount", oninput: e => { a.amount = +e.target.value; } }),
    h("select", { "aria-label": "Unit", onchange: e => { a.unit = e.target.value; } }, units.map(u => h("option", { selected: u === a.unit }, u))),
    h("button", { class: "btn sm primary", disabled: !ing, onclick: () => {
      st.day.items.push({ ingredient_id: a.ingredient_id, amount: a.amount || 1, unit: a.unit, eaten: true });
      st.adding = null; saveTrackerDay();
    } }, "Add"));
}

/* ---------------- this week ---------------- */
function weekPanel(st, sum, o) {
  const start = Z.tracker.weekStart(st.date, o.startDay);
  const w = sum.weeks.find(x => x.start === start) || { days: {}, goodDays: 0 };
  const strip = h("div", { class: "weekstrip" });
  for (let i = 0; i < 7; i++) {
    const k = Z.tracker.addDays(start, i);
    const sc = w.days[k];
    strip.append(h("button", { class: "dayc" + (k === st.date ? " sel" : "") + (k === o.today ? " today" : "") + (k > o.today ? " future" : ""),
      disabled: k > o.today, "aria-label": `${Z.tracker.weekdayName(k)}${sc != null ? `, score ${Math.round(sc)}` : ", nothing logged"}`,
      onclick: () => { st.day = null; st.adding = null; loadTrackerDay(k); } },
      h("span", null, Z.tracker.weekdayName(k).slice(0, 3)), ring(sc, o.good_day), h("b", null, sc != null ? Math.round(sc) : "–")));
  }
  return h("div", { class: "panel p-week" },
    h("div", { class: "panel-head" }, h("h2", null, start === Z.tracker.weekStart(o.today, o.startDay) ? "This week" : `Week of ${Z.tracker.parseDay(start).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`),
      h("span", { class: "muted small" }, `${w.goodDays} of ${o.good_days_per_week} good days`)),
    strip, h("p", { class: "muted small", style: { margin: "8px 0 0" } }, `Each day's score is its coverage of her targets from what was eaten. A good day is ${o.good_day}+.`));
}

/* ---------------- nutrients for the selected day ---------------- */
function dayNutrients(st) {
  const d = st.day;
  const panel = h("div", { class: "panel p-nut" }, h("div", { class: "panel-head" },
    h("h2", null, st.date === trackerOpts().today ? "Today so far" : "That day"), h("span", { class: "muted small" }, "eaten vs. her targets")));
  if (!d.eaten) { panel.append(h("p", { class: "muted" }, "Check off what she ate to see her numbers.")); return panel; }
  panel.append(macroLine(d.rows), h("div", { style: { margin: "10px 0 14px" } }, fingerprint(d.rows, true)), bars(d.rows));
  const am = d.amino;
  if (am && am.has_data) {
    const kg = (Number((S.data.settings.profile || {}).weight_lb) || 140) * 0.4536;
    const rows = h("div", { class: "mbars aa-day" });
    for (const a of am.acids) {
      const need = a.req * kg / 1000, pct = a.grams / need * 100;
      rows.append(h("div", { class: "mbar", title: `${a.name}: ${fmt(a.grams * 1000)} mg of about ${fmt(need * 1000)} mg a day for her weight` },
        h("span", { class: "n" }, a.name.replace(" + ", "+")), h("div", { class: "t" }, h("i", { class: pct >= 100 ? "good" : pct >= 70 ? "ok" : "low", style: { width: Math.min(100, pct) + "%" } })),
        h("span", { class: "v" }, `${fmt(a.grams)} g`, h("small", null, ` · ${Math.round(pct)}%`))));
    }
    panel.append(h("details", { class: "aa-details" }, h("summary", null, "Essential amino acids"),
      h("p", { class: "muted small" }, `Compared with the daily need for ${Math.round((S.data.settings.profile || {}).weight_lb || 140)} lb (WHO). ${am.coverage < 0.9 ? "Some foods have no amino acid data, so real totals are a bit higher." : ""}`),
      rows));
  }
  return panel;
}

/* ---------------- squirrel cheeks, stickers, trend ---------------- */
const CHEEKS = [0, 0.33, 0.66, 1];
function cheeksPanel(sum, o) {
  const cur = sum.current, n = Math.min(o.weeks_per_sticker, cur.goodWeeks);
  const thisGood = cur.week.good;
  const slots = h("div", { class: "cheeks" });
  for (let i = 0; i < 4; i++) {
    const done = i < n, now = i === n && !thisGood && n < 4;
    slots.append(h("div", { class: "w" + (done ? " done" : now ? " cur" : " dim") },
      artEl(Z.art.squirrel(CHEEKS[i], 64, { label: done ? `Good week ${i + 1}` : `Week ${i + 1}` })),
      h("div", null, done ? `Week ${i + 1} ✓` : now ? "This week" : `Week ${i + 1}`)));
  }
  const month = Z.tracker.monthLabel(cur.month, true).split(" ")[0];
  let msg;
  if (n >= o.weeks_per_sticker) msg = h("span", null, h("b", null, `${month}'s sticker is earned!`), " Every extra good week is a bonus.");
  else if (thisGood) msg = h("span", null, h("b", null, "This week's cheeks are full."), ` ${o.weeks_per_sticker - n} more good week${o.weeks_per_sticker - n === 1 ? "" : "s"} for ${month}'s sticker.`);
  else if (cur.stillPossible) msg = h("span", null, h("b", null, `${cur.needDays} more good day${cur.needDays === 1 ? "" : "s"}`), " fills this week's cheeks.");
  else msg = h("span", null, "Not enough days left to fill this week's cheeks. ", h("b", null, "A fresh week starts " + o.startDay + "."));
  return h("div", { class: "panel p-cheeks" },
    h("h2", null, "Squirrel cheeks"),
    h("p", { class: "muted small", style: { margin: "4px 0 12px" } }, `${o.good_days_per_week} good days make a good week. Fill all ${o.weeks_per_sticker} cheeks in ${month} to earn a sticker.`),
    slots,
    h("div", { class: "banner cheer" }, svg("star"), h("div", { class: "small" }, msg)));
}
function shelfPanel(sum, o) {
  const shelf = h("div", { class: "shelf" });
  const earned = [...sum.stickers].reverse();
  if (!sum.stickers.includes(sum.current.month)) {
    shelf.append(h("div", { class: "sticker empty" }, h("b", null, Z.tracker.monthLabel(sum.current.month).split(" ")[0]),
      h("span", null, `${Math.min(sum.current.goodWeeks, o.weeks_per_sticker)} of ${o.weeks_per_sticker} weeks`)));
  }
  for (const m of earned) shelf.append(h("div", { class: "sticker", title: `${Z.tracker.monthLabel(m, true)}: ${sum.months[m]} good weeks` },
    artEl(Z.art.acorn(Z.tracker.monthLabel(m), 104))));
  return h("div", { class: "panel p-shelf" }, h("h2", { style: { marginBottom: "10px" } }, "Sticker shelf"), shelf,
    earned.length ? null : h("p", { class: "muted small", style: { margin: "10px 0 0" } }, "Her first heart-eyed acorn shows up here."));
}
function trendPanel(sum, o) {
  const weeks = sum.weeks.filter(w => w.average != null).slice(-8);
  if (!weeks.length) return null;
  return h("div", { class: "panel p-trend" }, h("h2", { style: { marginBottom: "6px" } }, "Weekly average"),
    h("div", { class: "spark", role: "img", "aria-label": "Average day score per week: " + weeks.map(w => `${w.start} ${Math.round(w.average)}`).join(", ") },
      weeks.map(w => h("div", { title: `Week of ${w.start}: average ${Math.round(w.average)}, ${w.goodDays} good days` },
        h("small", null, Math.round(w.average)),
        h("i", { class: w.good ? "good" : w.average >= o.good_day ? "ok" : "low", style: { height: Math.max(6, w.average) + "%" } }),
        h("span", null, Z.tracker.parseDay(w.start).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }))))));
}
