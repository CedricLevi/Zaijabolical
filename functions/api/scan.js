/**
 * Cloudflare Pages Function: POST /api/scan
 * Reads a recipe page or a Nutrition Facts label from a photo and returns it as JSON.
 *
 * Who can use it: only a device that holds a GitHub key for your private data repo. The key is checked
 * against GitHub on every new key (then remembered for 10 minutes); it is never stored or logged.
 *
 * Which AI reads the photo:
 *   - default: Cloudflare Workers AI (free daily allowance). Needs a Workers AI binding named "AI" on the
 *     Pages project (Settings → Bindings → Add → Workers AI).
 *   - optional: Claude, if you add a secret ANTHROPIC_API_KEY (Settings → Variables and Secrets).
 * Optional variables: DATA_REPO (default "CedricLevi/zaijabolical-data"), AI_MODEL, CLAUDE_MODEL.
 * Photos are sent to the AI only to be read, and are not kept here.
 */
const DEFAULT_REPO = "CedricLevi/zaijabolical-data";
const WORKERS_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const CLAUDE_MODEL = "claude-sonnet-5-5";
const MAX_IMAGES = 4, MAX_IMAGE_CHARS = 4_000_000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

// ---------------- prompts ----------------
const RECIPE_PROMPT = `You are transcribing a recipe from photos of a cookbook page, recipe card, handwritten note or screenshot.
Copy what is written; do not invent ingredients, amounts or steps. Return only JSON with these fields:
- name: the recipe title ("" if none)
- servings: number of servings or pieces it makes, or null
- category: your best guess, one of "Breakfast", "Main", "Side", "Snack", "Add-on"
- prep_min, cook_min: minutes if the recipe states them, else null
- description: the recipe's short intro/headnote if there is one, else ""
- ingredients: one entry per ingredient line, in order, each with
    name: just the ingredient, without amount or preparation (e.g. "red lentils", "garlic", "vegetable broth")
    amount: a number (convert fractions: "1 1/2" -> 1.5, "½" -> 0.5), or null if none
    unit: the unit as written, singular (e.g. "cup", "tbsp", "tsp", "g", "oz", "can", "clove", "medium"), or ""
    note: preparation or extra words (e.g. "diced", "rinsed and drained", "to taste"), or ""
    text: the full original line as written
    unclear: true if you were not sure how to read the line
- steps: the method as a list of strings, one per step, without step numbers
- notes: any tips, storage or serving notes, else ""
If there are several photos, they are consecutive pages of the same recipe.`;

const TEXT_PROMPT = `Below is text from a cookbook. Find every complete recipe in it (a title with ingredients and a method).
Skip essays, stories, tables of contents and anything that isn't a recipe. Copy the wording; don't invent anything.
Return only JSON: {"recipes": [ ... ]}, each recipe with these fields:
- name, servings (number or null), category ("Breakfast", "Main", "Side", "Snack" or "Add-on"), prep_min, cook_min (numbers if stated, else null)
- description: the intro/headnote if any, else ""
- ingredients: [{name, amount (number or null), unit, note, text (the original line)}], one per ingredient. If the recipe is written as prose, pull the ingredients out of the sentences.
- steps: the method as a list of strings
- notes: tips or variations, else ""
If there are no recipes, return {"recipes": []}.`;
const PHOTO_PROMPT = n => `This photo is from a cookbook. Which of these ${n} recipes does it show? Reply with JSON only: {"index": number} using the number from the list, or {"index": -1} if it shows none of them.`;

const LABEL_NUTRIENTS = ["calories", "total_fat", "saturated_fat", "trans_fat", "cholesterol", "sodium", "total_carbohydrate",
  "dietary_fiber", "total_sugars", "added_sugars", "protein", "vitamin_d", "calcium", "iron", "potassium", "vitamin_a", "vitamin_c",
  "vitamin_e", "vitamin_k", "thiamin", "riboflavin", "niacin", "vitamin_b6", "folate", "vitamin_b12", "biotin", "pantothenic_acid",
  "choline", "phosphorus", "iodine", "magnesium", "zinc", "selenium", "copper", "manganese", "omega_3_ala"];
