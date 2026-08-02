/**
 * Garde STRUCTURELLE de la possession par PORTEUR DU JET (#1005) : pour CHAQUE flux `kind:'mono'` de
 * `FLOW_VERBS` porteur d'un `jetOwner` — énumération de la table, jamais une liste locale —
 *  (a) l'hôte n'accepte ses verbes que du siège qui POSSÈDE le porteur du jet : Sort d'un héros du
 *      siège 1 → seul le siège 1 dépense ; Sort ENNEMI sous siège MJ → seul le siège MJ ;
 *  (b) sans le pending correspondant (fenêtre fermée), personne ne dépense ;
 *  (c) NON-RÉGRESSION : dans le MÊME état, les rangées MULTI de la fenêtre (opposition de cible,
 *      Contre-sort) gardent leur possession PAR PARTICIPANT — le gate du lanceur ne les ferme pas.
 *
 * La chaîne réparée : un Sort ennemi ouvre son étape en `groupOwner` (`combatFlow.openCastCascade`) →
 * `modalArbiter` rend l'owner `'*'` (pour que cible et contre-lanceurs voient la fenêtre) → sans route
 * par porteur, `intentAllowedFor` acceptait `castForceSuccess` de N'IMPORTE quel siège.
 *
 * LIMITE STRUCTURELLE — À LIRE AVANT D'AJOUTER UN `jetOwner` (consigne de design, #1013) : la fixture
 * `state()` ci-dessous POSE le pending d'après la table elle-même (`[jet.pending]:{[jet.field]:…}`).
 * Elle vérifie donc le ROUTAGE (le porteur déclaré gouverne la dépense), jamais que le couple
 * `pending`/`field` décrit la forme RÉELLE de l'état : inverser `defenderId`↔`attackerId` dans
 * `FLOW_VERBS` laisserait cette garde VERTE (mesuré par mutation). Le champ porteur n'est couvert que
 * par des tests de FLUX RÉEL, qui jouent le store et lisent le pending que le moteur produit :
 * `attack-intent-ownership.test.ts` pour `attack`/`defense`, `cast-influence-ownership.test.tsx` pour
 * l'affordance affichée. TOUT flux qui reçoit un `jetOwner` amène le sien (ou une confrontation
 * table⇄forme réelle du pending) — sinon il n'est gardé qu'à moitié. L'INVENTAIRE littéral des intents
 * routés est asserté en clair ci-dessous : une ligne de table qui disparaît sort de la boucle par flux
 * SANS échec de structure (15→11 tests en silence), seule l'assertion nominative la rattrape.
 */
import { describe, it, expect } from 'vitest';
import { FLOW_VERBS, jetOwnedIntents, flowActionName, type JetOwnerRef } from './flowVerbs';
import { intentAllowedFor, seatInfluences } from './netOwnership';
import { COMBAT_INTENTS } from '../net/intents';
import type { GameState } from './store';

type Entry = { kind: 'mono' | 'multi'; verbs: readonly string[]; coop?: boolean; jetOwner?: JetOwnerRef };
const ENTRIES = Object.entries(FLOW_VERBS) as [string, Entry][];
const JET_OWNED = ENTRIES.filter(([, w]) => w.kind === 'mono' && !!w.jetOwner);

const H_HOST = 'h1'; // héros du siège 0 (hôte)
const H_GUEST = 'h2'; // héros du siège 1
const ENEMY = 'e1';

/** Fenêtre du flux `jet` OUVERTE sur `ownerId` (son pending posé selon `jetOwner`), étape de cascade
 *  PARTAGÉE (owner de modale '*'). Le pending est POSÉ PAR LA TABLE : ajouter un `jetOwner` à un flux
 *  l'amène dans la garde sans une ligne de fixture. */
const state = (jet: JetOwnerRef, ownerId: string, over: Partial<GameState> = {}): GameState =>
  ({
    net: { mode: 'host', mySeat: 0, gmSeat: 2, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'MJ' }, ownership: { h2: 1 }, slots: [0, 1, 0, 0] },
    party: [{ id: H_HOST }, { id: H_GUEST }],
    battle: { order: [H_HOST, H_GUEST, ENEMY], turn: 0, combatants: [
      { id: H_HOST, kind: 'hero' }, { id: H_GUEST, kind: 'hero' }, { id: ENEMY, kind: 'enemy' },
    ] },
    pendingCascade: { participants: [{ id: 's0', jet: 'cast', groupOwner: true }], cursor: 0 },
    [jet.pending]: { [jet.field]: ownerId, targetId: H_HOST, spellId: 'drain', result: null },
    ...over,
  }) as unknown as GameState;

const CAST_JET: JetOwnerRef = { pending: 'pendingCast', field: 'casterId' };
const argsOf = (verb: string) => (verb === 'setForcedRoll' ? [42] : []);

