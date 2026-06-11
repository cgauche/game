/**
 * Codes de signalisation coop (Jalon 7) — arbitrage utilisateur : « un code à partager, sans
 * dépendre d'un système externe ». L'offre/réponse WebRTC (SDP + candidats ICE) voyage en CODE
 * TEXTE copiable par n'importe quel canal (Discord, SMS…) : JSON → deflate-raw (natif
 * `CompressionStream`, zéro dépendance) → base64url, préfixé `W4C1.` (format versionné — un
 * code d'une autre version est rejeté proprement).
 *
 * Tout code invalide (préfixe, base64, déflate, JSON) → null, jamais d'exception : un code
 * collé est une entrée non fiable.
 */
export const CODE_PREFIX = 'W4C1.';

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = await new Response(blob.stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Payload (JSON-sûr) → code texte copiable. */
export async function encodeSignal(payload: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const deflated = await pipeThrough(json, new CompressionStream('deflate-raw'));
  return CODE_PREFIX + toBase64Url(deflated);
}

/** Code collé → payload, ou null si invalide (préfixe/base64/déflate/JSON). */
export async function decodeSignal(code: string): Promise<unknown | null> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(CODE_PREFIX)) return null;
  const bytes = fromBase64Url(trimmed.slice(CODE_PREFIX.length));
  if (!bytes || !bytes.length) return null;
  try {
    const inflated = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(inflated)) as unknown;
  } catch {
    return null;
  }
}
