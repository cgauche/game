/**
 * LA PORTE DE POSSESSION DE L'UI (#1262 L1) — `ui/ownership` remplace neuf recopies du même prédicat,
 * chacune précédée d'un terme de mode réseau (`net.mode === 'local' || …`, `!online || …`,
 * `online ? … : tout`). Ce test mesure les DEUX choses que la migration affirme :
 *
 *  1. le verdict, aux DEUX modes réseau (solo / coop hôte / coop invité) — la porte DÉLÈGUE au
 *     routage siège→combattant, elle ne re-décide rien ;
 *  2. que le terme retiré était MORT : en solo, `ownsLocal` rend déjà vrai pour TOUT porteur, donc
 *     `mode === 'local' || ownsLocal(…)` ne pouvait changer aucune réponse. L'équivalence est
 *     rejouée site par site sur les TROIS formes qui vivaient dans les fenêtres.
 *
 * Le hook `useOwns` (vue LIVE des 5 fenêtres à rangées) est mesuré sur un rendu RÉEL, pas sur sa
 * définition : c'est lui qui lit l'état frais du store à chaque appel.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGame } from '../state/store';
import type { GameState } from '../state/store';
import { ownsLocal, ownsLocalNet, useOwns, type NetView } from './ownership';

const HEROS = [{ id: 'h1', kind: 'hero' }, { id: 'h2', kind: 'hero' }] as unknown as GameState['party'];

/** État réseau minimal : `h1` non attribué (⇒ hôte, siège 0), `h2` au siège 1. */
const net = (over: Partial<GameState['net']>): GameState['net'] =>
  ({ mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 0, 0, 0], ...over }) as GameState['net'];

const SOLO = net({ mode: 'local' });
const HOTE = net({ mode: 'host', mySeat: 0 });
const INVITE = net({ mode: 'guest', mySeat: 1 });

const snapshot = { net: useGame.getState().net, party: useGame.getState().party };
afterEach(() => useGame.setState(snapshot));

function pose(n: GameState['net']): GameState {
  useGame.setState({ net: n, party: HEROS });
  return useGame.getState();
}

/** Sonde de RENDU : le hook des fenêtres, monté pour de vrai, interrogé sur chaque porteur. */
function Sonde({ ids }: { ids: readonly string[] }) {
  const owns = useOwns();
  return <>{ids.map((id) => <b key={id}>{`${id}:${owns(id) ? 'oui' : 'non'}`}</b>)}</>;
}
const rendu = (ids: readonly string[]) => renderToStaticMarkup(<Sonde ids={ids} />);

describe('#1262 L1 — la porte de possession de l’UI rend le MÊME verdict que le routage d’état', () => {
  it('SOLO : un seul siège tient tout — y compris un porteur inconnu et l’absence de porteur', () => {
    const s = pose(SOLO);
    expect(ownsLocal(s, 'h1')).toBe(true);
    expect(ownsLocal(s, 'h2')).toBe(true);
    expect(ownsLocal(s, 'inconnu')).toBe(true);
    expect(ownsLocal(s, undefined)).toBe(true);
  });

  it('COOP hôte : ses héros oui, ceux de l’invité NON (le verdict discrimine)', () => {
    const s = pose(HOTE);
    expect(ownsLocal(s, 'h1')).toBe(true);
    expect(ownsLocal(s, 'h2')).toBe(false);
    expect(ownsLocal(s, undefined), 'sans porteur concerné : l’hôte').toBe(true);
  });

  it('COOP invité : le miroir exact — son héros oui, celui de l’hôte non', () => {
    const s = pose(INVITE);
    expect(ownsLocal(s, 'h2')).toBe(true);
    expect(ownsLocal(s, 'h1')).toBe(false);
    expect(ownsLocal(s, undefined), 'sans porteur concerné : l’hôte, pas lui').toBe(false);
  });

  it('le terme retiré était MORT : les TROIS formes migrées rendent le même verdict, aux deux modes', () => {
    for (const n of [SOLO, HOTE, INVITE]) {
      const s = pose(n);
      const online = s.net.mode !== 'local';
      for (const id of ['h1', 'h2']) {
        const porte = ownsLocal(s, id);
        // forme des 5 fenêtres à rangées : `net.mode === 'local' || ownsLocally(…)`
        expect(s.net.mode === 'local' || porte, `mode-local||owns · ${s.net.mode}/${id}`).toBe(porte);
        // forme du repos : `!online || ownsLocally(…)`
        expect(!online || porte, `!online||owns · ${s.net.mode}/${id}`).toBe(porte);
        // forme du butin/victoire : `online ? filtre(ownsLocally) : tout`
        expect(online ? porte : true, `online?filtre:tout · ${s.net.mode}/${id}`).toBe(porte);
      }
    }
  });
});

