// Checks the /api/scan Cloudflare function with fake GitHub and fake AI.
import assert from "node:assert";
const { onRequestPost } = await import("../functions/api/scan.js");
const gh = [];
globalThis.fetch = async (url, init = {}) => {
  gh.push(url);
  if (url === "https://api.github.com/repos/CedricLevi/zaijabolical-data") {
    return init.headers.Authorization === "Bearer good"
      ? new Response(JSON.stringify({ private: true, permissions: { push: true } }), { status: 200 })
      : new Response("{}", { status: 401 });
  }
  throw new Error("unexpected fetch " + url);
};
const aiCalls = [];
const env = { AI: { run: async (model, input) => {
  aiCalls.push([model, input]);
  if (input.response_format && aiCalls.length === 1) throw new Error("JSON mode failed");   // falls back to plain mode
  return { response: '```json\n{"name":"Stew","ingredients":[{"name":"lentils","amount":1,"unit":"cup"}],"steps":["Cook."]}\n```' };
} } };
const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const req = (key, body, ct = "application/json") => new Request("https://x/api/scan", { method: "POST", headers: { "Content-Type": ct, "X-Zaija-Key": key }, body: JSON.stringify(body) });

let r = await onRequestPost({ request: req("bad", { kind: "ping" }), env });
assert.equal(r.status, 401);
r = await onRequestPost({ request: req("good", { kind: "ping" }, "text/plain"), env });
assert.equal(r.status, 415, "no simple cross-site posts");
r = await onRequestPost({ request: req("good", { kind: "ping" }), env: {} });
assert.deepEqual(await r.json(), { ok: false, engine: null });
r = await onRequestPost({ request: req("good", { kind: "recipe", images: [IMG] }), env: {} });
assert.equal(r.status, 503);
r = await onRequestPost({ request: req("good", { kind: "recipe", images: ["data:text/html;base64,PGI+"] }), env });
assert.equal(r.status, 400);
const before = gh.length;
r = await onRequestPost({ request: req("good", { kind: "recipe", images: [IMG] }), env });
const j = await r.json();
assert.equal(r.status, 200, JSON.stringify(j));
assert.equal(j.result.name, "Stew"); assert.equal(j.engine, "workers-ai");
assert.equal(gh.length, before, "a key that was just checked isn't re-checked");
assert.equal(aiCalls[0][1].messages[1].content[1].image_url.url, IMG);
// two pages with Workers AI: read one at a time and merged
r = await onRequestPost({ request: req("good", { kind: "recipe", images: [IMG, IMG] }), env });
const two = (await r.json()).result;
assert.equal(two.ingredients.length, 2); assert.equal(two.steps.length, 2);
console.log("scan function ok");
