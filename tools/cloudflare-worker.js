/**
 * Cloudflare Worker: serves Zaijabolical at https://cedriclevi.com/zaijabolical
 *
 * Your main site is untouched: this Worker only answers requests whose path starts
 * with /zaijabolical (that's the route you attach it to). It fetches the app from its
 * own Cloudflare Pages address (including the photo scanner at /zaijabolical/api/scan) and, at
 * /zaijabolical/usda/..., relays nutrition lookups to USDA FoodData Central in case a browser blocks calling USDA directly.
 * No keys or data are stored here.
 */
const APP = "https://zaijabolical.pages.dev";   // the app's Cloudflare Pages address
const PREFIX = "/zaijabolical";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === PREFIX) return Response.redirect(url.origin + PREFIX + "/" + url.search, 301);
    if (!url.pathname.startsWith(PREFIX + "/")) return fetch(request);   // not ours: pass through
    const rest = url.pathname.slice(PREFIX.length);                       // e.g. "/js/ui.js"

    // USDA relay (GET/POST only, only to FoodData Central)
    if (rest.startsWith("/usda/")) {
      if (!["GET", "POST"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
      const target = "https://api.nal.usda.gov/fdc/v1/" + rest.slice("/usda/".length) + url.search;
      const init = { method: request.method, headers: { "Content-Type": "application/json", Accept: "application/json" } };
      if (request.method === "POST") init.body = await request.text();
      const r = await fetch(target, init);
      return new Response(r.body, { status: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    // the app itself
    const hasBody = !["GET", "HEAD"].includes(request.method);   // e.g. a photo sent to /zaijabolical/api/scan
    const r = await fetch(APP + rest + url.search, { method: request.method, headers: request.headers, redirect: "manual",
      body: hasBody ? request.body : undefined });
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) {   // keep Pages' own redirects under /zaijabolical
      const to = new URL(loc, APP);
      if (to.origin === new URL(APP).origin) return Response.redirect(url.origin + PREFIX + to.pathname + to.search, r.status);
    }
    return r;
  },
};
