/* Zaijabolical illustrations: the Tracker squirrel (cheeks fill as weeks go well) and the
   heart-eyed acorn month sticker. Original drawings, built as SVG strings. */
(function (Z) {
  "use strict";
  const BROWN = "#c47a45", DARK = "#a9622f", CREAM = "#fde6c8", INK = "#2a2a24", PINK = "#f07489", LEAF = "#4c8c3f";
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

  const heart = (x, y, s) => `<path transform="translate(${x - 7 * s},${y - 6 * s}) scale(${s})" d="M7 12 C-2 6 0 -1 4 0 C6 0.5 7 2 7 3 C7 2 8 0.5 10 0 C14 -1 16 6 7 12 Z" fill="${PINK}"/>`;

  /** the month sticker: a happy acorn with heart eyes */
  function acorn(label, size) {
    const W = 120, H = 150;
    const g = [];
    // stem + little leaf
    g.push(`<path d="M60 30 C59 22 61 15 67 10" fill="none" stroke="#6b4426" stroke-width="5" stroke-linecap="round"/>`);
    g.push(`<path d="M67 12 C74 2 88 3 92 8 C86 16 74 18 67 12 Z" fill="${LEAF}"/><path d="M69 12 C76 9 83 8 89 8" fill="none" stroke="#3a6e30" stroke-width="1.4" stroke-linecap="round"/>`);
    // nut
    g.push(`<path d="M27 64 C25 99 43 121 60 130 C77 121 95 99 93 64 Z" fill="#d89452"/>`);
    g.push(`<path d="M36 70 C35 96 46 114 57 122" fill="none" stroke="#f0b980" stroke-width="5" stroke-linecap="round" opacity=".7"/>`);
    // cap with a scale pattern
    g.push(`<path d="M19 64 C19 41 37 28 60 28 C83 28 101 41 101 64 C101 71 97 74 91 74 L29 74 C23 74 19 71 19 64 Z" fill="#8a5a32"/>`);
    const scales = [];
    for (let row = 0; row < 4; row++) {
      const y = 40 + row * 9, n = 5 + row, x0 = 60 - (n - 1) * 8.5;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 17 + (row % 2 ? 0 : 0);
        if (Math.hypot((x - 60) / 41, (y - 64) / 36) > 1.02) continue;
        scales.push(`<path d="M${x - 7} ${y} Q${x} ${y + 7} ${x + 7} ${y}" fill="none" stroke="#a8743f" stroke-width="2" stroke-linecap="round"/>`);
      }
    }
    g.push(scales.join(""));
    g.push(`<path d="M24 69 C40 76 80 76 96 69" fill="none" stroke="#6b4426" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`);
    // face
    g.push(heart(47, 92, 1.05), heart(73, 92, 1.05));
    g.push(`<ellipse cx="38" cy="104" rx="6" ry="3.6" fill="${PINK}" opacity=".45"/><ellipse cx="82" cy="104" rx="6" ry="3.6" fill="${PINK}" opacity=".45"/>`);
    g.push(`<path d="M50 104 Q60 115 70 104" fill="#7a2f2f" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`);
    g.push(`<path d="M55 108.5 Q60 111.5 65 108.5" fill="none" stroke="${PINK}" stroke-width="2.4" stroke-linecap="round"/>`);
    if (label) {
      const w = Math.max(64, 8 + String(label).length * 7.2);
      g.push(`<rect x="${W / 2 - w / 2}" y="${H - 24}" width="${w}" height="21" rx="10.5" fill="${LEAF}"/>`);
      g.push(`<text x="${W / 2}" y="${H - 9.5}" text-anchor="middle" font-family="Fredoka, ui-rounded, system-ui, sans-serif" font-size="12" font-weight="600" fill="#fff">${esc(label)}</text>`);
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="${size}" height="${Math.round(size * H / W)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label ? "Sticker for " + label : "Acorn sticker")}">${g.join("")}</svg>`;
  }

  /** tiny line squirrel for the nav (24 × 24, drawn with the current text colour) */
  const NAV_SQUIRREL = '<path d="M13 21c4.8 0 8-3.2 8-7.6 0-3.4-2.2-5.6-4.6-5.6-2.1 0-3.3 1.6-3.1 3.3.2 1.4 1.4 2.3 2.7 2"/>' +
    '<path d="M13 21H8.2C6.5 21 5.6 19 6.8 17.7c.8-.9 1.2-2 1.1-3.2"/><path d="M13 21c1.1-2.5.9-5-1-6.8"/>' +
    '<path d="M12 14.2c.4-2.6-.6-5-2.8-5.8l.3-2.8-2.2 2.4C5 8.1 3.4 9.7 3.6 11.8c.2 1.7 1.8 2.8 4.3 2.7"/>' +
    '<circle cx="6.6" cy="10.8" r=".5" fill="currentColor"/>';

  Z.art = { squirrel, acorn, NAV_SQUIRREL };
})(globalThis.Z = globalThis.Z || {});
