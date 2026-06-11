/**
 * Transport coop (Jalon 7) — deux implémentations d'une même interface minuscule :
 *
 * - `RtcTransport` : WebRTC NU (RTCPeerConnection + DataChannel), AUCUNE lib ni broker —
 *   la signalisation passe par les codes copiés/collés de `codes.ts` (arbitrage utilisateur).
 *   On attend la fin du gathering ICE pour émettre UN code complet (pas de trickle : le
 *   copier/coller est un canal à un seul message).
 * - `FakeTransport.pair()` : paire en mémoire pour les tests (P0 — session/intents testables
 *   sans réseau ni navigateur).
 *
 * STUN : simple annuaire d'adresses publiques (aucune donnée de jeu n'y transite) — sans lui,
 * la connexion ne marche qu'en LAN. Constante remplaçable par n'importe quelle URL stun.
 */
export interface Transport {
  send(data: string): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

export const STUN_URLS = ['stun:stun.l.google.com:19302'];

/** Paire de transports en mémoire (tests) : ce que A envoie, B le reçoit, et inversement. */
export class FakeTransport implements Transport {
  private peer: FakeTransport | null = null;
  private msgCb: ((data: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private closed = false;

  static pair(): [FakeTransport, FakeTransport] {
    const a = new FakeTransport();
    const b = new FakeTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(data: string): void {
    if (this.closed || !this.peer) return;
    this.peer.msgCb?.(data);
  }
  onMessage(cb: (data: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.peer?.closeCb?.();
  }
}

/** Attend la fin du gathering ICE (les candidats sont DANS le SDP final — pas de trickle). */
function gatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // garde-fou : certains environnements n'atteignent jamais 'complete' (pas de réseau)
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 3000);
  });
}

/** Côté HÔTE : crée la connexion d'un siège → description d'OFFRE complète (à encoder en code). */
export async function hostCreateOffer(): Promise<{ pc: RTCPeerConnection; channel: RTCDataChannel; offer: RTCSessionDescriptionInit }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URLS }] });
  const channel = pc.createDataChannel('w4', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gatheringComplete(pc);
  return { pc, channel, offer: pc.localDescription!.toJSON() as RTCSessionDescriptionInit };
}

/** Côté INVITÉ : accepte une offre collée → description de RÉPONSE complète (à renvoyer en code). */
export async function guestAcceptOffer(offer: RTCSessionDescriptionInit): Promise<{ pc: RTCPeerConnection; answer: RTCSessionDescriptionInit; channelReady: Promise<RTCDataChannel> }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_URLS }] });
  const channelReady = new Promise<RTCDataChannel>((resolve) => {
    pc.addEventListener('datachannel', (e) => resolve(e.channel));
  });
  await pc.setRemoteDescription(offer);
  await pc.setLocalDescription(await pc.createAnswer());
  await gatheringComplete(pc);
  return { pc, answer: pc.localDescription!.toJSON() as RTCSessionDescriptionInit, channelReady };
}

/** Côté HÔTE : colle la réponse de l'invité → la connexion du siège s'établit. */
export async function hostAcceptAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit): Promise<void> {
  await pc.setRemoteDescription(answer);
}

/** Enrobe un DataChannel ouvert en Transport. */
export function channelTransport(channel: RTCDataChannel): Transport {
  return {
    send: (data) => {
      if (channel.readyState === 'open') channel.send(data);
    },
    onMessage: (cb) => {
      channel.onmessage = (e) => cb(String(e.data));
    },
    onClose: (cb) => {
      channel.onclose = () => cb();
    },
    close: () => channel.close(),
  };
}
