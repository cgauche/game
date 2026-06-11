/**
 * Couture STORE ↔ réseau coop (Jalon 7, P1) — module `(get,set)` comme combatFlow.
 *
 * Modèle hôte-autoritaire (spec coop §3) :
 *  - HÔTE : exécute le store normalement ; un abonnement zustand THROTTLÉ diffuse un snapshot
 *    d'état complet (mêmes données JSON-sûres que la sauvegarde) après chaque changement —
 *    couvre aussi les tours d'IA (timers) sans instrumenter chaque action.
 *  - INVITÉ : les actions de combat de l'allowlist sont INTERCEPTÉES (enrobées au branchement,
 *    restaurées au départ) → parties en intent vers l'hôte ; l'état local n'est QUE le reflet
 *    des snapshots reçus. Son `net.mode/mySeat` est préservé à chaque application.
 *
 * Les objets réseau vivants (sessions, RTCPeerConnection en attente) restent des SINGLETONS de
 * module — jamais dans le store (non sérialisables, jamais dans les snapshots).
 */
import type { GameState } from './store';
import { useGame } from './store';
import { snapshotSave } from './saves';
import { HostSession, GuestSession } from '../net/session';
import { COMBAT_INTENTS } from '../net/intents';
import { intentAllowedFor } from './netOwnership';
import { encodeSignal, decodeSignal } from '../net/codes';
import {
  hostCreateOffer, guestAcceptOffer, hostAcceptAnswer, channelTransport, type Transport,
} from '../net/transport';
import { bus, EVT } from './bus';

type Get = () => GameState;
type Set = (partial: Partial<GameState> | ((s: GameState) => Partial<GameState>)) => void;

/** État réseau SÉRIALISABLE (dans GameState). `ownership` : heroId → siège (0 = hôte). */
export interface NetState {
  mode: 'local' | 'host' | 'guest';
  mySeat: number;
  seatNames: Record<number, string>;
  ownership: Record<string, number>;
}
export const initialNet = (): NetState => ({ mode: 'local', mySeat: 0, seatNames: {}, ownership: {} });

// ── Singletons réseau (non sérialisables) ──────────────────────────────────────────────────────
let host: HostSession | null = null;
let guest: GuestSession | null = null;
const pendingInvites = new Map<number, { pc: RTCPeerConnection; channel: RTCDataChannel }>();
let unsubscribe: (() => void) | null = null;
let originals: Record<string, (...args: unknown[]) => unknown> | null = null;
let broadcastTimer: number | null = null;

export const BUILD_ID = 'w4-dev'; // V1 : même build requis de part et d'autre (check au hello)

/** Snapshot d'état pour le réseau — mêmes clés de données que la sauvegarde. */
function netSnapshot(get: Get): Record<string, unknown> {
  return snapshotSave(
    get() as unknown as Record<string, unknown>,
    useGame.getInitialState() as unknown as Record<string, unknown>,
    'net',
  ).data;
}

/** Diffusion throttlée (trailing ~120 ms) : un rafale de mutations (tour d'IA) = un snapshot. */
function scheduleBroadcast(get: Get): void {
  if (!host || broadcastTimer != null) return;
  broadcastTimer = window.setTimeout(() => {
    broadcastTimer = null;
    host?.broadcastSnapshot(netSnapshot(get));
  }, 120);
}

/** L'invité applique un snapshot : état de l'hôte + SON identité réseau préservée. */
function applyNetSnapshot(set: Set, data: Record<string, unknown>): void {
  const base = JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>;
  const mine = useGame.getState().net;
  const incoming = (data as { net?: NetState }).net;
  set({
    ...base,
    ...(data as Partial<GameState>),
    net: { ...(incoming ?? mine), mode: 'guest', mySeat: mine.mySeat },
  });
  bus.emit(EVT.SCENE_DIRTY);
}

/** INVITÉ : enrobe les actions de l'allowlist → intents (l'état viendra du snapshot de l'hôte). */
function interceptGuestActions(): void {
  if (originals) return;
  originals = {};
  const state = useGame.getState() as unknown as Record<string, unknown>;
  const wrapped: Record<string, unknown> = {};
  for (const name of COMBAT_INTENTS) {
    const fn = state[name];
    if (typeof fn !== 'function') continue;
    originals[name] = fn as (...args: unknown[]) => unknown;
    wrapped[name] = (...args: unknown[]) => guest?.sendIntent(name, args);
  }
  useGame.setState(wrapped as Partial<GameState>);
}

/** Restaure les actions locales (fin de session invité). */
function restoreGuestActions(): void {
  if (!originals) return;
  useGame.setState(originals as unknown as Partial<GameState>);
  originals = null;
}

// ── Actions de store (déléguées par store.ts) ──────────────────────────────────────────────────

