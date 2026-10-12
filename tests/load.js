// Loads the browser scripts into Node (they attach to globalThis.Z).
const path = require("path");
for (const f of ["data.js", "core.js", "solver.js", "planner.js", "tracker.js"]) {
  try { require(path.join(__dirname, "..", "js", f)); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; }
}
module.exports = globalThis.Z;
