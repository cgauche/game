/**
 * Session coop (Jalon 7) — modèle HÔTE-AUTORITAIRE sur Transport injecté (DataChannel en prod,
 * FakeTransport en test). L'hôte est le SEUL à exécuter le store : les invités envoient des
 * intents (filtrés par allowlist), l'hôte les rejoue puis diffuse un snapshot d'état complet
 * (mêmes données JSON-sûres que la sauvegarde — cf. spec coop §3).
 *
 * Cette couche ignore TOUT du store : `applyIntent`/`getSnapshot`/`applySnapshot` sont
 * injectés (la couture store arrive avec le lobby, P1) — testable sans réseau ni navigateur.
 */
import type { Transport } from './transport';
import { PROTOCOL_VERSION, parseMessage, serializeMessage, type NetMessage } from './protocol';

export interface Seat {
  seat: number;
  name: string;
  transport: Transport;
}

export class HostSession {
  /** Sièges CONNECTÉS (handshake accompli), indexés par numéro (1..3 — 0 = l'hôte). */
  readonly seats: Record<number, Seat> = {};
  private nextSeat = 1;

  constructor(
    private readonly opts: {
      build: string;
      /** Actions de store qu'un invité a le droit de demander (le reste est ignoré). */
      allow: ReadonlySet<string>;
      applyIntent: (action: string, args: unknown[], seat: number) => void;
      getSnapshot: () => Record<string, unknown>;
      onSeatClosed?: (seat: number) => void;
    },
  ) {}

  /** Branche le transport d'un nouvel invité (avant son hello). Retourne son futur n° de siège. */
  addGuest(transport: Transport): number {
    const seat = this.nextSeat++;
    let joined = false;
    transport.onMessage((raw) => {
      const m = parseMessage(raw);
      if (!m) return;
      if (m.kind === 'hello') {
        if (m.protocol !== PROTOCOL_VERSION) {
          transport.close();
          return;
        }
        this.seats[seat] = { seat, name: m.name, transport };
        joined = true;
        transport.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: this.opts.build, name: 'hôte' }));
        transport.send(serializeMessage({ kind: 'snapshot', data: this.opts.getSnapshot() }));
        return;
      }
      if (!joined) return; // tout sauf hello avant le handshake : ignoré
      if (m.kind === 'intent') {
        if (this.opts.allow.has(m.action)) this.opts.applyIntent(m.action, m.args, seat);
        return;
      }
      if (m.kind === 'bye') transport.close();
    });
    transport.onClose(() => {
      if (this.seats[seat]) {
        delete this.seats[seat];
        this.opts.onSeatClosed?.(seat);
      }
    });
    return seat;
  }

  /** Diffuse l'état autoritaire à tous les sièges connectés. */
  broadcastSnapshot(data: Record<string, unknown>): void {
    const msg = serializeMessage({ kind: 'snapshot', data });
    for (const s of Object.values(this.seats)) s.transport.send(msg);
  }

  send(seat: number, m: NetMessage): void {
    this.seats[seat]?.transport.send(serializeMessage(m));
  }

  close(): void {
    for (const s of Object.values(this.seats)) s.transport.close();
  }
}

export class GuestSession {
  joined = false;
  private transport: Transport | null = null;

  constructor(
    private readonly opts: {
      build: string;
      name: string;
      applySnapshot: (data: Record<string, unknown>) => void;
      onAssign?: (heroId: string, seat: number) => void;
      onClosed?: () => void;
    },
  ) {}

  connect(transport: Transport): void {
    this.transport = transport;
    transport.onMessage((raw) => {
      const m = parseMessage(raw);
      if (!m) return;
      if (m.kind === 'hello') {
        this.joined = true;
        return;
      }
      if (m.kind === 'snapshot') {
        this.opts.applySnapshot(m.data);
        return;
      }
      if (m.kind === 'assign') this.opts.onAssign?.(m.heroId, m.seat);
    });
    transport.onClose(() => {
      this.joined = false;
      this.opts.onClosed?.();
    });
    transport.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: this.opts.build, name: this.opts.name }));
  }

  /** Demande à l'hôte de rejouer une action de store (il filtrera par allowlist). */
  sendIntent(action: string, args: unknown[]): void {
    this.transport?.send(serializeMessage({ kind: 'intent', action, args, seat: 0 }));
  }

  close(): void {
    this.transport?.send(serializeMessage({ kind: 'bye' }));
    this.transport?.close();
  }
}
