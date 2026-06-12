/**
 * Logique PURE de room coop (aucune API Cloudflare) : codes, tokens, sièges.
 * Le Durable Object (room.ts) n'est que de la glue WebSocket autour de ce module —
 * c'est CE fichier qui est testé (vitest racine, include server/).
 */
export const MAX_GUESTS = 3; // sièges 1..3 (0 = l'hôte)

/** Alphabet sans ambiguïté (pas de I/L/O/0/1) — 32^6 ≈ 1 milliard de codes. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface SeatInfo {
  seat: number;
  name: string;
  /** Secret de REPRISE : tant que la room vit, ce token ré-attache au même siège. */
  token: string;
}

export interface RoomData {
  hostToken: string;
  seats: SeatInfo[];
}

const pick = (rand: () => number) => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];

export function makeCode(rand: () => number): string {
  return Array.from({ length: 6 }, () => pick(rand)).join('');
}

export function makeToken(rand: () => number): string {
  return Array.from({ length: 20 }, () => pick(rand)).join('');
}

/** Nouvel invité : premier siège libre (1..MAX_GUESTS), ou null si la room est pleine. */
export function joinGuest(room: RoomData, name: string, rand: () => number): SeatInfo | null {
  const taken = new Set(room.seats.map((s) => s.seat));
  let seat = 0;
  for (let i = 1; i <= MAX_GUESTS; i++) {
    if (!taken.has(i)) { seat = i; break; }
  }
  if (!seat) return null;
  const info: SeatInfo = { seat, name: name.trim() || `Joueur ${seat + 1}`, token: makeToken(rand) };
  room.seats.push(info);
  return info;
}

/** Reprise : retrouve le siège par token (room vivante = token valable, cf. spec §6). */
export function resumeGuest(room: RoomData, token: string): SeatInfo | null {
  return room.seats.find((s) => s.token === token) ?? null;
}
