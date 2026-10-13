/* Zaijabolical photos & attachments.
   - Files are kept in this browser (IndexedDB) and, when the device is connected, uploaded to the private
     data repo under media/, so the other phone can download them. They never go anywhere else.
   - Photos are shrunk before saving: a ~1600 px version for the recipe page and a ~640 px one for lists. */
(function (Z) {
  "use strict";
  const DB = "zaijabolical-media", STORE = "files";
  const MAX_ATTACHMENT = 10 * 1024 * 1024;
  const SAFE_OPEN = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"]);
  const RASTER = /^image\/(jpeg|png|webp|gif|heic|heif|avif|bmp)$/i;

  // ---------------- IndexedDB ----------------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode), st = t.objectStore(STORE);
      let out;
      const req = fn(st);
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const idbGet = path => tx("readonly", st => st.get(path)).catch(() => null);
  const idbPut = (path, rec) => tx("readwrite", st => st.put(rec, path)).catch(() => null);
  const idbDel = path => tx("readwrite", st => st.delete(path)).catch(() => null);
  const idbAll = () => tx("readonly", st => st.getAll()).catch(() => []);
  const idbKeys = () => tx("readonly", st => st.getAllKeys()).catch(() => []);

  // ---------------- encoding ----------------
  function blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function b64ToBlob(b64, type) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || "application/octet-stream" });
  }

  // ---------------- images ----------------
  async function decode(file) {
    if (typeof createImageBitmap === "function") {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall through */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  async function resize(src, maxSide, quality) {
    const w0 = src.width, h0 = src.height;
    const k = Math.min(1, maxSide / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    const blob = await new Promise(res => c.toBlob(res, "image/jpeg", quality));
    return { blob, w, h };
  }
  /** a photo for scanning: big enough to read small print, small enough to send quickly */
  async function scanImage(file) {
    const src = await decode(file);
    const { blob } = await resize(src, 2000, 0.85);
    return blob;
  }

  // ---------------- GitHub ----------------
  function cfg() { return Z.store && Z.store.S.github; }
  async function gh(method, path, body) {
    const c = cfg();
    if (!c) throw new Error("not connected");
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
  }
  const contentPath = p => "/contents/" + p.split("/").map(encodeURIComponent).join("/");

  async function uploadOne(path, rec) {
    const content = await blobToB64(rec.blob);
    const r = await gh("PUT", contentPath(path), { message: `Add ${path}`, content });
    if (r.status === 200 || r.status === 201 || r.status === 422) {   // 422: already there (uploaded by the other device)
      await idbPut(path, { ...rec, uploaded: true });
      return true;
    }
    return false;
  }
  let flushing = null, again = false, retryTimer = null;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /** upload anything saved on this device that isn't on GitHub yet (one at a time, gently, so a big cookbook
      import doesn't trip GitHub's limits; if it does, wait and carry on) */
  function flush() {
    if (!cfg()) return Promise.resolve(0);
    if (flushing) { again = true; return flushing; }
    flushing = (async () => {
      let n = 0;
      try {
        do {
          again = false;
          const keys = await idbKeys();
          for (const path of keys) {
            const rec = await idbGet(path);
            if (!rec || rec.uploaded) continue;
            let ok = false;
            try { ok = await uploadOne(path, rec); } catch { ok = false; }
            if (!ok) {   // offline or rate-limited: try again in a minute
              clearTimeout(retryTimer); retryTimer = setTimeout(flush, 60000);
              return n;
            }
            n++;
            await wait(700);
          }
        } while (again);
      } finally { flushing = null; }
      return n;
    })();
    return flushing;
  }
  async function download(path, type) {
    const r = await gh("GET", contentPath(path));
    if (r.status !== 200 || !r.data) return null;
    let b64 = r.data.content;
    if (!b64 && r.data.sha) {   // files over 1 MB come without inline content
      const blob = await gh("GET", `/git/blobs/${r.data.sha}`);
      b64 = blob.data && blob.data.content;
    }
    if (!b64) return null;
    return b64ToBlob(b64, type);
  }
  async function deleteRemote(path) {
    try {
      const r = await gh("GET", contentPath(path));
      if (r.status !== 200 || !r.data || !r.data.sha) return;
      await gh("DELETE", contentPath(path), { message: `Remove ${path}`, sha: r.data.sha });
    } catch { /* best effort: an orphaned file is harmless */ }
  }

  // ---------------- public ----------------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const urls = new Map();       // path -> object URL
  const loading = new Map();    // path -> promise
  let active = 0;
  const queue = [];
  function limited(fn) {
    return new Promise((resolve, reject) => {
      const run = () => { active++; fn().then(resolve, reject).finally(() => { active--; const n = queue.shift(); if (n) n(); }); };
      if (active < 4) run(); else queue.push(run);
    });
  }

  /** Save a photo. Returns the metadata to keep on the recipe. */
  async function addPhoto(file) {
    const src = await decode(file);
    const id = uid();
    const big = await resize(src, 1600, 0.82), small = await resize(src, 640, 0.78);
    const meta = { id, path: `media/${id}.jpg`, thumb: `media/${id}-t.jpg`, type: "image/jpeg", w: big.w, h: big.h, size: big.blob.size };
    await idbPut(meta.path, { blob: big.blob, type: "image/jpeg", uploaded: false });
    await idbPut(meta.thumb, { blob: small.blob, type: "image/jpeg", uploaded: false });
    flush();
    return meta;
  }
  /** Save any file as an attachment (photos are shrunk; other files kept as they are, up to 10 MB). */
  async function addAttachment(file, name) {
    const id = uid();
    let blob = file, type = file.type || "application/octet-stream";
    if (RASTER.test(type)) {
      try { blob = (await resize(await decode(file), 2000, 0.85)).blob; type = "image/jpeg"; } catch { /* keep original */ }
    }
    if (blob.size > MAX_ATTACHMENT) throw new Error("That file is over 10 MB. Try a smaller one.");
    const ext = (String(name || file.name || "").match(/\.([a-z0-9]{1,8})$/i) || [, type === "image/jpeg" ? "jpg" : "bin"])[1].toLowerCase();
    const meta = { id, path: `media/${id}.${type === "image/jpeg" ? "jpg" : ext}`, name: String(name || file.name || "file").slice(0, 120),
      type, size: blob.size };
    if (type === "image/jpeg" && !/\.jpe?g$/i.test(meta.name)) meta.name = meta.name.replace(/\.[^.]+$/, "") + ".jpg";
    await idbPut(meta.path, { blob, type, uploaded: false });
    flush();
    return meta;
  }
  async function getBlob(path, type) {
    const rec = await idbGet(path);
    if (rec && rec.blob) return rec.blob;
    if (!cfg()) return null;
    const blob = await limited(() => download(path, type));
    if (blob) await idbPut(path, { blob, type, uploaded: true });
    return blob;
  }
  /** object URL for a stored file (downloads it from GitHub the first time on this device) */
  function url(path, type) {
    if (!path) return Promise.resolve(null);
    if (urls.has(path)) return Promise.resolve(urls.get(path));
    if (!loading.has(path)) {
      loading.set(path, getBlob(path, type).then(b => {
        loading.delete(path);
        if (!b) return null;
        const u = URL.createObjectURL(b);
        urls.set(path, u);
        return u;
      }).catch(() => { loading.delete(path); return null; }));
    }
    return loading.get(path);
  }
  async function remove(meta) {
    for (const p of [meta && meta.path, meta && meta.thumb].filter(Boolean)) {
      if (urls.has(p)) { URL.revokeObjectURL(urls.get(p)); urls.delete(p); }
      const rec = await idbGet(p);
      await idbDel(p);
      if (cfg() && (!rec || rec.uploaded)) deleteRemote(p);
    }
  }
  /** open or save an attachment safely: only types that can't run code are opened in a tab */
  async function open(meta) {
    const blob = await getBlob(meta.path, meta.type);
    if (!blob) throw new Error("Couldn't load that file. Check your connection.");
    const type = SAFE_OPEN.has(meta.type) ? meta.type : "application/octet-stream";
    const u = URL.createObjectURL(new Blob([blob], { type }));
    const a = document.createElement("a");
    a.href = u; a.rel = "noopener";
    if (SAFE_OPEN.has(meta.type)) a.target = "_blank"; else a.download = meta.name || "file";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  async function pendingCount() { return (await idbAll()).filter(r => r && !r.uploaded).length; }

  if (typeof window !== "undefined") window.addEventListener("online", () => flush());
  Z.media = { addPhoto, addAttachment, url, remove, open, flush, scanImage, blobToB64, pendingCount, MAX_ATTACHMENT, RASTER,
    blob: (path, type) => getBlob(path, type) };
})(globalThis.Z = globalThis.Z || {});
