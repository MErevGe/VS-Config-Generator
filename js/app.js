// Wires the form, meta inputs and output panel: tabs, copy/download, search,
// reset, playstyle presets and permalink loading.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const baseUrl = () => location.origin + location.pathname;

  let latest = null;
  let tokenSeq = 0; // guards against stale async token results on rapid edits

  function readMeta() {
    const mapSizeY = parseInt($("#meta-mapsizey").value, 10);
    return {
      includeAll: $("#opt-includeall").checked,
      seed: $("#meta-seed").value.trim(),
      worldName: $("#meta-worldname").value.trim(),
      playStyle: $("#meta-playstyle").value,
      mapSizeY: Number.isNaN(mapSizeY) ? 256 : mapSizeY,
      baseUrl: baseUrl(),
    };
  }

  function recompute() {
    const values = Form.read();
    latest = Output.compute(values, readMeta(), Roles.getConfig(), Form.readServer());
    $("#out-snippet").textContent = latest.snippet;
    $("#out-server").textContent = latest.serverConfig;

    // Token + permalink are encoded asynchronously; show a placeholder and fill
    // in when ready, ignoring results from edits that were since superseded.
    latest.token = "";
    latest.permalink = "";
    $("#out-token").textContent = "…";
    $("#out-permalink").textContent = "…";
    const seq = ++tokenSeq;
    Codec.encode(latest.payload).then((token) => {
      if (seq !== tokenSeq) return;
      latest.token = token;
      latest.permalink = latest.baseUrl + "#c=" + token;
      $("#out-token").textContent = latest.token;
      $("#out-permalink").textContent = latest.permalink;
    });

    const count = Object.keys(latest.attributes).length;
    $("#out-count").textContent =
      `${count} setting${count === 1 ? "" : "s"} ${readMeta().includeAll ? "total" : "changed from default"}`;
  }

  // Decode token attributes (all strings) back into typed form values.
  function coerceAttrs(attrs) {
    const values = {};
    for (const [key, raw] of Object.entries(attrs)) {
      const field = FIELDS_BY_KEY[key];
      if (!field) continue;
      if (field.type === "bool") values[key] = raw === true || raw === "true";
      else if (field.type === "int") values[key] = parseInt(raw, 10);
      else if (field.type === "float") values[key] = parseFloat(raw);
      else values[key] = String(raw);
    }
    return values;
  }

  async function loadFromHash() {
    const m = location.hash.match(/[#&]c=([^&]+)/);
    if (!m) return false;
    try {
      const payload = await Codec.decode(decodeURIComponent(m[1]));
      Form.write(coerceAttrs(payload.worldConfiguration || {}));
      if (payload.server) Form.writeServer(payload.server);
      if (payload.roles) {
        Roles.setConfig({ roles: payload.roles, defaultRoleCode: payload.defaultRoleCode });
      }
      const w = payload.world || {};
      if (w.WorldName != null) $("#meta-worldname").value = w.WorldName;
      if (w.Seed != null) $("#meta-seed").value = w.Seed;
      if (w.PlayStyle) $("#meta-playstyle").value = w.PlayStyle;
      if (Number.isFinite(w.MapSizeY)) $("#meta-mapsizey").value = w.MapSizeY;
      return true;
    } catch (e) {
      console.warn("Could not load config from URL:", e);
      return false;
    }
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts / older browsers.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("ok");
      setTimeout(() => { btn.textContent = old; btn.classList.remove("ok"); }, 1200);
    }
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setupBurger() {
    const burger = $("#burger");
    const sidebar = document.querySelector(".sidebar");
    if (!burger || !sidebar) return;
    const setOpen = (open) => {
      sidebar.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
    };
    burger.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!sidebar.classList.contains("open"));
    });
    // Close after picking a category, or when clicking outside the menu.
    $("#nav").addEventListener("click", (e) => {
      if (e.target.closest(".nav-link")) setOpen(false);
    });
    document.addEventListener("click", (e) => {
      if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== burger) {
        setOpen(false);
      }
    });
  }

  function setupTabs() {
    const tabs = document.querySelectorAll(".tab");
    const panes = document.querySelectorAll(".pane");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        panes.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $("#pane-" + tab.dataset.tab).classList.add("active");
      });
    });
  }

  function payloadFor(kind) {
    if (!latest) return "";
    return {
      snippet: latest.snippet,
      server: latest.serverConfig,
      token: latest.token,
      permalink: latest.permalink,
    }[kind];
  }

  function setupActions() {
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => copyText(payloadFor(btn.dataset.copy), btn));
    });
    document.querySelectorAll("[data-download]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.download;
        const name = kind === "server" ? "serverconfig.json" : "worldconfig.json";
        download(name, payloadFor(kind));
      });
    });
  }

  // Filter the static (non-schema) meta + roles sections by query.
  function filterExtraSections(query) {
    const q = (query || "").trim().toLowerCase();
    for (const id of ["section-meta", "section-roles"]) {
      const sec = document.getElementById(id);
      if (!sec) continue;
      const match = !q || sec.textContent.toLowerCase().includes(q);
      sec.classList.toggle("hidden", !match);
      if (q) sec.open = match;
    }
  }

  function runSearch(query) {
    Form.filter(query);
    filterExtraSections(query);
  }

  // Toggle every category (schema sections + meta + roles) as one group:
  // if any is collapsed, open all; otherwise collapse all.
  function toggleAll() {
    const all = [...document.querySelectorAll(".form-panel details.cat")];
    const anyClosed = all.some((d) => !d.open);
    all.forEach((d) => { d.open = anyClosed; });
  }

  // Append an extra nav link that opens an arbitrary <details> section by id.
  function addNavLink(label, sectionId) {
    const li = document.createElement("li");
    li.className = "nav-item";
    const a = document.createElement("a");
    a.className = "nav-link";
    a.href = "#" + sectionId;
    a.textContent = label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const sec = document.getElementById(sectionId);
      if (sec) { sec.open = true; sec.scrollIntoView({ behavior: "smooth", block: "start" }); }
      document.querySelectorAll("#nav .nav-link").forEach((n) => n.classList.remove("active"));
      a.classList.add("active");
    });
    li.appendChild(a);
    $("#nav").appendChild(li);
  }

  // Playstyle changes optionally apply that preset's world config defaults,
  // after a confirmation (it overwrites the current world settings).
  let playstylePrev = "surviveandbuild";
  function setupPlaystyle() {
    const sel = $("#meta-playstyle");
    playstylePrev = sel.value;
    sel.addEventListener("change", () => {
      const code = sel.value;
      const preset = PLAYSTYLE_PRESETS[code];
      const label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : code;
      if (preset && window.confirm(
        `Apply the "${label}" playstyle defaults to the world settings?\n\n` +
        "This overwrites your current world config values (server settings and roles are kept)."
      )) {
        Form.write(preset); // preset overrides + reset every other world field to default
        playstylePrev = code;
      } else {
        sel.value = playstylePrev; // cancelled — revert the selection
      }
      recompute();
    });
  }

  async function init() {
    Form.build($("#form"), $("#server"), recompute);
    Roles.build($("#roles"), recompute);
    // Nav order mirrors the on-screen form order: meta first, then schema
    // categories, then server roles last.
    addNavLink("Server config options", "section-meta");
    Form.buildNav($("#nav"));
    addNavLink("Server roles", "section-roles");

    // Meta inputs and options also trigger a recompute (playstyle handled below).
    ["#meta-seed", "#meta-worldname", "#meta-mapsizey", "#opt-includeall"]
      .forEach((sel) => {
        const node = $(sel);
        node.addEventListener("input", recompute);
        node.addEventListener("change", recompute);
      });

    setupPlaystyle();

    $("#search").addEventListener("input", (e) => runSearch(e.target.value));
    $("#btn-expand").addEventListener("click", toggleAll);
    $("#btn-reset").addEventListener("click", () => {
      Form.reset();
      $("#search").value = "";
      runSearch("");
      recompute();
    });

    setupTabs();
    setupActions();
    setupBurger();

    await loadFromHash();
    playstylePrev = $("#meta-playstyle").value; // sync after a permalink load
    recompute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
