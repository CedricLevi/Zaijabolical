// Checks the Cloudflare Worker's routing with a fake fetch.
import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../tools/cloudflare-worker.js", import.meta.url), "utf8");
writeFileSync("/tmp/cfw.mjs", src);
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const u = typeof input === "string" ? input : input.url;
  calls.push([u, init.method || (input.method) || "GET"]);
  if (u === "https://zaijabolical.pages.dev/old") return new Response(null, { status: 308, headers: { location: "/new" } });
  return new Response("ok:" + u, { status: 200 });
};
const w = (await import("/tmp/cfw.mjs")).default;
let r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical"));
assert.equal(r.status, 301); assert.equal(r.headers.get("location"), "https://cedriclevi.com/zaijabolical/");
r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical/js/ui.js?v=1"));
assert.equal(await r.text(), "ok:https://zaijabolical.pages.dev/js/ui.js?v=1");
r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical/"));
assert.equal(await r.text(), "ok:https://zaijabolical.pages.dev/");
r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical/old"));
assert.equal(r.headers.get("location"), "https://cedriclevi.com/zaijabolical/new");
r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical/usda/foods/search?api_key=K", { method: "POST", body: '{"query":"tofu"}' }));
assert.equal(await r.text(), "ok:https://api.nal.usda.gov/fdc/v1/foods/search?api_key=K");
r = await w.fetch(new Request("https://cedriclevi.com/zaijabolical/usda/foods/x", { method: "DELETE" }));
assert.equal(r.status, 405);
r = await w.fetch(new Request("https://cedriclevi.com/about"));
assert.equal(await r.text(), "ok:https://cedriclevi.com/about");
console.log("worker ok");