const LABEL_PROMPT = `Read the Nutrition Facts (or Supplement Facts) panel in the photo. Return only JSON:
- product: the product name if visible, else ""
- serving_text: the serving size exactly as printed (e.g. "1 cup (240 mL)", "3 tbsp (30g)")
- serving_grams: grams in one serving if printed (a number), else null
- serving_ml: millilitres in one serving if printed, else null
- servings_per_container: number or null
- nutrients: an object with any of these keys that appear on the label: ${LABEL_NUTRIENTS.join(", ")}.
  Each value is {"amount": number or null, "unit": "g" | "mg" | "mcg" | "IU" | "kcal" | "" , "dv": percent daily value as a number or null}.
  Copy amounts per ONE serving exactly as printed. If only a % Daily Value is printed, set amount null and fill dv.
  Leave out nutrients that are not on the label. Do not guess.`;

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" }, servings: { type: ["number", "null"] }, category: { type: "string" },
    prep_min: { type: ["number", "null"] }, cook_min: { type: ["number", "null"] }, description: { type: "string" },
    ingredients: { type: "array", items: { type: "object", properties: {
      name: { type: "string" }, amount: { type: ["number", "null"] }, unit: { type: "string" }, note: { type: "string" },
      text: { type: "string" }, unclear: { type: "boolean" } }, required: ["name"] } },
    steps: { type: "array", items: { type: "string" } }, notes: { type: "string" },
  },
  required: ["name", "ingredients", "steps"],
};
const TEXT_SCHEMA = { type: "object", properties: { recipes: { type: "array", items: RECIPE_SCHEMA } }, required: ["recipes"] };
const PHOTO_SCHEMA = { type: "object", properties: { index: { type: "number" } }, required: ["index"] };
const NUT_VALUE = { type: "object", properties: { amount: { type: ["number", "null"] }, unit: { type: "string" }, dv: { type: ["number", "null"] } } };
const LABEL_SCHEMA = {
  type: "object",
  properties: {
    product: { type: "string" }, serving_text: { type: "string" }, serving_grams: { type: ["number", "null"] },
    serving_ml: { type: ["number", "null"] }, servings_per_container: { type: ["number", "null"] },
    nutrients: { type: "object", properties: Object.fromEntries(LABEL_NUTRIENTS.map(k => [k, NUT_VALUE])) },
  },
  required: ["serving_text", "nutrients"],
};

// ---------------- auth: the caller must hold a key for the private data repo ----------------
const okKeys = new Map();   // sha256(key) -> expiry (per worker instance, short-lived)
async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function authorize(request, env) {
  const key = request.headers.get("X-Zaija-Key") || "";
  const repo = (env.DATA_REPO || DEFAULT_REPO).trim();
  if (!key || key.length > 400 || /\s/.test(key)) return "Missing access key.";
  const sent = (request.headers.get("X-Zaija-Repo") || "").toLowerCase();
  if (sent && sent !== repo.toLowerCase()) return `Scanning is only enabled for ${repo}.`;
  const h = await sha256(key);
  if ((okKeys.get(h) || 0) > Date.now()) return null;
  const r = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json", "User-Agent": "zaijabolical-scan",
      "X-GitHub-Api-Version": "2022-11-28" } });
  if (r.status !== 200) return "This device's GitHub key doesn't open the data repo, so it can't use scanning.";
  const info = await r.json();
  if (!info.private || (info.permissions && info.permissions.push === false)) return "The data repo must be private and the key must be able to save to it.";
  okKeys.set(h, Date.now() + 10 * 60 * 1000);
  return null;
}

