# VS-Config-Generator

A static website to build **configurations for a Vintage Story server** — world
settings, server settings and permission roles. Tweak everything, then
copy/download the result or share it as a self-contained token. Hosted on GitHub
Pages — no backend, no build step.

**Live:** https://merevge.github.io/VS-Config-Generator/

## Features

- **Every world config setting** from the
  [Vintage Story Wiki](https://wiki.vintagestory.at/World_Configuration), grouped
  into collapsible categories. World-generation-only settings are clearly marked.
  A left-hand browser and a search box (matches setting **and** category names)
  make it quick to navigate.
- **Server settings** — identity & network, players & slots, world & gameplay,
  security & groups, performance & operations (top-level `serverconfig.json` keys).
- **Server roles editor** — start from the stock roles (suvisitor … admin), then
  add/remove roles and toggle privileges, privilege level, land-claim limits,
  default game mode and `DefaultRoleCode`.
- **Playstyle presets** — switching the playstyle can apply that preset's world
  defaults (after a confirmation).
- Four outputs, updated live:
  1. **Snippet** — the `worldConfiguration` object to paste into your world config.
  2. **serverconfig.json** — a ready-to-merge block (server settings + `WorldConfig`,
     plus `Roles`/`DefaultRoleCode` when customised).
  3. **Token** — a self-contained, DEFLATE-compressed `v3.<base64url>` string
     carrying the full config.
  4. **Permalink** — a link that reopens the generator with the same settings.
- Copy to clipboard, download as a file, reset to defaults.
- Snippet / serverconfig honour a "changes only" vs "include all" toggle; the
  **token always carries the full world config** so it can never overwrite a
  server config with gaps.

## Token format

The token is fully self-contained, so a server can rebuild the config without any
download:

```
v3.<base64url( deflate-raw( JSON.stringify(payload) ) )>   // current, compressed
v2.<base64url( JSON.stringify(payload) )>                  // legacy, uncompressed
```

`v3` compresses the payload with **raw DEFLATE** (via the browser's Compression
Streams API), shrinking the repetitive world config by ~55–70%. `base64url` is
URL-safe (`-_` instead of `+/`) with no `=` padding. Both versions are still
decoded, so older `v2` tokens and permalinks keep working.

```json
{
  "world": { "WorldName": "...", "Seed": null, "PlayStyle": "surviveandbuild", "MapSizeY": 256 },
  "worldConfiguration": { "gameMode": "survival", "globalTemperature": "1.5" },
  "server": { "ServerName": "...", "MaxClients": 32 },
  "roles": [ /* present only when customised */ ],
  "defaultRoleCode": "suplayer"
}
```

`worldConfiguration` is always full (string values, as `serverconfig.json` expects);
`server`, `roles` and `defaultRoleCode` are present only when changed from default.
Decoding a `v3` token needs base64 + raw inflate + JSON (e.g. Python stdlib
`zlib.decompress(data, -15)`; note plain `gzip`/`unzip` won't work — raw DEFLATE
has no header); `v2` needs only base64 + JSON. This is meant for the companion
[VintageStory-Server](https://github.com/MErevGe/VintageStory-Server) project, which
can read the token from a compose variable and apply it at container start.

## Project layout

```
index.html              Page shell, sidebar, output tabs and buttons
css/style.css           Styling (GitHub-dark theme)
js/schema.js            World + server settings and playstyle presets as data
js/codec.js             Token encode/decode
js/form.js              Renders the collapsible form + nav from the schema
js/roles.js             Server roles editor
js/output.js            Builds snippet / serverconfig.json / token / permalink
js/app.js               Init, state, events, permalink loading
.github/workflows/      GitHub Pages deploy workflow
```

## Notes & accuracy

- World config keys, ranges and defaults follow the wiki and are emitted as
  **strings** under `WorldConfig.WorldConfiguration` — matching a real
  server-generated `serverconfig.json`. Server settings keep their native JSON types.
- Playstyle preset values are best-effort from the wiki and may differ by game
  version. The playstyle only affects a freshly generated world in-game.
- The `serverconfig.json` tab is a **mergeable block**, not a full server file —
  merge it into your existing config, and only while the server is **stopped**
  (Vintage Story rewrites the file on shutdown).
- Not affiliated with Anego Studios.

## License

MIT — see [LICENSE](LICENSE).