describe('#1262 L1 — `useOwns` : le prédicat MONTÉ dans une fenêtre (rendu réel)', () => {
  it('SOLO : la fenêtre sert toutes ses rangées', () => {
    pose(SOLO);
    expect(rendu(['h1', 'h2'])).toBe('<b>h1:oui</b><b>h2:oui</b>');
  });

  it('COOP : la fenêtre de l’hôte n’arme QUE ses rangées — celles de l’invité lui restent', () => {
    pose(HOTE);
    expect(rendu(['h1', 'h2'])).toBe('<b>h1:oui</b><b>h2:non</b>');
    pose(INVITE);
    expect(rendu(['h1', 'h2'])).toBe('<b>h1:non</b><b>h2:oui</b>');
  });
});

/**
 * LES DEUX ÉCRANS HORS COMBAT (#1262 L1, solde) — Interlude et écran de Groupe rendent leur état
 * réseau EN PROP (seam SSR, sans store) et REFAISAIENT le prédicat à la main. Ils passent par
 * `ownsLocalNet`. Ce que ce test FIGE, et qui est une MESURE, pas une promesse : le verdict d'un
 * HÉROS est son siège d'attribution — le rôle MJ (`gmSeat`) n'y change RIEN, parce que la branche
 * `gmSeat` de `seatOwns` (netOwnership) ne concerne que les combattants `kind:'enemy'` PRÉSENTS
 * dans `battle`, et qu'il n'y a pas de combat sur ces écrans. La migration est donc une unification
 * de FORME à verdict constant : l'équivalence avec les deux recopies retirées est rejouée ici,
 * siège par siège.
 */
describe('#1262 L1 — `ownsLocalNet` : Interlude / écran de Groupe (état réseau en prop)', () => {
  const vue = (over: Partial<NetView>): NetView => ({ mode: 'host', mySeat: 0, ownership: { h2: 1 }, ...over });

  it('coop : chacun mène SES héros, hôte comme invité', () => {
    expect(ownsLocalNet(vue({ mySeat: 0 }), 'h1')).toBe(true);
    expect(ownsLocalNet(vue({ mySeat: 0 }), 'h2')).toBe(false);
    expect(ownsLocalNet(vue({ mode: 'guest', mySeat: 1 }), 'h2')).toBe(true);
    expect(ownsLocalNet(vue({ mode: 'guest', mySeat: 1 }), 'h1')).toBe(false);
  });

  it('solo : les deux écrans servent tout le groupe', () => {
    expect(ownsLocalNet(vue({ mode: 'local' }), 'h1')).toBe(true);
    expect(ownsLocalNet(vue({ mode: 'local' }), 'h2')).toBe(true);
  });

  it('rôle MJ posé : le verdict d’un HÉROS ne bouge pas (la branche `gmSeat` vise les ennemis EN COMBAT)', () => {
    for (const gmSeat of [0, 1]) {
      expect(ownsLocalNet(vue({ mySeat: 0, gmSeat }), 'h1'), `gmSeat ${gmSeat}`).toBe(true);
      expect(ownsLocalNet(vue({ mySeat: 0, gmSeat }), 'h2'), `gmSeat ${gmSeat}`).toBe(false);
    }
  });

  it('équivalence stricte avec les DEUX recopies retirées, sur toute la matrice mode × héros', () => {
    for (const mode of ['local', 'host', 'guest'] as const) {
      for (const mySeat of [0, 1]) {
        const net = vue({ mode, mySeat });
        const coop = mode !== 'local';
        for (const id of ['h1', 'h2', 'inconnu']) {
          const porte = ownsLocalNet(net, id);
          // `InterludeScreen` : `net.mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat`
          expect(mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat, `interlude · ${mode}/${mySeat}/${id}`).toBe(porte);
          // `PartyScreen` : `!coop || (net.ownership[id] ?? 0) === net.mySeat`
          expect(!coop || (net.ownership[id] ?? 0) === net.mySeat, `groupe · ${mode}/${mySeat}/${id}`).toBe(porte);
        }
      }
    }
  });
});
