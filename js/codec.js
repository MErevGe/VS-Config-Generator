// Self-contained config token.
//   v3.<base64url(deflate-raw(JSON))>  — current, compressed
//   v2.<base64url(JSON)>               — legacy, still decodable
// deflate-raw shrinks the repetitive world config by ~70%. Encode/decode are
// async because the Compression Streams API is promise-based.

const TOKEN_VERSION = "v3";

function bytesToBase64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const deflateRaw = (bytes) => streamBytes(bytes, new CompressionStream("deflate-raw"));
const inflateRaw = (bytes) => streamBytes(bytes, new DecompressionStream("deflate-raw"));

const Codec = {
  async encode(config) {
    const json = new TextEncoder().encode(JSON.stringify(config));
    return TOKEN_VERSION + "." + bytesToBase64url(await deflateRaw(json));
  },

  async decode(token) {
    const trimmed = String(token).trim();
    const dot = trimmed.indexOf(".");
    if (dot === -1) throw new Error("Invalid token: missing version prefix");
    const version = trimmed.slice(0, dot);
    const payload = trimmed.slice(dot + 1);
    if (version === "v3") {
      const json = await inflateRaw(base64urlToBytes(payload));
      return JSON.parse(new TextDecoder().decode(json));
    }
    if (version === "v2") {
      return JSON.parse(new TextDecoder().decode(base64urlToBytes(payload)));
    }
    throw new Error(`Unsupported token version: ${version}`);
  },
};
