// Builds the snippet, serverconfig.json block, token and permalink.
// World config values are stringified, since Vintage Story stores them as
// strings under WorldConfig.WorldConfiguration; server settings stay native.

const Output = (() => {
  function stringifyValue(v) {
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    return String(v);
  }

  // Build the worldConfiguration object. By default only values that differ from
  // the schema default are included; includeAll emits every key.
  function buildAttributes(values, includeAll) {
    const attrs = {};
    for (const cat of SCHEMA) {
      for (const field of cat.fields) {
        const v = values[field.key];
        if (v === undefined) continue;
        if (includeAll || v !== field.default) {
          attrs[field.key] = stringifyValue(v);
        }
      }
    }
    return attrs;
  }

  // Top-level serverconfig.json settings (native types). Only values differing
  // from the default are kept unless includeAll is set.
  function buildServerSettings(serverValues, includeAll) {
    const out = {};
    if (!serverValues) return out;
    for (const cat of SERVER_SCHEMA) {
      for (const field of cat.fields) {
        const v = serverValues[field.key];
        if (v === undefined) continue;
        if (includeAll || v !== field.default) out[field.key] = v;
      }
    }
    return out;
  }

  // The WorldConfig block, mirroring a real serverconfig.json.
  function buildWorldConfig(attrs, meta) {
    return {
      Seed: meta.seed ? String(meta.seed) : null,
      WorldName: meta.worldName || "A new world",
      AllowCreativeMode: true,
      PlayStyle: meta.playStyle,
      PlayStyleLangCode: meta.playStyle,
      WorldType: "standard",
      WorldConfiguration: Object.keys(attrs).length ? attrs : null,
      MapSizeY: Number.isFinite(meta.mapSizeY) ? meta.mapSizeY : null,
    };
  }

  function compute(values, opts, rolesCfg, serverValues) {
    const meta = {
      seed: opts.seed,
      worldName: opts.worldName,
      playStyle: opts.playStyle || "surviveandbuild",
      mapSizeY: Number.isFinite(opts.mapSizeY) ? opts.mapSizeY : 256,
    };

    const attrs = buildAttributes(values, opts.includeAll);
    const snippet = JSON.stringify(attrs, null, 2);

    const block = {};
    Object.assign(block, buildServerSettings(serverValues, opts.includeAll));
    if (rolesCfg && rolesCfg.changed) {
      block.Roles = rolesCfg.roles;
      block.DefaultRoleCode = rolesCfg.defaultRoleCode;
    }
    block.WorldConfig = buildWorldConfig(attrs, meta);
    const serverConfig = JSON.stringify(block, null, 2);

    // Token + permalink ALWAYS carry the full world config (a partial/empty
    // token would otherwise overwrite the server config with gaps). Server
    // settings and roles are merge-safe, so only changed ones are embedded.
    const fullAttrs = buildAttributes(values, true);
    const payload = {
      world: { WorldName: meta.worldName || null, Seed: meta.seed || null, PlayStyle: meta.playStyle, MapSizeY: meta.mapSizeY },
      worldConfiguration: fullAttrs,
    };
    const serverChanged = buildServerSettings(serverValues, false);
    if (Object.keys(serverChanged).length) payload.server = serverChanged;
    if (rolesCfg && rolesCfg.changed) {
      payload.roles = rolesCfg.roles;
      payload.defaultRoleCode = rolesCfg.defaultRoleCode;
    }
    // The token is encoded asynchronously by the caller (Compression Streams
    // API is promise-based); hand back the payload + base URL to build it.
    return { attributes: attrs, snippet, serverConfig, payload, baseUrl: opts.baseUrl };
  }

  return { compute, buildAttributes };
})();