/** Devient HÔTE : session prête à inviter, diffusion auto des changements d'état. */
export function netHostStart(get: Get, set: Set, name: string): void {
  if (get().net.mode !== 'local') return;
  host = new HostSession({
    build: BUILD_ID,
    allow: COMBAT_INTENTS,
    applyIntent: (action, args, seat) => {
      // Validation de POSSESSION (spec §4bis) : un invité ne pilote que SES combattants —
      // modale ouverte → seul son concerné agit ; sinon seul le propriétaire du tour actif.
      if (!intentAllowedFor(useGame.getState(), seat, action)) {
        get().log(`Action réseau refusée (${action}) : pas le propriétaire.`);
        return;
      }
      const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args);
    },
    getSnapshot: () => netSnapshot(get),
    onSeatClosed: (seat) => {
      const { seatNames, ownership } = get().net;
      const names = { ...seatNames };
      delete names[seat];
      // Ses héros reviennent à l'hôte (spec §6) — et son ✓ ne sera plus requis.
      const own = Object.fromEntries(Object.entries(ownership).map(([h, s]) => [h, s === seat ? 0 : s]));
      set({ net: { ...get().net, seatNames: names, ownership: own } });
      get().log(`Un joueur a quitté — ses héros reviennent à l'hôte.`);
    },
  });
  set({ net: { mode: 'host', mySeat: 0, seatNames: { 0: name }, ownership: {} } });
  unsubscribe = useGame.subscribe(() => scheduleBroadcast(get));
}

/** HÔTE : crée un code d'INVITATION pour un siège (à envoyer à l'invité). */
export async function netInvite(get: Get): Promise<string | null> {
  if (get().net.mode !== 'host' || !host) return null;
  const { pc, channel, offer } = await hostCreateOffer();
  const seat = Object.keys(get().net.seatNames).length + pendingInvites.size; // prochain siège libre
  pendingInvites.set(seat, { pc, channel });
  return encodeSignal({ v: 1, seat, offer });
}

/** HÔTE : colle le code de RÉPONSE d'un invité → la connexion du siège s'établit. */
export async function netAcceptAnswer(get: Get, set: Set, code: string): Promise<boolean> {
  const payload = (await decodeSignal(code)) as { seat?: number; answer?: RTCSessionDescriptionInit; name?: string } | null;
  if (!host || !payload?.answer || payload.seat == null) return false;
  const inv = pendingInvites.get(payload.seat);
  if (!inv) return false;
  pendingInvites.delete(payload.seat);
  await hostAcceptAnswer(inv.pc, payload.answer);
  await new Promise<void>((resolve) => {
    if (inv.channel.readyState === 'open') return resolve();
    inv.channel.onopen = () => resolve();
  });
  host.addGuest(channelTransport(inv.channel) as Transport);
  const name = payload.name || `Joueur ${payload.seat + 1}`;
  set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [payload.seat]: name } } });
  return true;
}

/** INVITÉ : colle le code d'invitation → retourne le code de RÉPONSE à renvoyer à l'hôte. */
export async function netJoin(get: Get, set: Set, inviteCode: string, name: string): Promise<string | null> {
  if (get().net.mode !== 'local') return null;
  const payload = (await decodeSignal(inviteCode)) as { seat?: number; offer?: RTCSessionDescriptionInit } | null;
  if (!payload?.offer || payload.seat == null) return null;
  const seat = payload.seat;
  const { answer, channelReady } = await guestAcceptOffer(payload.offer);
  guest = new GuestSession({
    build: BUILD_ID,
    name,
    applySnapshot: (data) => applyNetSnapshot(set, data),
    onClosed: () => netLeave(get, set),
  });
  set({ net: { mode: 'guest', mySeat: seat, seatNames: { [seat]: name }, ownership: {} } });
  interceptGuestActions();
  void channelReady.then((channel) => guest?.connect(channelTransport(channel) as Transport));
  return encodeSignal({ v: 1, seat, answer, name });
}

/** HÔTE : attribue un héros à un siège (lobby — « un certain nombre de personnages chacun »). */
export function netAssign(get: Get, set: Set, heroId: string, seat: number): void {
  if (get().net.mode !== 'host') return;
  set({ net: { ...get().net, ownership: { ...get().net.ownership, [heroId]: seat } } });
}

/** Quitte la session (les deux rôles) — retour au mode local, actions restaurées. */
export function netLeave(get: Get, set: Set): void {
  unsubscribe?.();
  unsubscribe = null;
  if (broadcastTimer != null) { window.clearTimeout(broadcastTimer); broadcastTimer = null; }
  host?.close();
  host = null;
  guest?.close();
  guest = null;
  for (const { pc } of pendingInvites.values()) pc.close();
  pendingInvites.clear();
  restoreGuestActions();
  set({ net: initialNet() });
}

/** Le siège LOCAL possède-t-il ce combattant ? (gating d'affichage P2 — vrai en solo/hôte par défaut.) */
export function ownsLocally(state: GameState, combatantId: string | undefined): boolean {
  const { mode, mySeat, ownership } = state.net;
  if (mode === 'local') return true;
  if (!combatantId) return mode === 'host';
  return (ownership[combatantId] ?? 0) === mySeat;
}
