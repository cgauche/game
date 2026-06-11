/**
 * Protocole coop (Jalon 7) — messages typés du DataChannel, modèle hôte-autoritaire :
 * les invités envoient des INTENTS (action de store rejouable), l'hôte renvoie des SNAPSHOTS
 * (état complet, mêmes données JSON-sûres que la sauvegarde). `parseMessage` valide la FORME
 * de chaque message : le réseau est une entrée non fiable → null, jamais d'exception.
 */
export const PROTOCOL_VERSION = 1;

export type NetMessage =
  | { kind: 'hello'; protocol: number; build: string; name: string }
  | { kind: 'intent'; action: string; args: unknown[]; seat: number }
  | { kind: 'snapshot'; data: Record<string, unknown> }
  | { kind: 'assign'; heroId: string; seat: number }
  | { kind: 'bye' };

export function serializeMessage(m: NetMessage): string {
  return JSON.stringify(m);
}

export function parseMessage(raw: string): NetMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
  switch (m.kind) {
    case 'hello':
      return typeof m.protocol === 'number' && typeof m.build === 'string' && typeof m.name === 'string'
        ? { kind: 'hello', protocol: m.protocol, build: m.build, name: m.name }
        : null;
    case 'intent':
      return typeof m.action === 'string' && Array.isArray(m.args) && typeof m.seat === 'number'
        ? { kind: 'intent', action: m.action, args: m.args, seat: m.seat }
        : null;
    case 'snapshot':
      return m.data != null && typeof m.data === 'object' && !Array.isArray(m.data)
        ? { kind: 'snapshot', data: m.data as Record<string, unknown> }
        : null;
    case 'assign':
      return typeof m.heroId === 'string' && typeof m.seat === 'number'
        ? { kind: 'assign', heroId: m.heroId, seat: m.seat }
        : null;
    case 'bye':
      return { kind: 'bye' };
    default:
      return null;
  }
}
