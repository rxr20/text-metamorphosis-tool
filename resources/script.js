/* TMT app. WebLLM is ES modules only: loaded from CDN so index.html works via file:// (no local server).
   Inference and sentence review logic is unchanged from rxr-phrase; tools now come from the registry (tools/). */
(function () {
  const TMT = window.TMT;
  const MODELS = [
    ["Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "Qwen2.5 0.5B (tiny, fastest)"],
    ["SmolLM2-360M-Instruct-q4f16_1-MLC", "SmolLM2 360M (tiny)"],
    ["Llama-3.2-1B-Instruct-q4f16_1-MLC", "Llama 3.2 1B"],
    ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC", "Qwen2.5 1.5B (better quality)"],
    ["gemma-2-2b-it-q4f16_1-MLC", "Gemma 2 2B"],
    ["Phi-3.5-mini-instruct-q4f16_1-MLC", "Phi 3.5 mini 3.8B (heavier)"],
    ["Qwen3-4B-q4f16_1-MLC", "Qwen3 4B (multilingual, ~3.4 GB GPU)"],
    ["Qwen3-8B-q4f16_1-MLC", "Qwen3 8B (best translations, ~5.7 GB GPU)"],
    ["Qwen3.5-4B-q4f16_1-MLC", "Qwen3.5 4B (newer multilingual, ~3.9 GB GPU)"],
  ];
  const DEFAULT_INSTRUCTION = "Fix spelling, typos, grammar and punctuation. Keep the meaning, tone and wording otherwise.";
  /* Helper faces: swap `emoji` for `gif` ("resources/helper-idle.gif") to use real assets later. */
  /* Mascot GIFs (transparent, 2:3). Swapped only when the key changes so the animation does not restart on every render. */
  const MASCOT = {
    idle: "resources/img/mascot-idle.gif",
    inspecting: "resources/img/mascot-inspecting.gif",
    working: "resources/img/mascot-working.gif",
  };
  Object.values(MASCOT).forEach((src) => (new Image().src = src));
  let lastMascot = "";
  /* Emoji fallback, used only if a GIF fails to load. */
  const HELPER_FACES = {
    idle: { emoji: "✨" },
    loading: { emoji: "👀" },
    working: { emoji: "🧠" },
    ready: { emoji: "🎉" },
    error: { emoji: "⚠️" },
  };

  let webllm = null,
    engine = null,
    runId = 0,
    timer = null,
    segs = [],
    stale = true,
    hover = -1,
    checking = false,
    applied = false,
    modelState = "idle",
    fatal = "",
    progress = [0, 0],
    tool = null,
    customText = "";
  const cache = new Map();
  const values = {};
  const $in = $("#input"),
    $out = $("#output"),
    $status = $("#status"),
    $instr = $("#instr");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- status ---------- */
  function setStatus(state, text) {
    modelState = state;
    $status.text(text);
    $("#statuschip").attr("data-state", state);
    updateHelper();
  }
  if (!navigator.gpu) {
    fatal = "WebGPU is not available. Use a recent Chrome or Edge. TMT never falls back to cloud processing.";
    setStatus("error", "WebGPU not available. Use a recent Chrome or Edge");
  }

  import("https://esm.run/@mlc-ai/web-llm")
    .then((mod) => {
      webllm = mod;
      const available = new Set(webllm.prebuiltAppConfig.model_list.map((m) => m.model_id));
      MODELS.filter((m) => available.has(m[0])).forEach((m) => $("#model").append(new Option(m[1], m[0])));
      const preferred = ["Qwen2.5-1.5B-Instruct-q4f16_1-MLC"].find((id) => $("#model option[value='" + id + "']").length);
      if (preferred) $("#model").val(preferred);
      if (!$("#model option").length) {
        fatal = "No supported models were found in this WebLLM build.";
        setStatus("error", "No supported models found in this WebLLM build");
      }
      render();
    })
    .catch((e) => {
      fatal = "The WebLLM runtime could not be downloaded. An internet connection is needed to fetch it (your text is never sent anywhere).";
      setStatus("error", "Failed to load WebLLM (need internet): " + (e.message || e));
      render();
    });

  /* ---------- tools ---------- */
  const svgIcon = (key) =>
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + TMT.icons[key] + "</svg>";
  function iconInto($el, icon) {
    if (TMT.icons[icon]) $el.html(svgIcon(icon));
    else $el.text(icon);
  }
  const toolValues = (t) => values[t.id] || (values[t.id] = Object.fromEntries(t.fields.map((f) => [f.id, f.default])));
  function resolved() {
    if (!tool) return { text: "", missing: [] };
    if (tool.id === "custom") return { text: customText, missing: [] };
    return TMT.resolvePrompt(tool, toolValues(tool));
  }
  const currentInstruction = () => $instr.val().trim() || DEFAULT_INSTRUCTION;

  function matches(t, q) {
    if (!q) return true;
    const hay = [t.name, t.description, t.category, TMT.categories[t.category], t.tags.join(" "), t.author.name, t.author.github, t.origin].join(" ").toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  function renderTools() {
    const q = $("#toolSearch").val().trim().toLowerCase();
    const $l = $("#toolList").empty();
    let shown = 0;
    Object.keys(TMT.categories).forEach((cat) => {
      const items = TMT.tools.filter((t) => t.category === cat && matches(t, q));
      if (!items.length) return;
      shown += items.length;
      $("<div class='grp'>").text(TMT.categories[cat]).appendTo($l);
      items.forEach((t) => {
        const $b = $("<button type='button' class='tool'>").attr({ "data-id": t.id, "aria-pressed": t === tool ? "true" : "false" }).toggleClass("on", t === tool);
        iconInto($("<span class='ti'>").appendTo($b), t.icon);
        $("<span class='tn'>").text(t.name).appendTo($b);
        if (t.id !== "custom") $("<span class='tb'>").text(t.origin === "built-in" ? "BUILT-IN" : "COMMUNITY").toggleClass("com", t.origin !== "built-in").appendTo($b);
        $b.appendTo($l);
      });
    });
    $("#noTools").prop("hidden", shown > 0);
  }

  function renderRejected() {
    const n = TMT.rejected.length;
    $("#rejected")
      .prop("hidden", !n)
      .text(n ? n + (n === 1 ? " tool definition was" : " tool definitions were") + " skipped. See the browser console for details." : "");
  }

  const toolFromHash = () => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    return h && TMT.tools.find((t) => t.hash === h);
  };
  function selectTool(id, fromHash) {
    const next = TMT.tools.find((t) => t.id === id);
    if (!next) return;
    if (!fromHash && location.hash !== "#" + next.hash) location.hash = next.hash;
    tool = next;
    $("body").removeClass("tools-open");
    $("#toolsToggle").attr("aria-expanded", "false");
    showTool();
    renderTools();
    schedule(0);
  }

  function showTool() {
    $("#ctxTool").text(tool.name);
    iconInto($("#tIcon").empty(), tool.icon);
    $("#tName").text(tool.name);
    $("#tBadge")
      .text(tool.id === "custom" ? "" : tool.origin === "built-in" ? "BUILT-IN" : "COMMUNITY")
      .toggleClass("com", tool.origin !== "built-in");
    $("#tDesc").text(tool.description);
    $("#exBefore").text(tool.example.before);
    $("#exAfter").text(tool.example.after);
    const $by = $("#tBy").empty();
    if (tool.id !== "custom") {
      $by.append(document.createTextNode("by "));
      if (tool.author.github) $("<a target='_blank' rel='noopener noreferrer'>").attr("href", tool.author.github).text(tool.author.name).appendTo($by);
      else $by.append(document.createTextNode(tool.author.name));
      if (tool.version) $by.append(document.createTextNode(" · v" + tool.version));
    }
    $instr.val(resolved().text);
    renderFields();
  }

  /* ---------- language picker (language-select fields) ---------- */
  const flagOf = (code) => (code ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");
  const langCode = (name) => {
    const l = (TMT.languages || []).find((x) => x[0].toLowerCase() === String(name || "").trim().toLowerCase());
    return l ? l[1] : "";
  };
  const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  let langPaint = () => {};

  function setField(f, v) {
    toolValues(tool)[f.id] = v;
    $instr.val(resolved().text);
    langPaint();
    schedule(600);
    render();
  }

  function langPicker(f, id) {
    const $root = $("<div class='lang'>");
    const $btn = $("<button type='button' class='langbtn' aria-haspopup='listbox' aria-expanded='false'>").attr("id", id);
    $btn.append("<span class='fl'></span>", "<span class='ln'></span>", CHEV);
    const $panel = $("<div class='langpanel' hidden>");
    const $s = $("<input class='inp' type='search' placeholder='Search or type a language…' aria-label='Search languages' autocomplete='off' spellcheck='false'>");
    const $ul = $("<ul role='listbox' class='langlist'>");
    $panel.append($s, $ul);
    $root.append($btn, $panel);

    langPaint = () => {
      const v = toolValues(tool)[f.id];
      $btn.find(".fl").text(v ? flagOf(langCode(v)) : "🌐");
      $btn.find(".ln").text(v || "Choose language…");
      $btn.toggleClass("missing", f.required && !v);
      $("#quick .chip").each(function () {
        const on = !!v && $(this).attr("data-name").toLowerCase() === v.trim().toLowerCase();
        $(this).toggleClass("on", on).attr("aria-pressed", String(on));
      });
    };
    const close = () => {
      $panel.prop("hidden", true);
      $btn.attr("aria-expanded", "false");
      $(document).off(".langpanel");
    };
    const pick = (v) => {
      setField(f, v);
      close();
      $btn.trigger("focus");
    };
    function list() {
      const q = $s.val().trim().toLowerCase();
      $ul.empty();
      (TMT.languages || [])
        .filter((l) => l[0].toLowerCase().includes(q))
        .forEach((l) => {
          const $b = $("<button type='button' role='option'>").attr("data-v", l[0]);
          $("<span class='fl'>").text(flagOf(l[1])).appendTo($b);
          $("<span>").text(l[0]).appendTo($b);
          if (toolValues(tool)[f.id] === l[0]) $b.addClass("on");
          $("<li>").append($b).appendTo($ul);
        });
      const exact = (TMT.languages || []).some((l) => l[0].toLowerCase() === q);
      if (q && !exact) {
        const $b = $("<button type='button' role='option' class='custom'>").attr("data-v", $s.val().trim().slice(0, 60));
        $("<span class='fl'>").text("✎").appendTo($b);
        $("<span>").text("Use “" + $s.val().trim().slice(0, 60) + "”").appendTo($b);
        $("<li>").append($b).appendTo($ul);
      }
    }
    $btn.on("click", () => {
      if (!$panel.prop("hidden")) return close();
      $panel.prop("hidden", false);
      $btn.attr("aria-expanded", "true");
      $s.val("");
      list();
      $s.trigger("focus");
      $(document).on("mousedown.langpanel", (e) => {
        if (!$root[0].contains(e.target)) close();
      });
    });
    $s.on("input", list).on("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const $first = $ul.find("button").first();
        if ($first.length) pick($first.attr("data-v"));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        $ul.find("button").first().trigger("focus");
      } else if (e.key === "Escape") close();
    });
    $ul.on("click", "button", function () {
      pick($(this).attr("data-v"));
    });
    $ul.on("keydown", "button", function (e) {
      const $all = $ul.find("button"),
        i = $all.index(this);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        $all.eq(Math.min(i + 1, $all.length - 1)).trigger("focus");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (i === 0) $s.trigger("focus");
        else $all.eq(i - 1).trigger("focus");
      } else if (e.key === "Escape") {
        close();
        $btn.trigger("focus");
      }
    });
    langPaint();
    return $root;
  }

  function renderQuick(f) {
    const items = (TMT.quickLanguages || [])
      .map((n) => [n, langCode(n)])
      .filter((x) => x[1])
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
    if (!items.length) return;
    const $q = $("#quick").prop("hidden", false);
    $("<span class='lbl'>").text("Quick pick").appendTo($q);
    const $row = $("<div class='chips' role='group' aria-label='Quick language pick'>").appendTo($q);
    items.forEach(([n, c]) => {
      $("<button type='button' class='chip' aria-pressed='false'>").attr({ "data-name": n, title: n + " (" + c + ")", "aria-label": n }).text(flagOf(c)).on("click", () => setField(f, n)).appendTo($row);
    });
    langPaint();
  }

  function renderFields() {
    const $f = $("#fields").empty();
    $("#quick").empty().prop("hidden", true);
    langPaint = () => {};
    let quick = false;
    tool.fields.forEach((f) => {
      const $w = $("<div class='fld'>");
      const id = "f-" + f.id;
      $("<label class='lbl'>").attr("for", id).text(f.label + (f.required ? " *" : "")).appendTo($w);
      if (f.type === "language-select") {
        const $bar = $("<div class='xbar'>").appendTo($w.addClass("langfld"));
        $("<span class='src' title='The model detects the source language'>").text("✦ Auto-detect").appendTo($bar);
        $("<span class='arrow' aria-hidden='true'>").text("→").appendTo($bar);
        $bar.append(langPicker(f, id));
        if (!quick) {
          quick = true;
          renderQuick(f);
        }
        return $w.appendTo($f);
      }
      let $c;
      if (f.type === "select") {
        $c = $("<select class='sel'>").attr("id", id);
        f.options.forEach((o) => $c.append(new Option(o, o)));
      } else $c = $("<input class='inp' autocomplete='off' spellcheck='false'>").attr("id", id);
      $c.val(toolValues(tool)[f.id]).toggleClass("missing", f.required && !toolValues(tool)[f.id]);
      $c.on("input change", function () {
        toolValues(tool)[f.id] = $(this).val();
        $(this).toggleClass("missing", f.required && !$(this).val().trim());
        $instr.val(resolved().text);
        schedule(600);
        render();
      });
      $w.append($c).appendTo($f);
    });
  }

  $("#toolList").on("click", ".tool", function () {
    selectTool($(this).attr("data-id"));
  });
  $("#toolSearch").on("input", renderTools);
  $("#toolsToggle").on("click", function () {
    const open = $("body").toggleClass("tools-open").hasClass("tools-open");
    $(this).attr("aria-expanded", String(open));
  });

  $instr.on("input", () => {
    const v = $instr.val();
    if (tool.id !== "custom" && v === resolved().text) return schedule(1200);
    const match = TMT.tools.find((t) => t.id !== "custom" && t.fields.length === 0 && t.prompt === v);
    if (match) {
      tool = match;
      history.replaceState(null, "", "#" + tool.hash);
      $("#ctxTool").text(tool.name);
      showToolMeta();
    } else if (tool.id !== "custom") {
      tool = TMT.tools.find((t) => t.id === "custom");
      history.replaceState(null, "", "#" + tool.hash);
      showToolMeta();
    }
    if (tool.id === "custom") customText = v;
    renderTools();
    schedule(1200);
    render();
  });
  /* Instruction save/load: a plain-text .tmtprompt file, read and written locally in the browser. */
  $("#instrSave").on("click", () => {
    const text = $instr.val().trim();
    if (!text) return;
    const name = (tool.name || "prompt").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "prompt";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = name + ".tmtprompt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#instrLoad").on("click", () => $("#instrFile").trigger("click"));
  $("#instrFile").on("change", function () {
    const file = this.files && this.files[0];
    this.value = "";
    if (!file || file.size > 20000) return;
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result).replace(/\s+/g, " ").trim().slice(0, 2000);
      if (text) $instr.val(text).trigger("input");
    };
    r.readAsText(file);
  });
  function showToolMeta() {
    const keep = $instr.val();
    showTool();
    $instr.val(keep);
  }

  /* ---------- model ---------- */
  $("#load").on("click", async () => {
    if (!navigator.gpu) return render();
    if (!webllm) {
      setStatus("error", "WebLLM runtime not loaded yet. Check your connection");
      return;
    }
    $("#load, #model").prop("disabled", true);
    setStatus("loading", "Starting…");
    try {
      engine = null;
      engine = await webllm.CreateMLCEngine($("#model").val(), {
        initProgressCallback: (r) => {
          $("#bar").css("width", Math.round((r.progress || 0) * 100) + "%");
          setStatus("loading", r.text.length > 70 ? r.text.slice(0, 70) + "…" : r.text);
        },
      });
      setStatus("ready", "Ready · " + $("#model option:selected").text());
      $("#bar").css("width", "0%");
      check();
    } catch (e) {
      $("#bar").css("width", "0%");
      setStatus("error", "Load failed: " + (e.message || e));
    }
    $("#load, #model").prop("disabled", false);
    render();
  });

  /* ---------- sentence engine (unchanged behaviour) ---------- */
  function split(text) {
    return (text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || []).map((s) => {
      const core = s.trim();
      return { lead: s.match(/^\s*/)[0], core, trail: core ? s.match(/\s*$/)[0] : "", fixed: core, changed: false };
    });
  }

  async function correct(core) {
    const instruction = currentInstruction();
    const key = $("#model").val() + "|" + instruction + "|" + core;
    if (cache.has(key)) return cache.get(key);
    const system =
      "You rewrite the user's text following this instruction: " +
      instruction +
      "\nReply with ONLY the resulting text — no quotes, notes or explanations. If the text needs no change, repeat it exactly.";
    const res = await engine.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: core },
      ],
      temperature: 0,
      max_tokens: Math.min(500, core.length * 3 + 60),
      /* Qwen3 models "think" by default; we want the answer only. */
      ...(/^Qwen3/.test($("#model").val()) ? { extra_body: { enable_thinking: false } } : {}),
    });
    let out = (res.choices[0].message.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().split("\n")[0].trim();
    if (/<\/?think>/i.test(out)) out = core;
    out = out.replace(/^(corrected( sentence)?|output|result)\s*:\s*/i, "");
    if (/^["“].*["”]$/.test(out) && !/^["“]/.test(core)) out = out.slice(1, -1).trim();
    if (!out || out.length > core.length * 3 + 60) out = core;
    cache.set(key, out);
    return out;
  }

  function schedule(ms) {
    runId++;
    clearTimeout(timer);
    checking = false;
    timer = setTimeout(check, ms);
  }

  async function check() {
    if (!engine || resolved().missing.length) return render();
    const my = ++runId;
    segs = split($in.val());
    stale = false;
    checking = true;
    applied = false;
    const todo = segs.filter((s) => s.core);
    progress = [0, todo.length];
    render();
    for (let i = 0; i < todo.length; i++) {
      progress = [i + 1, todo.length];
      renderSummary();
      try {
        todo[i].fixed = await correct(todo[i].core);
      } catch {
        todo[i].fixed = todo[i].core;
      }
      if (my !== runId) return;
      todo[i].changed = todo[i].fixed !== todo[i].core;
      if (todo[i].changed) startFx(todo[i]);
      progress = [i + 1, todo.length];
      render();
      if (todo[i].fx) cue(todo[i]);
    }
    checking = false;
    render();
  }

  /* ---------- rendering ---------- */
  const FX_TOTAL = 700,
    FX_STAGGER = 280,
    FX_MAX_CHARS = 160,
    GLYPHS = "01▒░<>/\\|=+*#%$&?!ΣΩΨ§";
  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const fxActive = (s) => s.fx && performance.now() - s.fx.start < FX_TOTAL;

  function startFx(s) {
    if (reduce.matches) return;
    const busy = segs.filter((x) => x !== s && fxActive(x) && x.fx.mode === "decode").length;
    const mode = seg && s.fixed.length <= FX_MAX_CHARS && busy < 3 ? "decode" : "fade";
    s.fx = { start: performance.now(), mode };
    setTimeout(() => {
      const i = segs.indexOf(s);
      s.fx = null;
      if (i < 0) return;
      const $el = $out.find(".hl[data-i='" + i + "']");
      if ($el.hasClass("fx") || $el.hasClass("fx-fade")) $el.removeClass("fx fx-fade").css("animation-delay", "").text(s.fixed);
      drawBackdrop();
    }, FX_TOTAL + 40);
  }

  function decorate(el, s) {
    const elapsed = performance.now() - s.fx.start;
    if (s.fx.mode === "fade") {
      el.classList.add("fx-fade");
      el.style.animationDelay = -elapsed + "ms";
      return;
    }
    const chars = [...seg.segment(s.fixed)].map((x) => x.segment);
    const n = chars.length || 1;
    el.textContent = "";
    el.classList.add("fx");
    let i = 0;
    const frag = document.createDocumentFragment();
    let word = null;
    chars.forEach((ch) => {
      if (/^\s+$/.test(ch)) {
        word = null;
        frag.appendChild(document.createTextNode(ch));
      } else {
        if (!word) {
          word = document.createElement("span");
          word.className = "w";
          frag.appendChild(word);
        }
        const c = document.createElement("span");
        c.className = "c";
        c.textContent = ch;
        c.dataset.g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        c.style.setProperty("--d", (i / n) * FX_STAGGER - elapsed + "ms");
        word.appendChild(c);
      }
      i++;
    });
    el.appendChild(frag);
  }

  function cue(s) {
    if (reduce.matches || !s.fx) return;
    const i = segs.indexOf(s);
    const a = $("#backdrop .mk[data-i='" + i + "']")[0];
    const b = $out.find(".hl[data-i='" + i + "']")[0];
    if (!a || !b || $("#fxlayer .cue").length >= 3) return;
    const clampTo = (r, pane) => {
      const p = $(pane)[0].getBoundingClientRect();
      return { x: Math.min(Math.max(r.left, p.left + 8), p.right - 8), y: Math.min(Math.max(r.top + r.height / 2, p.top + 40), p.bottom - 24) };
    };
    const from = clampTo(a.getBoundingClientRect(), "#srcPane"),
      to = clampTo(b.getBoundingClientRect(), "#resPane");
    const dot = document.createElement("i");
    dot.className = "cue";
    $("#fxlayer")[0].appendChild(dot);
    const mid = { x: (from.x + to.x) / 2 + 24, y: (from.y + to.y) / 2 };
    const anim = dot.animate(
      [
        { transform: `translate(${from.x}px,${from.y}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${mid.x}px,${mid.y}px) scale(1.1)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${to.x}px,${to.y}px) scale(.5)`, opacity: 0 },
      ],
      { duration: 460, easing: "cubic-bezier(.5,0,.2,1)" }
    );
    anim.onfinish = () => dot.remove();
  }

  function drawBackdrop() {
    const $b = $("#backdrop").empty();
    if (stale) $b.text($in.val() + "​");
    else {
      segs.forEach((s, i) => {
        $b.append(document.createTextNode(s.lead));
        if (s.changed) {
          const $m = $("<span class='mk'>").attr("data-i", i).toggleClass("on", i === hover).text(s.core).appendTo($b);
          if (fxActive(s)) $m.addClass("scan").css("animation-delay", -(performance.now() - s.fx.start) + "ms");
        } else $b.append(document.createTextNode(s.core));
        $b.append(document.createTextNode(s.trail));
      });
      $b.append("​");
    }
    $b.scrollTop($in.scrollTop());
  }

  function emptyMessage() {
    const hasText = !!$in.val().trim();
    if (fatal) return fatal;
    if (resolved().missing.length) return "Choose a value for: " + resolved().missing.join(", ") + ". Suggestions start once it is set.";
    if (!engine && modelState === "loading") return "Loading the model on your device…";
    if (!engine) return "Load a model to see suggestions. Highlighted phrases here are suggestions. Nothing is applied until you click one.";
    if (!hasText) return "Results appear here. Highlighted phrases are suggestions — click one to apply it.";
    return "";
  }

  function renderSummary() {
    const n = segs.filter((s) => s.changed).length;
    let t;
    if (checking) t = `Checking ${progress[0]} of ${progress[1]}…`;
    else if (n) t = n + (n === 1 ? " suggestion" : " suggestions");
    else if (applied && segs.some((s) => s.core)) t = "All suggestions applied";
    else if (engine && !stale && segs.some((s) => s.core)) t = "No changes suggested";
    else if (engine && stale && $in.val().trim()) t = "Waiting for you to pause typing…";
    else t = "Suggestions";
    $("#summary").text(t);
    $("#resPane").toggleClass("working", checking);
    $("#procfill").css("width", checking && progress[1] ? Math.round((progress[0] - 1) / progress[1] * 100) + "%" : "0%");
  }

  function render() {
    const $o = $out.empty();
    drawBackdrop();
    const n = segs.filter((s) => s.changed).length;
    $("#approve").prop("disabled", n === 0);
    renderSummary();
    updateMetrics(n);
    updateHelper();
    const hasCore = segs.some((s) => s.core);
    const msg = emptyMessage();
    if (msg && !(hasCore && engine && !stale)) {
      $o.append($("<span class='empty'>").text(msg));
      return;
    }
    if (!hasCore) {
      $o.append($("<span class='empty'>").text("Results appear here. Highlighted phrases are suggestions — click one to apply it."));
      return;
    }
    segs.forEach((s, i) => {
      $o.append(document.createTextNode(s.lead));
      if (s.changed) {
        const $h = $("<span class='hl' role='button' tabindex='0'>").attr({ "data-i": i, title: "Was: " + s.core }).text(s.fixed).toggleClass("on", i === hover).appendTo($o);
        if (fxActive(s)) decorate($h[0], s);
      } else $o.append(document.createTextNode(s.fixed));
      $o.append(document.createTextNode(s.trail));
    });
  }

  function updateMetrics(pending) {
    const text = $in.val();
    const sents = split(text).filter((s) => s.core);
    const words = (text.match(/\S+/g) || []).length;
    $("#mChars").text(text.length.toLocaleString());
    $("#mWords").text(words.toLocaleString());
    $("#mSent").text(sents.length.toLocaleString());
    $("#mTok").text("~" + Math.ceil(text.length / 4).toLocaleString());
    $("#mPend").text(pending == null ? segs.filter((s) => s.changed).length : pending);
    if (!sents.length) {
      $("#iAvg, #iLong, #iRead").text("-");
      return;
    }
    const wc = sents.map((s) => (s.core.match(/\S+/g) || []).length);
    $("#iAvg").text(Math.round(words / sents.length) + " words");
    $("#iLong").text(Math.max(...wc) + " words");
    const secs = Math.round((words / 220) * 60);
    $("#iRead").text(secs < 60 ? "~" + Math.max(secs, 1) + " sec" : "~" + Math.round(secs / 60) + " min");
  }

  /* Assistant lines: a few variations per situation, one picked at random when the situation changes (not on every render). */
  const LINES = {
    idle: ["Ready when you are!", "Waiting on you. Type or paste something.", "All set. What are we working on?"],
    nomodel: ["Load a model and we're good to go.", "I need a model to get started. Pick one up top!", "Load a model first, then give me some text."],
    loading: ["Getting set up. Hang tight!", "Loading the model, won't be long.", "Almost ready. Just a moment!"],
    waiting: ["I see some new text. I'll start once you pause.", "Take your time. I'll jump in when you stop typing.", "Still typing? No rush."],
    working: ["On it: sentence {k} of {n}.", "Sentence {k} of {n}, nearly there.", "Working on {k} of {n}…"],
    found: ["Found {count}. Have a look!", "{count} ready for you to review.", "Got {count}. Click one to accept it."],
    nochange: ["Looks good to me. Nothing to change!", "All clean here, nothing to suggest.", "No changes needed. Nice!"],
    applied: ["All applied. You're good!", "Done! Everything's applied.", "That's everything. Nicely done!"],
    missing: ["Pick {what} and I'll get going.", "I just need {what} to continue.", "Set {what} and we're off!"],
    error: ["Oops: {text}", "Something went wrong: {text}", "Hmm, that didn't work: {text}"],
  };
  let lastLine = { key: "", i: 0 };
  function say(key, vars) {
    if (lastLine.key !== key) {
      const prev = lastLine.i;
      let i = Math.floor(Math.random() * LINES[key].length);
      if (LINES[key].length > 1 && i === prev) i = (i + 1) % LINES[key].length;
      lastLine = { key, i };
    }
    return LINES[key][lastLine.i % LINES[key].length].replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  function updateHelper() {
    const n = segs.filter((s) => s.changed).length;
    const miss = tool ? resolved().missing : [];
    /* "waiting": there is work to do, but the typing cooldown has not elapsed yet */
    const waiting = !!engine && stale && !!$in.val().trim() && !miss.length && !checking && !fatal && modelState !== "error";
    let st = "idle",
      mk = "idle";
    const vars = { text: "", what: miss.join(", "), k: progress[0], n: progress[1], count: n + (n === 1 ? " suggestion" : " suggestions") };
    if (fatal || modelState === "error") {
      st = "error";
      mk = "error";
      vars.text = fatal || $status.text();
    } else if (miss.length) {
      st = "error";
      mk = "missing";
    } else if (modelState === "loading") {
      st = "loading";
      mk = "loading";
    } else if (checking) {
      st = "working";
      mk = "working";
    } else if (waiting) mk = "waiting";
    else if (n) {
      st = "ready";
      mk = "found";
    } else if (!engine) mk = "nomodel";
    else if (applied) mk = "applied";
    else if (!stale && segs.some((s) => s.core)) mk = "nochange";
    else mk = "idle";
    const msg = say(mk, vars);
    const key = checking ? "working" : waiting ? "inspecting" : "idle";
    if (key !== lastMascot) {
      lastMascot = key;
      const $f = $("#helperFace").empty();
      $("<img alt=''>")
        .attr("src", MASCOT[key])
        .on("error", () => $f.empty().text(HELPER_FACES[st].emoji))
        .appendTo($f);
    }
    $("#helper").attr("data-state", st);
    $("#helperMsg").text(msg);
  }

  /* ---------- review actions (unchanged behaviour) ---------- */
  function sync() {
    $in.val(segs.map((s) => s.lead + s.core + s.trail).join(""));
  }
  function accept(s) {
    s.core = s.fixed;
    s.changed = false;
    s.fx = null;
    applied = true;
  }
  function acceptAt(el) {
    hover = -1;
    accept(segs[$(el).data("i")]);
    sync();
    render();
  }

  $out.on("click", ".hl", function () {
    acceptAt(this);
  });
  $out.on("keydown", ".hl", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      acceptAt(this);
    }
  });
  $out.on("mouseover focusin", ".hl", function () {
    hover = +$(this).data("i");
    drawBackdrop();
    $(this).addClass("on");
  });
  $out.on("mouseout focusout", ".hl", function () {
    hover = -1;
    drawBackdrop();
    $(this).removeClass("on");
  });
  $("#approve").on("click", () => {
    hover = -1;
    segs.forEach((s) => s.changed && accept(s));
    sync();
    render();
  });

  async function copyText(text, $b, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      ta.remove();
    }
    $b.text("Copied");
    setTimeout(() => $b.text(label), 1200);
  }
  $("#copy").on("click", function () {
    copyText($in.val(), $(this), "Copy");
  });
  $("#copyRes").on("click", function () {
    const text = !stale && segs.some((s) => s.core) ? segs.map((s) => s.lead + s.fixed + s.trail).join("") : $in.val();
    copyText(text, $(this), "Copy result");
  });

  $in.on("input", () => {
    stale = true;
    hover = -1;
    applied = false;
    drawBackdrop();
    schedule(1200);
    renderSummary();
    updateMetrics();
    updateHelper();
    if (!segs.some((s) => s.changed)) $("#approve").prop("disabled", true);
  });
  $in.on("scroll", () => $("#backdrop").scrollTop($in.scrollTop()));

  /* ---------- ambient background ---------- */
  (function () {
    const $p = $("#particles");
    for (let i = 0; i < 18; i++) {
      $("<i>").css({ left: Math.random() * 100 + "%", animationDuration: 18 + Math.random() * 26 + "s", animationDelay: -Math.random() * 40 + "s", opacity: 0.2 + Math.random() * 0.5, transform: "scale(" + (0.5 + Math.random()) + ")" }).appendTo($p);
    }
  })();

  /* ---------- start ---------- */
  TMT.load().then(() => {
    renderRejected();
    tool = toolFromHash() || TMT.tools.find((t) => t.id === "grammar-correction") || TMT.tools[0];
    showTool();
    renderTools();
    render();
    window.addEventListener("hashchange", () => {
      const t = toolFromHash();
      if (t && t !== tool) selectTool(t.id, true);
    });
  });
})();
