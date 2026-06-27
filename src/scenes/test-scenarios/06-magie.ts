import { pregenParty, PREGEN } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import { clone, makePriest, makeSorceress, makeFlagellant } from './_casters';
import type { TestScenario } from './_shared';
import type { Combatant } from '../../engine/types';

const scene = arena({ id: 'test-magie', nom: 'Concile & arsenal', w: 30, h: 22, heroStart: { x: 3, y: 11 } });
scene.startMessage =
  'Concile de prêtres (un par dieu à miracles de combat) + Haute Sorcière + flagellant + Tueur. Casters de haut niveau : ' +
  'enchantez, bénissez, invoquez (Réanimation, Hurlement du loup), drainez, AVANT de charger. ⚠ L’Envoûteuse au fond ' +
  'cause Peur 2 + Terreur 2 dès l’ouverture du combat — le concile encaisse aussi un Test de Psychologie.';
// Warband VIVANTE variée en 3 clusters à distances différentes (éprouve la VARIÉTÉ des sorts, le ciblage
// d'AoE NET, la Focalisation des gros sorts, le positionnement) + 1 casteur ennemi au fond (Envoûteuse :
// 12 sorts → l'IA ennemie joue aussi son arsenal). Réfs par ID STABLE (findCreatureById) — un libellé
// ne résoudrait PAS (repli silencieux sur un mannequin B:10).
setEncounters(scene, [
  {
    id: 'enc-magie',
    enemies: [
      // Meute de bêtes (rapides, chargent) — flanc haut.
      { ref: 'loup', pos: { x: 20, y: 7 } },
      { ref: 'loup', pos: { x: 21, y: 8 } },
      { ref: 'sanglier', pos: { x: 22, y: 6 } },
      // Mob peau-verte — centre groupé (cible de choix pour une ZdE bien posée).
      { ref: 'orc', pos: { x: 25, y: 11 } },
      { ref: 'orc', pos: { x: 26, y: 12 } },
      { ref: 'gobelin', pos: { x: 24, y: 13 } },
      { ref: 'gobelin', pos: { x: 25, y: 14 } },
      // Hors-la-loi + bestiaux — flanc bas.
      { ref: 'seigneur-brigand', pos: { x: 23, y: 16 } },
      { ref: 'brigand', pos: { x: 24, y: 17 } },
      { ref: 'ungor', pos: { x: 27, y: 9 } },
      // Casteur ennemi au fond (12 sorts) — l'IA adverse débuffe/contre depuis l'arrière.
      { ref: 'envouteuse', pos: { x: 28, y: 11 } },
    ],
  },
]);

/** Un dieu à miracles de combat → un Prêtre COMPLET (toutes Bénédictions + Miracles, talents de culte). */
const PRIESTS: { id: string; name: string; cult: string; chars: Record<string, number>; pos: { x: number; y: number } }[] = [
  { id: 'pr-sigmar', name: 'Frère Anselm, Grand Prêtre de Sigmar', cult: 'Sigmar', chars: { Soc: 68, FM: 60, F: 45, E: 45 }, pos: { x: 3, y: 4 } },
  { id: 'pr-ulric', name: "Wulfric, Prêtre d'Ulric", cult: 'Ulric', chars: { Soc: 66, FM: 58, F: 48, E: 48 }, pos: { x: 3, y: 8 } },
  { id: 'pr-myrmidia', name: 'Valentina, Prêtresse de Myrmidia', cult: 'Myrmidia', chars: { Soc: 64, FM: 58, F: 44, E: 44 }, pos: { x: 3, y: 12 } },
  { id: 'pr-shallya', name: 'Sœur Helga, Prêtresse de Shallya', cult: 'Shallya', chars: { Soc: 66, FM: 60, F: 38, E: 42 }, pos: { x: 2, y: 16 } },
  { id: 'pr-morr', name: 'Helmut, Prêtre de Morr', cult: 'Morr', chars: { Soc: 62, FM: 60, F: 42, E: 44 }, pos: { x: 2, y: 19 } },
  { id: 'pr-taal', name: 'Gunnar, Prêtre de Taal', cult: 'Taal', chars: { Soc: 62, FM: 56, F: 46, E: 46 }, pos: { x: 4, y: 6 } },
  { id: 'pr-verena', name: 'Adelheid, Prêtresse de Verena', cult: 'Verena', chars: { Soc: 66, FM: 60, F: 40, E: 42 }, pos: { x: 4, y: 10 } },
  { id: 'pr-manann', name: 'Bjorn, Prêtre de Manann', cult: 'Manann', chars: { Soc: 62, FM: 58, F: 46, E: 46 }, pos: { x: 4, y: 14 } },
  { id: 'pr-ranald', name: 'Lukas, Prêtre de Ranald', cult: 'Ranald', chars: { Soc: 66, FM: 56, F: 42, E: 42 }, pos: { x: 4, y: 18 } },
  { id: 'pr-rhya', name: 'Brunhilde, Prêtresse de Rhya', cult: 'Rhya', chars: { Soc: 64, FM: 58, F: 44, E: 46 }, pos: { x: 2, y: 6 } },
];

