/**
 * Durable Object « Room » — UN par partie coop. Pur RELAIS : il route des enveloppes JSON
 * entre l'hôte et les sièges sans jamais lire le contenu de jeu (champs data/z opaques).
 * Hibernation API : ne consomme de la durée que pendant le routage. TTL par alarme.
 *
 * Enveloppes (spec §3) :
 *   invité → DO : { data?, z? } | { ctl: 'bye' }
 *   DO → hôte   : { from, data?, z? } | { evt: 'join'|'resume', seat, name } | { evt: 'gone', seat }
 *   hôte → DO   : { to: seat, data?, z? } | { ctl: 'bye' }
 *   DO → invité : { evt: 'seated', seat, token } | { evt: 'host-down'|'host-up' } | { data?, z? }
 * Liveness : frame texte littérale 'ping' → auto-réponse 'pong' (sans réveiller le DO).
 */
import { joinGuest, makeToken, resumeGuest, type RoomData } from './roomLogic';
import { secureRandom } from './rand';

const TTL_MS = 30 * 60_000;

type Attachment = { role: 'host' } | { role: 'guest'; seat: number };

export class Room {
  constructor(private readonly state: DurableObjectState) {}

  private async room(): Promise<RoomData | null> {
    return ((await this.state.storage.get('room')) as RoomData | undefined) ?? null;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/init') {
      if (await this.room()) return new Response('exists', { status: 409 });
      const hostToken = makeToken(secureRandom);
      await this.state.storage.put('room', { hostToken, seats: [] } satisfies RoomData);
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return Response.json({ hostToken });
    }
    if (req.headers.get('Upgrade') === 'websocket') return this.upgrade(url);
    return new Response('not found', { status: 404 });
  }

  /** Refus PROPRE : accepter le WS puis fermer avec un code 4xxx lisible côté client
   *  (un refus HTTP serait un onclose 1006 indistinguable d'une panne réseau). */
  private refuse(code: number, reason: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async upgrade(url: URL): Promise<Response> {
    const room = await this.room();
    if (!room) return this.refuse(4404, 'Partie inconnue ou expirée.');
    const role = url.searchParams.get('role');
    const token = url.searchParams.get('token') ?? '';
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (role === 'host') {
      if (token !== room.hostToken) return this.refuse(4403, 'Token hôte invalide.');
      for (const ws of this.state.getWebSockets('host')) ws.close(4001, 'remplacé');
      this.state.acceptWebSocket(server, ['host']);
      server.serializeAttachment({ role: 'host' } satisfies Attachment);
      this.broadcastGuests({ evt: 'host-up' });
      // Reprise d'hôte : lui re-signaler les sièges encore connectés.
      for (const s of room.seats) {
        if (this.guestSocket(s.seat)) server.send(JSON.stringify({ evt: 'resume', seat: s.seat, name: s.name }));
      }
    } else {
      let info = token ? resumeGuest(room, token) : null;
      const isResume = info != null;
      if (!info) {
        info = joinGuest(room, url.searchParams.get('name') ?? '', secureRandom);
        if (!info) return this.refuse(4409, 'Partie pleine.');
        await this.state.storage.put('room', room);
      }
      for (const ws of this.state.getWebSockets(`seat-${info.seat}`)) ws.close(4001, 'remplacé');
      this.state.acceptWebSocket(server, [`seat-${info.seat}`]);
      server.serializeAttachment({ role: 'guest', seat: info.seat } satisfies Attachment);
      server.send(JSON.stringify({ evt: 'seated', seat: info.seat, token: info.token }));
      this.hostSocket()?.send(JSON.stringify({ evt: isResume ? 'resume' : 'join', seat: info.seat, name: info.name }));
      if (!this.hostSocket()) server.send(JSON.stringify({ evt: 'host-down' }));
    }
    await this.state.storage.setAlarm(Date.now() + TTL_MS); // activité → TTL repoussé
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    if (typeof message !== 'string') return;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    let env: Record<string, unknown>;
    try {
      env = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    if (att.role === 'host') {
      if (env.ctl === 'bye') {
        this.closeAll(4000, 'Partie fermée par l’hôte.');
        await this.state.storage.deleteAll();
        return;
      }
      if (typeof env.to !== 'number') return;
      this.guestSocket(env.to)?.send(JSON.stringify({ data: env.data, z: env.z }));
      return;
    }
    // invité
    if (env.ctl === 'bye') {
      const room = await this.room();
      if (room) {
        room.seats = room.seats.filter((s) => s.seat !== att.seat); // siège libéré pour de bon
        await this.state.storage.put('room', room);
      }
      ws.close(1000, 'bye');
      return;
    }
    this.hostSocket()?.send(JSON.stringify({ from: att.seat, data: env.data, z: env.z }));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    // Un WS « remplacé » (reprise) ferme APRÈS l'arrivée du nouveau : ne signaler l'absence
    // que s'il ne reste AUCUNE AUTRE connexion pour ce rôle/siège (sinon faux `gone` → fausse
    // grace). Le socket en train de se fermer est encore listé par getWebSockets : l'exclure.
    if (att?.role === 'host') {
      if (!this.hostSocket(ws)) this.broadcastGuests({ evt: 'host-down' });
    } else if (att?.role === 'guest') {
      if (!this.guestSocket(att.seat, ws)) this.hostSocket()?.send(JSON.stringify({ evt: 'gone', seat: att.seat }));
    }
  }

  async alarm(): Promise<void> {
    if (this.state.getWebSockets().length > 0) {
      await this.state.storage.setAlarm(Date.now() + TTL_MS);
      return;
    }
    this.closeAll(4000, 'Partie expirée.');
    await this.state.storage.deleteAll();
  }

  private hostSocket(except?: WebSocket): WebSocket | null {
    return this.state.getWebSockets('host').find((w) => w !== except) ?? null;
  }
  private guestSocket(seat: number, except?: WebSocket): WebSocket | null {
    return this.state.getWebSockets(`seat-${seat}`).find((w) => w !== except) ?? null;
  }
  private broadcastGuests(env: unknown): void {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.role === 'guest') ws.send(JSON.stringify(env));
    }
  }
  private closeAll(code: number, reason: string): void {
    for (const ws of this.state.getWebSockets()) ws.close(code, reason);
  }
}
