/**
 * Protocole coop (Jalon 7) : messages typés sur le DataChannel — hello (version), intent
 * (action d'invité rejouée par l'hôte), snapshot (état autoritaire), assign (propriété d'un
 * héros), bye. `parseMessage` valide la FORME : tout message inconnu/malformé → null (jamais
 * d'exception — le réseau est une entrée non fiable).
 */
import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION, parseMessage, serializeMessage, type NetMessage } from './protocol';

describe('protocole coop (net/protocol)', () => {
  it('round-trip de chaque type de message', () => {
    const msgs: NetMessage[] = [
      { kind: 'hello', protocol: PROTOCOL_VERSION, build: 'dev', name: 'Antoine' },
      { kind: 'intent', action: 'battleEndTurn', args: [], seat: 2 },
      { kind: 'intent', action: 'battleClickEntity', args: ['enemy-1', { confirm: true }], seat: 1 },
      { kind: 'snapshot', data: { gameTime: 42, party: [] } },
      { kind: 'assign', heroId: 'pregen-101', seat: 2 },
      { kind: 'bye' },
    ];
    for (const m of msgs) {
      expect(parseMessage(serializeMessage(m)), m.kind).toEqual(m);
    }
  });

  it('rejette les messages malformés sans lever', () => {
    for (const bad of ['', 'null', '42', '"x"', '{}', '{"kind":"inconnu"}', '{"kind":"intent"}',
      '{"kind":"intent","action":7,"args":[],"seat":1}', '{"kind":"hello","protocol":"x"}',
      '{kind:intent}', '{"kind":"assign","heroId":3,"seat":1}']) {
      expect(parseMessage(bad), bad).toBeNull();
    }
  });

  it('un intent ne transporte que du JSON-sûr (args sérialisables tels quels)', () => {
    const m: NetMessage = { kind: 'intent', action: 'x', args: [1, 'a', null, { y: [true] }], seat: 3 };
    expect(parseMessage(serializeMessage(m))).toEqual(m);
  });
});