/**
 * « Concile & arsenal » : Aelindra (Haute Sorcière multi-domaine + Nécromancie) + UN Prêtre COMPLET de
 * chaque dieu à miracles de combat (Sigmar, Ulric, Myrmidia, Shallya, Morr, Taal, Verena, Manann, Ranald,
 * Rhya) + 1 flagellant (prêtre d'Ulric frénétique, grande hache) + Grunni le Tueur. Grand groupe en
 * formation LÂCHE (back-line de casters, flagellant + tueur devant) — éprouve TOUTES les familles de sorts
 * curées et l'IA caster (jouer l'arsenal entier avant d'engager).
 */
function makeMagicParty(): Combatant[] {
  const ans = pregenParty(PREGEN.pretre)[0]; // base prêtre (clonée par makePriest/makeFlagellant)

  const sorc = makeSorceress('sc-elfe', 'Aelindra, Haute Sorcière', { x: 2, y: 11 });
  const priests = PRIESTS.map((p) => {
    const pr = makePriest(ans, p.id, p.name, p.cult, p.chars);
    pr.pos = { ...p.pos };
    return pr;
  });
  // Varie l'apparence des prêtres (sinon clones visuels de la même base) — alterne sexe et carrure.
  priests.forEach((pr, i) => {
    if (!pr.appearance) return;
    pr.appearance.sex = i % 2 ? 'F' : 'M';
    pr.appearance.build = 0.5 + (i % 4) * 0.06;
  });

  const flagellant = makeFlagellant(ans, 'pr-flagellant', 'Konrad le Flagellant', 'Ulric', { Soc: 60, FM: 56, CC: 60, F: 52, E: 50 }, { x: 6, y: 10 });

  const grunni = clone(pregenParty(PREGEN.tueur)[0]);
  grunni.pos = { x: 6, y: 12 };

  return [sorc, ...priests, flagellant, grunni];
}

export const scenario: TestScenario = {
  id: 'magie',
  order: 6,
  icon: '✨',
  title: 'Concile & arsenal',
  tests: 'Concile (1 prêtre/dieu de combat + Sorcière + flagellant) : toutes les familles curées (invocations, drains, enchantements, zones, soins, Corruption), arbitrage IA invoquer/enchanter→Frénésie, Psychologie (Peur/Terreur de l’Envoûteuse), caster ennemi qui débuffe.',
  partyNote: 'Aelindra (Haute Sorcière multi-domaine + Nécromancie) + 10 Prêtres (Sigmar/Ulric/Myrmidia/Shallya/Morr/Taal/Verena/Manann/Ranald/Rhya) + flagellant + Tueur',
  makeParty: makeMagicParty,
  scene,
  autoCombat: 'enc-magie',
};
