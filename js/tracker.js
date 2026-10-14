/* Zaijabolical tracker math: days, weeks, squirrel cheeks and month stickers.
   Plain browser script; also loads in Node for tests. */
(function (Z) {
  "use strict";
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const pad = n => String(n).padStart(2, "0");

  /** "YYYY-MM-DD" for a local date */
  function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseDay(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12); }
  function addDays(k, n) { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
  function weekdayName(k) { return DAY_NAMES[parseDay(k).getDay()]; }
  /** whole days from a to b (b - a) */
  function daysBetween(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 864e5); }

  /** First day of the week containing `k`, for weeks starting on `startDay` ("Monday"…) */
  function weekStart(k, startDay) {
    const s = Math.max(0, DAY_NAMES.indexOf(startDay || "Monday"));
    const back = (parseDay(k).getDay() - s + 7) % 7;
    return addDays(k, -back);
  }
  /** A week counts toward the month that holds most of it (the month of its 4th day). */
  function weekMonth(startKey) { return addDays(startKey, 3).slice(0, 7); }
  function monthLabel(ym, long) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 15).toLocaleDateString("en-US", long ? { month: "long", year: "numeric" } : { month: "short", year: "numeric" });
  }

  const DEFAULTS = { good_day: 85, good_days_per_week: 5, weeks_per_sticker: 4 };

  /** logs: [{date, score, eaten}] -> weeks, months and stickers */
  function summarize(logs, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const today = o.today || dayKey(new Date());
    const weeks = new Map();
    for (const l of logs || []) {
      if (!l || !l.date || l.score == null || !(l.eaten > 0)) continue;
      const ws = weekStart(l.date, o.startDay);
      if (!weeks.has(ws)) weeks.set(ws, { start: ws, month: weekMonth(ws), days: {}, goodDays: 0 });
      const w = weeks.get(ws);
      w.days[l.date] = l.score;
    }
    for (const w of weeks.values()) {
      w.goodDays = Object.values(w.days).filter(s => s >= o.good_day).length;
      w.good = w.goodDays >= o.good_days_per_week;
      const scores = Object.values(w.days);
      w.average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    }
    const months = {};
    for (const w of weeks.values()) if (w.good) months[w.month] = (months[w.month] || 0) + 1;
    const curStart = weekStart(today, o.startDay);
    const curMonth = weekMonth(curStart);
    const stickers = Object.keys(months).filter(m => months[m] >= o.weeks_per_sticker).sort();
    const thisWeek = weeks.get(curStart) || { start: curStart, month: curMonth, days: {}, goodDays: 0, good: false };
    const daysLeft = 7 - Math.round((parseDay(today) - parseDay(curStart)) / 864e5);   // including today
    const todayGood = (thisWeek.days[today] ?? -1) >= o.good_day;
    const need = Math.max(0, o.good_days_per_week - thisWeek.goodDays);
    return {
      weeks: [...weeks.values()].sort((a, b) => a.start.localeCompare(b.start)),
      months, stickers, today, current: {
        week: thisWeek, month: curMonth, goodWeeks: months[curMonth] || 0,
        needDays: need, stillPossible: need <= (todayGood ? daysLeft - 1 : daysLeft), daysLeft,
      },
      options: o,
    };
  }

  Z.tracker = { DAY_NAMES, dayKey, parseDay, addDays, daysBetween, weekdayName, weekStart, weekMonth, monthLabel, summarize, DEFAULTS };
})(globalThis.Z = globalThis.Z || {});
