// Renders SCHEMA (world, domain "world") and SERVER_SCHEMA (domain "server") as
// collapsible categories and keeps a domain-tagged value map.

const Form = (() => {
  const controls = {}; // key -> { read, write, row, field, domain }
  const sections = {}; // catId -> { details, fields }
  let onChangeCb = () => {};

  const ALL_CATS = () => SERVER_SCHEMA.concat(SCHEMA); // server categories first

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function buildControl(field) {
    if (field.type === "bool") {
      const input = el("input", { type: "checkbox", class: "f-toggle" });
      input.checked = !!field.default;
      input.addEventListener("change", onChangeCb);
      return { node: input, read: () => input.checked, write: (v) => { input.checked = !!v; } };
    }

    if (field.type === "enum") {
      const select = el("select", { class: "f-select" });
      for (const opt of field.options) {
        select.appendChild(el("option", { value: opt.value, text: opt.label }));
      }
      select.value = field.default;
      select.addEventListener("change", onChangeCb);
      return { node: select, read: () => select.value, write: (v) => { select.value = v; } };
    }

    if (field.type === "int" || field.type === "float") {
      const isFloat = field.type === "float";
      const step = field.step ?? (isFloat ? 0.1 : 1);
      const number = el("input", {
        type: "number", class: "f-number",
        min: field.min, max: field.max, step,
      });
      number.value = field.default;
      let slider = null;
      if (Number.isFinite(field.min) && Number.isFinite(field.max)) {
        slider = el("input", { type: "range", class: "f-slider", min: field.min, max: field.max, step });
        slider.value = field.default;
        slider.addEventListener("input", () => { number.value = slider.value; onChangeCb(); });
      }
      number.addEventListener("input", () => { if (slider) slider.value = number.value; onChangeCb(); });
      const parse = (s) => {
        const n = isFloat ? parseFloat(s) : parseInt(s, 10);
        return Number.isNaN(n) ? field.default : n;
      };
      const wrap = el("div", { class: "f-range" }, [slider, number].filter(Boolean));
      return {
        node: wrap,
        read: () => parse(number.value),
        write: (v) => { number.value = v; if (slider) slider.value = v; },
      };
    }

    // "string" (and any fallback): text input, optionally nullable (empty → null).
    const input = el("input", { type: "text", class: "f-text" });
    input.value = field.default == null ? "" : field.default;
    input.addEventListener("input", onChangeCb);
    return {
      node: input,
      read: () => (field.nullable && input.value === "" ? null : input.value),
      write: (v) => { input.value = v == null ? "" : v; },
    };
  }

  function buildRow(field, catTitle, domain) {
    const ctrl = buildControl(field);

    const labelText = el("span", { class: "f-label-text", text: field.label });
    const badges = el("span", { class: "f-badges" });
    if (field.creationOnly) {
      badges.appendChild(el("span", { class: "badge badge-creation", text: "creation only",
        title: "Only applied when the world is first created." }));
    }
    const labelTop = el("div", { class: "f-label-top" }, [labelText, badges]);
    const help = field.help ? el("div", { class: "f-help", text: field.help }) : null;
    const labelCol = el("div", { class: "f-labelcol" }, [labelTop, help]);
    const ctrlCol = el("div", { class: "f-ctrlcol" }, [ctrl.node]);

    const row = el("div", { class: "f-row" }, [labelCol, ctrlCol]);
    // Category title is part of the search text so searching a category name
    // matches every field inside it.
    row.dataset.searchText =
      (field.label + " " + field.key + " " + (field.help || "") + " " + catTitle).toLowerCase();

    controls[field.key] = { read: ctrl.read, write: ctrl.write, row, field, domain };
    return row;
  }

  function renderSchema(schema, container, domain) {
    for (const cat of schema) {
      const details = el("details", { class: "cat", id: `section-${cat.id}` });
      const summary = el("summary", { class: "cat-summary" }, [
        el("span", { class: "cat-name", text: cat.title }),
        el("span", { class: "cat-count", text: String(cat.fields.length) }),
      ]);
      details.appendChild(summary);

      const body = el("div", { class: "cat-body" });
      if (cat.note) body.appendChild(el("p", { class: "f-section-note", text: cat.note }));
      for (const field of cat.fields) body.appendChild(buildRow(field, cat.title, domain));
      details.appendChild(body);
      container.appendChild(details);

      sections[cat.id] = { details, fields: cat.fields };
    }
  }

  function build(worldContainer, serverContainer, onChange) {
    onChangeCb = onChange || (() => {});
    worldContainer.textContent = "";
    serverContainer.textContent = "";
    renderSchema(SERVER_SCHEMA, serverContainer, "server");
    renderSchema(SCHEMA, worldContainer, "world");
  }

  // Append category links in the same order as the form (server, then world).
  function buildNav(navEl) {
    for (const cat of ALL_CATS()) {
      const li = el("li", { class: "nav-item" });
      const a = el("a", { href: `#section-${cat.id}`, class: "nav-link", text: cat.title });
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openCategory(cat.id, true);
        navEl.querySelectorAll(".nav-link").forEach((n) => n.classList.remove("active"));
        a.classList.add("active");
      });
      li.appendChild(a);
      navEl.appendChild(li);
    }
  }

  function openCategory(id, scroll) {
    const sec = sections[id];
    if (!sec) return;
    sec.details.open = true;
    if (scroll) sec.details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function readDomain(domain) {
    const out = {};
    for (const [key, c] of Object.entries(controls)) if (c.domain === domain) out[key] = c.read();
    return out;
  }

  function writeDomain(domain, values) {
    for (const [key, c] of Object.entries(controls)) {
      if (c.domain !== domain) continue;
      const v = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : c.field.default;
      c.write(v);
    }
  }

  function reset() { writeDomain("world", {}); writeDomain("server", {}); }

  // Filter rows by query across both schemas; matching categories expand.
  function filter(query) {
    const q = (query || "").trim().toLowerCase();
    for (const cat of ALL_CATS()) {
      const sec = sections[cat.id];
      let anyVisible = false;
      for (const field of cat.fields) {
        const c = controls[field.key];
        const match = !q || c.row.dataset.searchText.includes(q);
        c.row.classList.toggle("hidden", !match);
        if (match) anyVisible = true;
      }
      sec.details.classList.toggle("hidden", !anyVisible);
      if (q) sec.details.open = anyVisible;
    }
  }

  return {
    build, buildNav, openCategory, filter, reset,
    read: () => readDomain("world"),
    readServer: () => readDomain("server"),
    write: (v) => writeDomain("world", v),
    writeServer: (v) => writeDomain("server", v),
  };
})();
