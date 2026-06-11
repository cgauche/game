/**
 * Codes de signalisation coop (Jalon 7 — arbitrage « un code à partager, zéro système externe ») :
 * l'offre/réponse WebRTC voyage en code texte copiable (JSON → deflate → base64url, préfixe
 * versionné `W4C1.`). Round-trip exact, rejet propre de tout code invalide/trafiqué.
 */
import { describe, it, expect } from 'vitest';
import { encodeSignal, decodeSignal, CODE_PREFIX } from './codes';

const FAKE_SDP = {
  type: 'offer',
  sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\n'
    + 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:abcd\r\n'
    + 'a=ice-pwd:efghijklmnopqrstuvwxyz123456\r\na=fingerprint:sha-256 '
    + 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r\n',
};

describe('codes de signalisation (net/codes)', () => {
  it('round-trip : encode → décode restitue le payload exact', async () => {
    const code = await encodeSignal(FAKE_SDP);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    const back = await decodeSignal(code);
    expect(back).toEqual(FAKE_SDP);
  });

  it('le code est du texte copiable (base64url : pas de +, /, =, espace, retour ligne)', async () => {
    const code = await encodeSignal(FAKE_SDP);
    expect(code.slice(CODE_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresse réellement un SDP (code plus court que le JSON brut)', async () => {
    const code = await encodeSignal(FAKE_SDP);
    expect(code.length).toBeLessThan(JSON.stringify(FAKE_SDP).length);
  });

  it('tolère les espaces/retours à la ligne autour du code collé', async () => {
    const code = await encodeSignal(FAKE_SDP);
    expect(await decodeSignal(`  ${code}\n`)).toEqual(FAKE_SDP);
  });

  it('rejette : mauvais préfixe, base64 trafiquée, déflate corrompu, vide', async () => {
    const code = await encodeSignal(FAKE_SDP);
    expect(await decodeSignal('W9Z9.' + code.slice(CODE_PREFIX.length))).toBeNull();
    expect(await decodeSignal(CODE_PREFIX + 'pas-du-deflate!!')).toBeNull();
    expect(await decodeSignal(CODE_PREFIX + 'AAAAAAAA')).toBeNull();
    expect(await decodeSignal('')).toBeNull();
    expect(await decodeSignal('coucou')).toBeNull();
  });
});
