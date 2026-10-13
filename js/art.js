/* Zaijabolical illustrations: the Tracker squirrel (cheeks fill as weeks go well) and the nav icon.
   Original drawings, built as SVG strings. The monthly acorn stickers are images in assets/stickers/. */
(function (Z) {
  "use strict";
  const BROWN = "#c47a45", DARK = "#a9622f", CREAM = "#fde6c8", INK = "#2a2a24";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /** squirrel head; c = cheek fullness 0..1 */
  function squirrel(c, size, opts) {
    c = Math.max(0, Math.min(1, c || 0));
    const o = opts || {};
    const cr = 9 + 11 * c, off = 15 + 5 * c;
    const g = [];
    for (const [x, rot] of [[31, -18], [69, 18]]) {
      g.push(`<g transform="rotate(${rot} ${x} 24)"><path d="M${x - 3} 11 q-1 -9 2 -13 q3 7 3 13 z" fill="${DARK}"/>` +
        `<ellipse cx="${x}" cy="22" rx="9" ry="14" fill="${BROWN}"/><ellipse cx="${x}" cy="24" rx="4.5" ry="8" fill="${CREAM}"/></g>`);
    }
    g.push(`<ellipse cx="50" cy="50" rx="30" ry="27" fill="${BROWN}"/>`);
    for (const s of [-1, 1]) {
      g.push(`<circle cx="${50 + s * off}" cy="${62 + 2 * c}" r="${cr}" fill="${BROWN}"/>`);
      g.push(`<circle cx="${50 + s * off}" cy="${63 + 2 * c}" r="${cr - 3}" fill="${CREAM}"/>`);
    }
    g.push(`<ellipse cx="50" cy="63" rx="11" ry="8" fill="${CREAM}"/>`);
    for (const x of [39, 61]) g.push(`<path d="M${x - 5} 48 Q${x} 42 ${x + 5} 48" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
    g.push(`<ellipse cx="50" cy="58" rx="3.6" ry="2.6" fill="${INK}"/>`);
    g.push(`<path d="M45 64 Q47.5 67 50 64 Q52.5 67 55 64" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`);
    if (c > 0.6) g.push(`<ellipse cx="50" cy="69" rx="3" ry="2" fill="#e9d5a8"/>`);
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.label || "Squirrel")}">${g.join("")}</svg>`;
  }

  /** tiny line squirrel for the nav (24 × 24, drawn with the current text colour) */
  const NAV_SQUIRREL = '<path d="M13 21c4.8 0 8-3.2 8-7.6 0-3.4-2.2-5.6-4.6-5.6-2.1 0-3.3 1.6-3.1 3.3.2 1.4 1.4 2.3 2.7 2"/>' +
    '<path d="M13 21H8.2C6.5 21 5.6 19 6.8 17.7c.8-.9 1.2-2 1.1-3.2"/><path d="M13 21c1.1-2.5.9-5-1-6.8"/>' +
    '<path d="M12 14.2c.4-2.6-.6-5-2.8-5.8l.3-2.8-2.2 2.4C5 8.1 3.4 9.7 3.6 11.8c.2 1.7 1.8 2.8 4.3 2.7"/>' +
    '<circle cx="6.6" cy="10.8" r=".5" fill="currentColor"/>';

  Z.art = { squirrel, NAV_SQUIRREL };
})(globalThis.Z = globalThis.Z || {});
