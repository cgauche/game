import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayClient, RoomGuest, RoomHost, type SocketLike } from './relay';
import { inflateB64 } from './compress';

class FakeSocket implements SocketLike {
  static last: FakeSocket | null = null;
  sent: string[] = [];
  closedWith: { code?: number } | null = null;
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(d: string): void {
    this.sent.push(d);
  }
  close(code?: number, reason?: string): void {
    this.closedWith = { code };
    this.onclose?.({ code: code ?? 1005, reason: reason ?? '' });
  }
  // helpers de test (côté « serveur ») :
  open(): void {
    this.onopen?.();
  }
  receive(d: string): void {
    this.onmessage?.({ data: d });
  }
  dropFromServer(code = 1006, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

const makeSocket = (url: string) => new FakeSocket(url);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RelayClient (heartbeat + reconnexion)', () => {
  it('ping toutes les 10 s ; silence > 25 s → fermeture puis reconnexion à backoff', () => {
    const states: string[] = [];
    new RelayClient({ url: () => 'ws://x/room/ABC234?role=host&token=T', makeSocket, onEnvelope: () => {}, onState: (s) => states.push(s) });
    const first = FakeSocket.last!;
    first.open();
    vi.advanceTimersByTime(10_000);
    expect(first.sent).toContain('ping');
    first.receive('pong'); // vivant
    vi.advanceTimersByTime(30_000); // plus aucun pong → le client coupe lui-même
    expect(first.closedWith).not.toBeNull();
    expect(states).toContain('reconnecting');
    vi.advanceTimersByTime(1_000); // 1er retry
    expect(FakeSocket.last).not.toBe(first);
  });

  it('fermeture 4xxx du DO → fatale (raison remontée, AUCUNE reconnexion)', () => {
    const fatal = vi.fn();
    new RelayClient({ url: () => 'ws://x', makeSocket, onEnvelope: () => {}, onFatal: fatal });
    const ws = FakeSocket.last!;
    ws.open();
    ws.dropFromServer(4404, 'Partie inconnue ou expirée.');
    expect(fatal).toHaveBeenCalledWith('Partie inconnue ou expirée.');
    const same = FakeSocket.last;
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.last).toBe(same); // pas de nouvelle socket
  });
});

describe('RoomHost (démultiplexage par siège)', () => {
  it('join/gone remontent ; les enveloppes {from} sont routées au bon Transport virtuel', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    const onJoin = vi.fn();
    rh.onJoin = onJoin;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
    expect(onJoin).toHaveBeenCalledWith(1, 'Anna');
    const t1 = rh.seatTransport(1);
    const got: string[] = [];
    t1.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ from: 1, data: 'BONJOUR' }));
    await rh.idle();
    expect(got).toEqual(['BONJOUR']);
    t1.send('SALUT');
    await rh.idle();
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ to: 1, data: 'SALUT' });
  });

  it('gros payload → champ z compressé, restituable', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const t1 = rh.seatTransport(1);
    const big = JSON.stringify({ blob: 'x'.repeat(5000) });
    t1.send(big);
    await rh.idle();
    const env = JSON.parse(ws.sent.at(-1)!) as { to: number; z?: string; data?: string };
    expect(env.data).toBeUndefined();
    expect(await inflateB64(env.z!)).toBe(big);
  });

  it('closeSeat déclenche le onClose du transport virtuel (fin de grace)', () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    FakeSocket.last!.open();
    const t1 = rh.seatTransport(1);
    const closed = vi.fn();
    t1.onClose(closed);
    rh.closeSeat(1);
    expect(closed).toHaveBeenCalled();
  });
});

describe('RoomGuest (Transport + reprise)', () => {
  it('seated capture siège+token ; reconnexion → URL avec token + onReconnected', () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const first = FakeSocket.last!;
    expect(first.url).toContain('name=Anna');
    const reconnected = vi.fn();
    rg.onReconnected = reconnected;
    first.open();
    first.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK22' }));
    expect(rg.seat).toBe(2);
    first.dropFromServer(1006);
    vi.advanceTimersByTime(1_000);
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    expect(second.url).toContain('token=TOK22'); // reprise, plus de name=
    second.open();
    expect(reconnected).toHaveBeenCalled();
  });

  it('délivre data, et close() envoie ctl bye', async () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const got: string[] = [];
    rg.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ data: 'COUCOU' }));
    await rg.idle();
    expect(got).toEqual(['COUCOU']);
    rg.close();
    expect(ws.sent).toContain(JSON.stringify({ ctl: 'bye' }));
  });
});
