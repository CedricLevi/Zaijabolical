/* Zaijabolical storage.
   - Everything is kept in one JSON document.
   - A copy always lives in this browser (localStorage), so the app works offline.
   - If this device is connected to a private GitHub repo, the document is synced there as
     data.json, so every connected phone/computer sees the same recipes and plans.
     Changes from two devices are merged record-by-record (newest edit wins). */
(function (Z) {
  "use strict";
  const LS_DATA = "zaijabolical:data";
  const LS_GH = "zaijabolical:github";
  const LS_LOCAL_ONLY = "zaijabolical:local-only";
  const FILE = "data.json";

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const nowIso = () => new Date().toISOString();
  const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  function emptyDoc() {
    const s = JSON.parse(JSON.stringify(Z.DEFAULT_SETTINGS));
    s.targets = Z.defaultTargets();
    return { version: 1, settings: s, settings_ts: {}, ingredients: [], recipes: [], plans: [],
      current_week: null, week_options: null, logs: [], deleted: {} };
  }

  // ---------------- merge (newest edit wins, per record) ----------------
  function newer(a, b) { return String(a || "") > String(b || ""); }
  function mergeList(a, b, deleted) {
    const map = new Map();
    for (const r of a || []) map.set(r.id, r);
    for (const r of b || []) { const cur = map.get(r.id); if (!cur || newer(r.updated, cur.updated)) map.set(r.id, r); }
    return [...map.values()].filter(r => !(deleted[r.id] && !newer(r.updated, deleted[r.id])));
  }
  function mergeDocs(a, b) {
    if (!a) return b; if (!b) return a;
    const deleted = { ...(a.deleted || {}) };
    for (const [k, v] of Object.entries(b.deleted || {})) if (newer(v, deleted[k])) deleted[k] = v;
    const settings = { ...a.settings }, settings_ts = { ...(a.settings_ts || {}) };
    for (const [k, v] of Object.entries(b.settings || {})) {
      if (!(k in settings) || newer((b.settings_ts || {})[k], settings_ts[k])) { settings[k] = v; settings_ts[k] = (b.settings_ts || {})[k] || settings_ts[k]; }
    }
    const pick = key => (!a[key] ? b[key] : !b[key] ? a[key] : newer(b[key].updated, a[key].updated) ? b[key] : a[key]);
    return {
      version: 1, settings, settings_ts, deleted,
      ingredients: mergeList(a.ingredients, b.ingredients, deleted),
      recipes: mergeList(a.recipes, b.recipes, deleted),
      plans: mergeList(a.plans, b.plans, deleted),
      logs: mergeList(a.logs, b.logs, deleted),
      current_week: pick("current_week"), week_options: pick("week_options"),
    };
  }
  function normalize(doc) {
    const base = emptyDoc();
    doc = Object.assign(base, doc || {});
    doc.settings = Object.assign(emptyDoc().settings, doc.settings || {});
    const t = Z.defaultTargets(); Object.assign(t, doc.settings.targets || {}); doc.settings.targets = t;
    doc.settings.structure = Object.assign({}, Z.DEFAULT_SETTINGS.structure, doc.settings.structure || {});
    doc.settings.week = Object.assign({}, Z.DEFAULT_SETTINGS.week, doc.settings.week || {});
    for (const k of ["profile", "tracker"]) doc.settings[k] = Object.assign({}, Z.DEFAULT_SETTINGS[k], doc.settings[k] || {});
    if (!Array.isArray(doc.logs)) doc.logs = [];
    return doc;
  }

  // ---------------- GitHub ----------------
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  class SyncError extends Error {}

  async function gh(cfg, method, path, body) {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`, {
        method, cache: "no-store",
        headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw new SyncError("offline"); }
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
  }
  function explain(status, data) {
    if (status === 401) return "GitHub didn't accept the access key. It may have expired: create a new one and reconnect in Settings.";
    if (status === 403) return "The access key can't write to that repo. Give it 'Contents: Read and write' permission.";
    if (status === 404) return "Couldn't find that repo with this key. Check the owner/repo name and that the key includes this repo.";
    return (data && data.message) ? `GitHub: ${data.message}` : `GitHub error ${status}`;
  }

  async function ghRead(cfg) {
    const r = await gh(cfg, "GET", `/contents/${FILE}`);
    if (r.status === 404) {
      const repo = await gh(cfg, "GET", "");
      if (repo.status === 200) return { doc: null, sha: null };       // repo is fine, file not created yet
      throw new SyncError(explain(repo.status, repo.data));
    }
    if (r.status !== 200) throw new SyncError(explain(r.status, r.data));
    let content = r.data.content;
    if (!content && r.data.download_url) {   // files over 1 MB come without inline content
      const blob = await gh(cfg, "GET", `/git/blobs/${r.data.sha}`);
      content = blob.data && blob.data.content;
    }
    return { doc: JSON.parse(b64decode(content || "")), sha: r.data.sha };
  }
  async function ghWrite(cfg, doc, sha) {
    const body = { message: `Update Zaijabolical data (${new Date().toLocaleString()})`, content: b64encode(JSON.stringify(doc)) };
    if (sha) body.sha = sha;
    const r = await gh(cfg, "PUT", `/contents/${FILE}`, body);
    if (r.status === 200 || r.status === 201) return r.data.content.sha;
    if (r.status === 409 || r.status === 422) return null;   // someone else saved first: merge and retry
    throw new SyncError(explain(r.status, r.data));
  }

  // ---------------- the store ----------------
  const listeners = new Set();
  const S = {
    doc: null, sha: null, status: "local", error: null, dirty: false, saving: null,
    github: null, localOnly: false,
  };
  function setStatus(status, error) { S.status = status; S.error = error || null; listeners.forEach(f => f(S)); }

  function loadLocal() {
    try { const raw = ls.get(LS_DATA); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function saveLocal() { ls.set(LS_DATA, JSON.stringify({ doc: S.doc, dirty: S.dirty })); }

  async function init() {
    const saved = loadLocal();
    S.doc = normalize(saved && saved.doc);
    S.dirty = !!(saved && saved.dirty);
    try { S.github = JSON.parse(ls.get(LS_GH) || "null"); } catch { S.github = null; }
    S.localOnly = ls.get(LS_LOCAL_ONLY) === "1";
    if (S.github) await pull();
    else setStatus("local");
    return S;
  }

  async function pull() {
    if (!S.github) return;
    setStatus("syncing");
    try {
      const { doc, sha } = await ghRead(S.github);
      S.sha = sha;
      const remote = doc ? normalize(doc) : null;
      if (remote && S.dirty) S.doc = normalize(mergeDocs(remote, S.doc));   // keep unsaved local edits
      else if (remote) S.doc = remote;                                      // nothing unsaved: GitHub is the truth
      saveLocal();
      if (S.dirty || (!remote && (S.doc.recipes.length || S.doc.ingredients.length))) await push();
      else setStatus("synced");
    } catch (e) {
      setStatus(e.message === "offline" ? "offline" : "error", e.message === "offline" ? null : e.message);
    }
  }

  let pushTimer = null;
  function scheduleSave() {
    S.dirty = true;
    saveLocal();
    if (!S.github) { setStatus("local"); return; }
    setStatus("pending");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1200);
  }

  async function push() {
    if (!S.github) return;
    if (S.saving) { S.again = true; return S.saving; }
    setStatus("saving");
    S.saving = (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const sha = await ghWrite(S.github, S.doc, S.sha);
          if (sha) { S.sha = sha; S.dirty = false; saveLocal(); setStatus("synced"); return; }
          const remote = await ghRead(S.github);       // conflict: merge their changes in, then retry
          S.doc = normalize(mergeDocs(remote.doc && normalize(remote.doc), S.doc));
          S.sha = remote.sha;
          saveLocal();
        }
        setStatus("error", "Couldn't save after several tries. Your changes are kept on this device and will sync later.");
      } catch (e) {
        setStatus(e.message === "offline" ? "offline" : "error", e.message === "offline" ? null : e.message);
      } finally {
        S.saving = null;
        if (S.again) { S.again = false; push(); }
      }
    })();
    return S.saving;
  }

  async function connect(cfg) {
    cfg = { owner: cfg.owner.trim(), repo: cfg.repo.trim(), token: cfg.token.trim() };
    const repo = await gh(cfg, "GET", "");
    if (repo.status !== 200) throw new SyncError(explain(repo.status, repo.data));
    if (repo.data && repo.data.private === false)
      throw new SyncError(`${cfg.owner}/${cfg.repo} is public. Use a private repo so your data stays private.`);
    if (repo.data && repo.data.permissions && repo.data.permissions.push === false)
      throw new SyncError("This key can read the repo but not save to it. Give it 'Contents: Read and write' permission.");
    S.github = cfg;
    ls.set(LS_GH, JSON.stringify(cfg));
    ls.del(LS_LOCAL_ONLY); S.localOnly = false;
    S.dirty = S.doc.recipes.length > 0 || S.doc.ingredients.length > 0 || S.dirty;
    await pull();
    if (S.status === "error") throw new SyncError(S.error);
    return S;
  }
  function disconnect() { S.github = null; S.sha = null; ls.del(LS_GH); setStatus("local"); }
  function useLocalOnly() { S.localOnly = true; ls.set(LS_LOCAL_ONLY, "1"); setStatus("local"); }

  function setupLink() {
    if (!S.github) return null;
    const payload = btoa(JSON.stringify({ o: S.github.owner, r: S.github.repo, t: S.github.token }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${location.origin}${location.pathname}#connect=${payload}`;
  }
  function readSetupLink(hash) {
    const m = /connect=([A-Za-z0-9_-]+)/.exec(hash || "");
    if (!m) return null;
    try {
      let b = m[1].replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "=";
      const j = JSON.parse(atob(b));
      return j.o && j.r && j.t ? { owner: j.o, repo: j.r, token: j.t } : null;
    } catch { return null; }
  }

  // ---------------- record helpers used by the API layer ----------------
  function touch(rec) { rec.updated = nowIso(); return rec; }
  function upsert(list, rec) {
    if (!rec.id) rec.id = uid();
    touch(rec);
    const arr = S.doc[list], i = arr.findIndex(x => x.id === rec.id);
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    scheduleSave();
    return rec;
  }
  function remove(list, id) {
    S.doc[list] = S.doc[list].filter(x => x.id !== id);
    S.doc.deleted[id] = nowIso();
    scheduleSave();
  }
  function setSetting(key, value) {
    S.doc.settings[key] = value;
    S.doc.settings_ts[key] = nowIso();
    scheduleSave();
  }
  function setDocField(key, value) {
    S.doc[key] = value ? Object.assign(value, { updated: nowIso() }) : null;
    scheduleSave();
  }

  Z.store = { S, init, pull, push, connect, disconnect, useLocalOnly, setupLink, readSetupLink,
    upsert, remove, setSetting, setDocField, uid, onChange: f => listeners.add(f),
    _mergeDocs: mergeDocs, _normalize: normalize, _emptyDoc: emptyDoc };
})(globalThis.Z = globalThis.Z || {});
