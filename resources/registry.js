/* TMT tool registry: validates declarative tool definitions. Tool files only register data, never code. */
(function () {
  const TMT = (window.TMT = window.TMT || {});
  const CATEGORIES = { improve: "Improve", translate: "Translate", transform: "Transform", custom: "Custom" };
  const ICONS = {
    "spell-check": '<path d="M3 17l4-10 4 10M4.5 13.5h5M13 15l2.5 2.5L21 11"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    simplify: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14c1 1.5 2.5 2.2 4 2.2s3-.7 4-2.2M9 9.5h.01M15 9.5h.01"/>',
    graduation: '<path d="M2 9l10-5 10 5-10 5zM6 11.5V16c3 2.5 9 2.5 12 0v-4.5"/>',
    wand: '<path d="M4 20L16 8M14 6l4 4M18 3v3M16.5 4.5h3M6 5v2M5 6h2"/>',
    pen: '<path d="M4 20l1-4L17 4l3 3L8 19zM14 7l3 3"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5.5a3 3 0 010 5.5M18 14c2 .8 3 2.8 3 6"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10l3 2.5L7 15M12 15h5"/>',
  };
  const FIELD_TYPES = ["language-select", "text", "select"];
  const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const FIELD_ID_RE = /^[A-Za-z][A-Za-z0-9]*$/;
  const PH_RE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;
  const tools = [];
  const ids = new Set();
  const hashes = new Set();
  const rejected = [];

  TMT.categories = CATEGORIES;
  TMT.icons = ICONS;
  TMT.tools = tools;
  TMT.rejected = rejected;
  TMT.fieldTypes = FIELD_TYPES;

  const isData = (v, d = 0) => {
    if (d > 6) return false;
    if (v === null) return true;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return true;
    if (Array.isArray(v)) return v.every((x) => isData(x, d + 1));
    if (t === "object" && Object.getPrototypeOf(v) === Object.prototype) return Object.values(v).every((x) => isData(x, d + 1));
    return false;
  };
  const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

  function validate(d) {
    if (!d || typeof d !== "object" || !isData(d)) return "definition must be plain data (no functions or objects with behaviour)";
    if (!str(d.id, 60) || !ID_RE.test(d.id)) return "id must be lowercase kebab-case";
    if (ids.has(d.id)) return "duplicate id";
    if (d.hash !== undefined && !(str(d.hash, 60) && ID_RE.test(d.hash))) return "hash must be lowercase kebab-case";
    if (hashes.has(d.hash || d.id) || (d.hash && ids.has(d.hash))) return "duplicate hash";
    if (!str(d.name, 40)) return "name is required (max 40 characters)";
    if (!CATEGORIES[d.category] || d.category === "custom") return "category must be improve, translate or transform";
    if (!str(d.icon, 16) || !(ICONS[d.icon] || (/^\p{Extended_Pictographic}/u.test(d.icon) && [...d.icon].length <= 4))) return "icon must be an approved icon key or a single emoji";
    if (!d.author || !str(d.author.name, 60)) return "author.name is required";
    if (d.author.github !== undefined && !(typeof d.author.github === "string" && /^https:\/\/github\.com\/[A-Za-z0-9._\/-]+$/.test(d.author.github))) return "author.github must be a https://github.com/ URL";
    if (!str(d.description, 300)) return "description is required (max 300 characters)";
    if (!str(d.prompt, 1000)) return "prompt is required (max 1000 characters)";
    if (!d.example || !str(d.example.before, 300) || !str(d.example.after, 300)) return "example.before and example.after are required";
    if (d.tags !== undefined && !(Array.isArray(d.tags) && d.tags.length <= 10 && d.tags.every((t) => str(t, 24)))) return "tags must be up to 10 short strings";
    if (d.version !== undefined && !(Number.isInteger(d.version) && d.version >= 1 && d.version < 1000)) return "version must be a whole number such as 1";
    if (d.license !== undefined && !str(d.license, 40)) return "license must be a short string";
    const fields = d.fields === undefined ? [] : d.fields;
    if (!Array.isArray(fields) || fields.length > 4) return "fields must be an array of up to 4 items";
    const fids = new Set();
    for (const f of fields) {
      if (!f || !FIELD_ID_RE.test(f.id || "") || fids.has(f.id)) return "field ids must be unique letters/numbers starting with a letter";
      if (!str(f.label, 40)) return "field " + f.id + " needs a label";
      if (!FIELD_TYPES.includes(f.type)) return "unsupported field type: " + f.type;
      if (f.type === "language-select" && f.source !== undefined && f.source !== "languages") return "language-select source must be \"languages\"";
      if (f.type === "select" && !(Array.isArray(f.options) && f.options.length > 0 && f.options.length <= 50 && f.options.every((o) => str(o, 60)))) return "select field " + f.id + " needs options";
      if (f.default !== undefined && !str(f.default, 60)) return "field " + f.id + " has an invalid default";
      if (f.required !== undefined && typeof f.required !== "boolean") return "field required must be true or false";
      fids.add(f.id);
    }
    for (const m of d.prompt.matchAll(PH_RE)) if (!fids.has(m[1])) return "prompt references unknown field {{" + m[1] + "}}";
    return null;
  }

  TMT.registerTool = function (def) {
    const cs = document.currentScript;
    const origin = cs && cs.dataset && cs.dataset.tmtOrigin === "built-in" ? "built-in" : "community";
    const label = def && typeof def.id === "string" ? def.id : "(unknown)";
    let err;
    try {
      err = validate(def);
    } catch (e) {
      err = "could not be read";
    }
    if (err) {
      console.warn("[TMT] Skipped tool " + label + ": " + err);
      rejected.push({ id: label, why: err });
      return;
    }
    const f = JSON.parse(JSON.stringify(def));
    ids.add(f.id);
    hashes.add(f.hash || f.id);
    tools.push({
      id: f.id, hash: f.hash || f.id, name: f.name.trim(), category: f.category, icon: f.icon, origin,
      author: { name: f.author.name.trim(), github: f.author.github || "" },
      description: f.description.trim(), tags: f.tags || [], prompt: f.prompt.trim(),
      fields: (f.fields || []).map((x) => ({ id: x.id, label: x.label, type: x.type, options: x.options || [], required: x.required !== false, default: x.default || "" })),
      example: { before: f.example.before, after: f.example.after }, version: f.version || "", license: f.license || "",
    });
  };

  TMT.load = function () {
    const list = (TMT.manifest || []).filter((p) => {
      const ok = typeof p === "string" && /^tools\/(built-in|community)\/[a-z0-9-]+\.js$/.test(p);
      if (!ok) {
        console.warn("[TMT] Ignored manifest entry: " + p);
        rejected.push({ id: String(p), why: "manifest path must look like tools/community/my-tool.js" });
      }
      return ok;
    });
    return Promise.all(
      list.map(
        (p) =>
          new Promise((done) => {
            const s = document.createElement("script");
            s.async = false;
            s.dataset.tmtOrigin = p.indexOf("/built-in/") > -1 ? "built-in" : "community";
            s.onload = done;
            s.onerror = () => {
              console.warn("[TMT] Could not load " + p);
              rejected.push({ id: p, why: "file could not be loaded" });
              done();
            };
            s.src = p;
            document.head.appendChild(s);
          })
      )
    ).then(() => {
      const order = Object.keys(CATEGORIES);
      tools.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || (a.origin === b.origin ? 0 : a.origin === "built-in" ? -1 : 1));
      tools.push({
        id: "custom", hash: "custom", name: "Custom Instruction", category: "custom", icon: "wand", origin: "built-in",
        author: { name: "rxr20", github: "https://github.com/rxr20" }, tags: ["custom", "prompt", "freeform"],
        description: "Write your own instruction for the AI. Edit the instruction line above the editors at any time.",
        prompt: "", fields: [], example: { before: "The meeting is at 3pm.", after: "(depends on your instruction)" }, version: "", license: "",
      });
      return tools;
    });
  };

  const clean = (v) => String(v == null ? "" : v).replace(/[\r\n{}]+/g, " ").trim().slice(0, 60);

  /* Returns the instruction with field values filled in, plus any required fields still empty. */
  TMT.resolvePrompt = function (tool, values) {
    const missing = [];
    tool.fields.forEach((f) => {
      if (f.required && !clean(values && values[f.id])) missing.push(f.label);
    });
    const text = tool.prompt.replace(PH_RE, (m, id) => clean(values && values[id]) || "…");
    return { text, missing };
  };
})();
