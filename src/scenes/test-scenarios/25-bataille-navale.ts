import { makePregens } from '../../data/pregens';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import type { Combatant } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/** Arme un héros d'un pierrier (canon léger de pont, MDG ch.12) + munitions, chargé pour le 1er tir. */
function armGunner(h: Combatant): Combatant {
  const gun = itemFromTrappingById('pierrier')!;
  gun.equipped = true;
  const ammo = itemFromTrappingById('balles-et-poudre-pierrier')!;
  ammo.qty = 10; // de quoi bombarder plusieurs Rounds (Recharge 4 entre chaque tir)
  h.items = [gun, ammo, ...(h.items ?? [])];
  h.loadouts = undefined; h.activeLoadoutId = undefined; // inventaire changé → recompute régénère le loadout
  recomputeLoadout(h);
  // Le loadout auto-généré tient l'arme de mêlée d'origine ; on impose le pierrier comme arme active (le
  // héros garde ses armes de mêlée en inventaire pour basculer de loadout et aborder).
  const loadouts = (h as Combatant).loadouts; // recomputeLoadout a repeuplé h.loadouts (TS l'avait narrowé à undefined)
  const lo = loadouts?.find((l) => l.id === h.activeLoadoutId) ?? loadouts?.[0];
  if (lo) { lo.main = gun.uid; lo.off = undefined; }
  recomputeLoadout(h);
  h.loaded = true; // chargé d'emblée → tir possible dès le 1er Round
  return h;
}

/** 2 canonniers (pierrier) + 2 abordeurs (armes de mêlée d'origine). */
function makeNavalParty(): Combatant[] {
  const party = makePregens().slice(0, 4);
  armGunner(party[0]);
  armGunner(party[1]);
  return party;
}

// Bataille navale (MDG ch.13-14) — vitrine de la chaîne navale COMPLÈTE, jouable :
//  - le NAVIRE ennemi (cogue, coque E45/B50, gréement Voile) est un Combattant à PV : on le bombarde
//    comme on frappe un ennemi ; un Coup Critique se résout sur les tables de NAVIRE (localisation par
//    gréement → Coque/Gréement/Avirons/Cargaison/Équipage) et pose des États NAVALS (Voie d'eau / En
//    flammes) qui le font couler ou brûler au fil des Rounds (endOfRound commun) ;
//  - l'ÉQUIPAGE exposé (pirates sur le pont) est LIÉ à la coque (`crewIds`) : un Critique « Équipage »
//    ou des Éclats reviennent à de VRAIS marins (Critique de personnage / 9 Dégâts).
const scene = arena({ id: 'test-bataille-navale', nom: 'Bataille navale', w: 18, h: 12, terrain: 'planches', heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Bataille navale (MDG) : tes 2 canonniers ont un pierrier (canon de pont) — bombardez la cogue ! C’est une COQUE à PV ; un Coup Critique se résout sur les tables de NAVIRE (Voie d’eau / En flammes selon la localisation par gréement). Les pirates sur le pont sont l’ÉQUIPAGE exposé : un critique « Équipage » ou les Éclats leur reviennent.';

setEncounters(scene, [
  {
    id: 'enc-naval',
    enemies: [
      // index 0 = la coque ; son équipage exposé = les pirates (index 1-3), ids déterministes `enemy-<enc>-<i>`.
      { ref: 'cogue', pos: { x: 13, y: 6 }, label: 'Cogue pirate',
        crewIds: ['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3'] },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 4 } },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 8 } },
      { ref: 'chef-pirate', pos: { x: 15, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'bataille-navale',
  order: 25,
  icon: '⛵',
  title: 'Bataille navale',
  tests: 'Navire-Combattant à PV ; Coup Critique → tables de NAVIRE (localisation par gréement, États Voie d’eau / En flammes, naufrage au fil des Rounds) ; équipage lié (crewIds) → un critique « Équipage » et les Éclats touchent de vrais marins.',
  partyNote: '2 canonniers (pierrier) + 2 abordeurs contre une cogue pirate + son équipage',
  makeParty: makeNavalParty,
  scene,
  autoCombat: 'enc-naval',
};
