/* Runs the planner off the main thread so the page stays responsive while it searches. */
importScripts("data.js", "core.js", "planner.js");
self.onmessage = function (e) {
  const { id, fn, args } = e.data;
  try { self.postMessage({ id, result: self.Z[fn].apply(null, args) }); }
  catch (err) { self.postMessage({ id, error: String((err && err.message) || err) }); }
};
