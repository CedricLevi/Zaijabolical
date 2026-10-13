/* Minimal ZIP reader for EPUB files (an EPUB is a ZIP of web pages and images).
   Reads the file's table of contents, then unpacks single entries on demand, so even a 100 MB
   cookbook never has to sit in memory all at once. Uses the browser's built-in DecompressionStream. */
(function (Z) {
  "use strict";
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const bytes = async (blob, start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer());

  async function open(blob) {
    // the "end of central directory" record sits in the last 64 KB
    const tailLen = Math.min(blob.size, 65557);
    const tail = await bytes(blob, blob.size - tailLen, blob.size);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This file isn't a valid EPUB (it isn't a ZIP archive).");
    let count = u16(tail, eocd + 10), cdSize = u32(tail, eocd + 12), cdOff = u32(tail, eocd + 16);
    if (cdOff === 0xffffffff || count === 0xffff) {   // ZIP64
      const loc = eocd - 20;
      if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
        const z64 = Number(u32(tail, loc + 8)) + Number(u32(tail, loc + 12)) * 2 ** 32;
        const rec = await bytes(blob, z64, z64 + 56);
        count = Number(u32(rec, 32)); cdSize = Number(u32(rec, 40)); cdOff = Number(u32(rec, 48)) + Number(u32(rec, 52)) * 2 ** 32;
      }
    }
    const cd = await bytes(blob, cdOff, cdOff + cdSize);
    const entries = new Map();
    const dec = new TextDecoder();
    for (let p = 0, n = 0; n < count && p + 46 <= cd.length; n++) {
      if (u32(cd, p) !== 0x02014b50) break;
      const flags = u16(cd, p + 8), method = u16(cd, p + 10);
      let csize = u32(cd, p + 20), usize = u32(cd, p + 24), local = u32(cd, p + 42);
      const nl = u16(cd, p + 28), el = u16(cd, p + 30), cl = u16(cd, p + 32);
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nl));
      if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) {   // ZIP64 extra field
        let q = p + 46 + nl;
        const end = q + el;
        while (q + 4 <= end) {
          const id = u16(cd, q), sz = u16(cd, q + 2);
          if (id === 1) {
            let r = q + 4;
            const big = () => { const v = u32(cd, r) + u32(cd, r + 4) * 2 ** 32; r += 8; return v; };
            if (usize === 0xffffffff) usize = big();
            if (csize === 0xffffffff) csize = big();
            if (local === 0xffffffff) local = big();
          }
          q += 4 + sz;
        }
      }
      entries.set(name, { name, method, csize, usize, local, encrypted: !!(flags & 1) });
      p += 46 + nl + el + cl;
    }
    async function read(name) {
      const e = entries.get(name);
      if (!e) return null;
      if (e.encrypted) throw new Error("This book is copy-protected (DRM), so it can't be opened.");
      const head = await bytes(blob, e.local, e.local + 30);
      const start = e.local + 30 + u16(head, 26) + u16(head, 28);
      const raw = blob.slice(start, start + e.csize);
      if (e.method === 0) return raw;
      if (e.method !== 8) throw new Error("This book uses a compression method the app can't read.");
      if (typeof DecompressionStream === "undefined") throw new Error("This browser is too old to open EPUB files. Try an up-to-date Chrome, Safari or Firefox.");
      return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    }
    return {
      names: () => [...entries.keys()],
      has: n => entries.has(n),
      size: n => (entries.get(n) || {}).usize || 0,
      blob: read,
      text: async n => { const b = await read(n); return b ? b.text() : null; },
    };
  }
  Z.zip = { open };
})(globalThis.Z = globalThis.Z || {});