// ---------------- AI engines ----------------
function parseJson(out) {
  if (out && typeof out === "object") return out;
  let s = String(out || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}
async function workersAi(env, prompt, schema, image) {
  const model = env.AI_MODEL || WORKERS_MODEL;
  const messages = [
    { role: "system", content: "You turn cookbook pages and photos into accurate JSON. Reply with JSON only." },
    { role: "user", content: image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image } }] : prompt },
  ];
  let out;
  try {
    out = await env.AI.run(model, { messages, max_tokens: 4096, temperature: 0.1, response_format: { type: "json_schema", json_schema: schema } });
  } catch (e) {   // some models refuse JSON mode for long outputs: ask again without it
    out = await env.AI.run(model, { messages, max_tokens: 4096, temperature: 0.1 });
  }
  return parseJson(out && out.response !== undefined ? out.response : out);
}
async function claude(env, prompt, images) {
  const content = images.map(img => {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(img);
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  });
  content.push({ type: "text", text: prompt + "\nReply with the JSON object only." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || CLAUDE_MODEL, max_tokens: 4096, messages: [{ role: "user", content }] }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && data.error && data.error.message) || `Claude request failed (${r.status})`);
  return parseJson((data.content || []).filter(c => c.type === "text").map(c => c.text).join(""));
}
function mergeRecipes(parts) {
  const out = { name: "", servings: null, category: "", prep_min: null, cook_min: null, description: "", ingredients: [], steps: [], notes: "" };
  for (const p of parts) {
    for (const k of ["name", "category", "description"]) if (!out[k] && p[k]) out[k] = p[k];
    for (const k of ["servings", "prep_min", "cook_min"]) if (out[k] == null && p[k] != null) out[k] = p[k];
    out.ingredients.push(...(p.ingredients || []));
    out.steps.push(...(p.steps || []));
    if (p.notes) out.notes = [out.notes, p.notes].filter(Boolean).join("\n");
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  if ((request.headers.get("Content-Type") || "").split(";")[0].trim() !== "application/json") return json({ error: "Expected JSON" }, 415);
  const denied = await authorize(request, env);
  if (denied) return json({ error: denied }, 401);
  const engine = env.ANTHROPIC_API_KEY ? "claude" : env.AI ? "workers-ai" : null;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (body.kind === "ping") return json({ ok: !!engine, engine });
  if (!engine) return json({ error: "Scanning isn't switched on yet: in Cloudflare, add a Workers AI binding named AI to the zaijabolical Pages project, then redeploy." }, 503);
  if (body.kind === "text") {   // cookbook text (EPUB/PDF import): no photo
    const text = String(body.text || "");
    if (!text.trim() || text.length > 24000) return json({ error: "Send between 1 and 24,000 characters of text." }, 400);
    try {
      const prompt = TEXT_PROMPT + "\n\n---\n" + text;
      const result = engine === "claude" ? await claude(env, prompt, []) : await workersAi(env, prompt, TEXT_SCHEMA, null);
      return json({ kind: "text", engine, result: { recipes: Array.isArray(result.recipes) ? result.recipes : [] } });
    } catch (e) {
      return json({ error: "That part of the book couldn't be read. (" + String(e.message || e).slice(0, 160) + ")" }, 502);
    }
  }
  if (!["recipe", "label", "photo"].includes(body.kind)) return json({ error: "Unknown scan type" }, 400);
  const images = Array.isArray(body.images) ? body.images : [];
  if (!images.length || images.length > MAX_IMAGES) return json({ error: `Send 1 to ${MAX_IMAGES} photos.` }, 400);
  for (const img of images) {
    if (typeof img !== "string" || img.length > MAX_IMAGE_CHARS || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img))
      return json({ error: "Photos must be JPEG, PNG or WebP under about 3 MB." }, 400);
  }
  if (body.kind === "photo") {   // which of these recipes does this cookbook photo show?
    const names = (Array.isArray(body.candidates) ? body.candidates : []).slice(0, 6).map(x => String(x).slice(0, 120));
    if (!names.length) return json({ error: "No recipe names sent." }, 400);
    try {
      const prompt = PHOTO_PROMPT(names.length) + "\n" + names.map((n, i) => `${i}. ${n}`).join("\n");
      const result = engine === "claude" ? await claude(env, prompt, images.slice(0, 1)) : await workersAi(env, prompt, PHOTO_SCHEMA, images[0]);
      const index = Number(result.index);
      return json({ kind: "photo", engine, result: { index: Number.isInteger(index) && index >= 0 && index < names.length ? index : -1 } });
    } catch (e) {
      return json({ error: "The photo couldn't be matched. (" + String(e.message || e).slice(0, 160) + ")" }, 502);
    }
  }
  const prompt = body.kind === "recipe" ? RECIPE_PROMPT : LABEL_PROMPT;
  const schema = body.kind === "recipe" ? RECIPE_SCHEMA : LABEL_SCHEMA;
  try {
    let result;
    if (engine === "claude") result = await claude(env, prompt, images);
    else if (body.kind === "recipe" && images.length > 1) {
      const parts = [];
      for (const img of images) parts.push(await workersAi(env, prompt, schema, img));
      result = mergeRecipes(parts);
    } else result = await workersAi(env, prompt, schema, images[0]);
    return json({ kind: body.kind, engine, result });
  } catch (e) {
    return json({ error: "The photo couldn't be read. Try again with the page flat, well lit and filling the frame. (" + String(e.message || e).slice(0, 160) + ")" }, 502);
  }
}
