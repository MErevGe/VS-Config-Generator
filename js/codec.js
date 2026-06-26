// Self-contained config token: "v2." + base64url(JSON.stringify(payload)), no padding.

const TOKEN_VERSION = "v2";

function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const Codec = {
  encode(config) {
    return TOKEN_VERSION + "." + base64urlEncode(JSON.stringify(config));
  },

  decode(token) {
    const trimmed = String(token).trim();
    const dot = trimmed.indexOf(".");
    if (dot === -1) throw new Error("Invalid token: missing version prefix");
    const version = trimmed.slice(0, dot);
    const payload = trimmed.slice(dot + 1);
    if (version !== TOKEN_VERSION) throw new Error(`Unsupported token version: ${version}`);
    return JSON.parse(base64urlDecode(payload));
  },
};