describe('#1005 — flux MONO à fenêtre partagée : la dépense suit le PORTEUR du jet', () => {
  it('la table DÉRIVE bien des intents (sinon la garde ci-dessous ne mesure rien)', () => {
    const map = jetOwnedIntents();
    expect(JET_OWNED.map(([k]) => k), 'aucun flux mono ne déclare `jetOwner`').not.toEqual([]);
    expect(map.castForceSuccess, 'la Résilience du lanceur doit être routée par porteur').toEqual(CAST_JET);
    // INVENTAIRE LITTÉRAL : la boucle par flux ci-dessous se contente en silence de ce que la table
    // déclare (une ligne retirée = un flux qui sort de l'itération, sans échec). Cette liste NOMME les
    // intents attendus → toute ligne `jetOwner` disparue (ou ajoutée sans garde de flux réel) est rouge.
    expect(Object.keys(map).sort()).toEqual([
      'attackBonusSL', 'attackDarkPact', 'attackForceSuccess', 'attackReroll', 'attackReverse', 'attackSetForcedRoll',
      'castBonusSL', 'castDarkPact', 'castForceSuccess', 'castReroll', 'castSetForcedRoll',
      'defenseBonusSL', 'defenseDarkPact', 'defenseForceSuccess', 'defenseReroll', 'defenseReverse', 'defenseRoll', 'defenseSetForcedRoll',
    ].sort());
    // …et la dérivation reste FIDÈLE à la table (tout verbe hors `cancel`, rien d'autre).
    const derives = JET_OWNED.flatMap(([p, w]) => w.verbs.filter((v) => v !== 'cancel').map((v) => flowActionName(p, v)));
    expect(Object.keys(map).sort()).toEqual(derives.sort());
  });

  for (const [prefix, w] of JET_OWNED) {
    it(`(a) ${prefix} : lanceur HÉROS — seul le siège qui le possède dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST);
      for (const v of w.verbs) {
        if (v === 'cancel') continue;
        const intent = flowActionName(prefix, v);
        expect(COMBAT_INTENTS.has(intent), `${intent} exposé comme intent invité`).toBe(true);
        expect(intentAllowedFor(s, 1, intent, argsOf(v)), `${intent} siège propriétaire du lanceur`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, argsOf(v)), `${intent} hôte NON propriétaire`).toBe(false);
        expect(intentAllowedFor(s, 2, intent, argsOf(v)), `${intent} siège MJ, lanceur héros d’un autre`).toBe(false);
      }
    });

    it(`(a) ${prefix} : lanceur ENNEMI — seul le siège MJ dépense (jamais les joueurs)`, () => {
      const s = state(w.jetOwner!, ENEMY);
      for (const v of w.verbs) {
        if (v === 'cancel') continue;
        const intent = flowActionName(prefix, v);
        expect(intentAllowedFor(s, 2, intent, argsOf(v)), `${intent} siège MJ (conduit l’ennemi)`).toBe(true);
        expect(intentAllowedFor(s, 0, intent, argsOf(v)), `${intent} hôte : les ressources de l’ennemi ne sont pas les siennes`).toBe(false);
        expect(intentAllowedFor(s, 1, intent, argsOf(v)), `${intent} joueur : dépenserait la Résilience d’un ENNEMI`).toBe(false);
      }
    });

    it(`(d) ${prefix} : lanceur ENNEMI SANS siège MJ — PARITÉ avec l'affichage, l'hôte non plus ne dépense`, () => {
      // Le jet est à l'IA : l'affordance est refusée À TOUS par `seatInfluences`. Une garde routée sur
      // `seatOwns` seul retomberait sur `ownership ?? 0` et AUTORISERAIT l'hôte — l'écran dit non, l'hôte
      // dirait oui.
      const s = state(w.jetOwner!, ENEMY, { net: { mode: 'host', mySeat: 0, gmSeat: null, seatNames: {}, ownership: { h2: 1 }, slots: [0, 1, 0, 0] } } as unknown as Partial<GameState>);
      expect(seatInfluences(s, 0, ENEMY), 'précondition : l’affichage refuse l’ennemi sans MJ').toBe(false);
      for (const v of w.verbs) {
        if (v === 'cancel') continue;
        const intent = flowActionName(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, argsOf(v)), `${intent} siège ${seat}, lanceur à l’IA`).toBe(false);
      }
    });

    it(`(b) ${prefix} : fenêtre FERMÉE (pending absent) — personne ne dépense`, () => {
      const s = state(w.jetOwner!, H_GUEST, { [w.jetOwner!.pending]: null } as unknown as Partial<GameState>);
      for (const v of w.verbs) {
        if (v === 'cancel') continue;
        const intent = flowActionName(prefix, v);
        for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, intent, argsOf(v)), `${intent} siège ${seat}, jet inconnu`).toBe(false);
      }
    });
  }

  it('(c) NON-RÉGRESSION : dans la MÊME fenêtre, opposition et Contre-sort restent possédés PAR PARTICIPANT', () => {
    const s = state(CAST_JET, ENEMY, {
      pendingCounterspell: { participants: [{ id: H_GUEST, interactive: true, result: null }] },
      pendingCastOpposition: { kind: 'resist', char: 'force-mentale', participants: [{ id: H_GUEST, interactive: true, result: null }] },
    } as unknown as Partial<GameState>);
    // Le contre-lanceur / la cible du siège 1 jouent LEUR rangée…
    expect(intentAllowedFor(s, 1, 'counterspellRoll', [H_GUEST])).toBe(true);
    expect(intentAllowedFor(s, 1, 'oppositionForceSuccess', [H_GUEST])).toBe(true);
    expect(intentAllowedFor(s, 0, 'counterspellRoll', [H_GUEST]), 'rangée d’un autre siège').toBe(false);
    // …pendant que la rangée du LANCEUR ennemi leur reste fermée.
    expect(intentAllowedFor(s, 1, 'castForceSuccess', []), 'le gate du lanceur ne s’ouvre pas par la fenêtre partagée').toBe(false);
  });

  it('SOLO (siège unique, aucune attribution) : le joueur garde ses propres dépenses', () => {
    const s = state(CAST_JET, H_HOST, { net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 0, 'castForceSuccess', [])).toBe(true);
    expect(intentAllowedFor(s, 0, 'castBonusSL', [])).toBe(true);
  });
});
