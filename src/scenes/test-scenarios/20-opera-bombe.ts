import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import { flowFromEffects, testFlow } from '../../state/flow';
import type { TestScenario } from './_shared';

/**
 * « Une nuit à l'Opéra » — l'antichambre piégée de la loge royale. Compose EN DONNÉES les primitifs
 * livrés : objets d'opéra (props SVG), bombe à retardement (Lot 0 `delayedEffect` armé par un
 * trigger d'entrée), détection facilitée par l'expertise (Lot 1a `easierIf` sur un `test`), souffle
 * (Lot 3 `inflictDamage`/`applyCondition`), désamorçage (cancelFlag). Aucune ligne de code applicatif.
 */
const W = 14, H = 10;
const scene = arena({ id: 'test-opera-bombe', nom: 'Opéra — Antichambre piégée', w: W, h: H, terrain: 'sol', heroStart: { x: 7, y: 8 } });
scene.ambiance = 'interieur';
// Murs périmétriques, entrée ouverte au centre du mur du bas.
const tiles = scene.levels[0].tiles as string[];
for (let x = 0; x < W; x++) { tiles[x] = 'mur'; if (x < 6 || x > 8) tiles[(H - 1) * W + x] = 'mur'; }
for (let y = 0; y < H; y++) { tiles[y * W] = 'mur'; tiles[y * W + (W - 1)] = 'mur'; }

scene.startMessage =
  'Antichambre de la loge royale. Examinez la plante en pot (interagir) pour repérer et neutraliser la bombe AVANT que la mèche ne brûle (avancez le temps). Un héros connaissant la Poudre noire la repère plus facilement.';

scene.entities.push(
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 7, y: 2 } },
  { id: 'balustrade', kind: 'prop', ref: 'balustrade-loge', pos: { x: 7, y: 1 } },
  { id: 'fauteuil-g', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 5, y: 4 } },
  { id: 'fauteuil-d', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 9, y: 4 } },
  { id: 'applique-g', kind: 'prop', ref: 'applique-murale', pos: { x: 2, y: 2 } },
  { id: 'applique-d', kind: 'prop', ref: 'applique-murale', pos: { x: 11, y: 2 } },
  {
    id: 'plante', kind: 'prop', ref: 'plante-pot', pos: { x: 11, y: 6 },
    interact: {
      consume: false,
      flow: testFlow(
        {
          skill: 'Perception',
          difficulty: 'complexe',
          easierIf: { hasSkill: 'Projectiles (Poudre noire)', steps: 1 },
          label: 'Examiner la plante en pot',
        },
        flowFromEffects([
          { type: 'journal', text: 'Sous le feuillage : un pot bourré de poudre noire et une mèche qui se consume ! Vous arrachez le détonateur — la bombe est neutralisée.' },
          { type: 'setFlag', flag: 'bombeDesamorcee' },
        ]),
        flowFromEffects([{ type: 'journal', text: 'La plante en pot semble parfaitement ordinaire.' }]),
      ),
    },
  },
);

scene.triggers.push({
  id: 'armer-bombe',
  rect: { x: 1, y: 6, w: 12, h: 2 },
  once: true,
  flow: flowFromEffects([
    { type: 'journal', text: 'La loge est somptueuse… mais une âcre odeur de poudre flotte dans l’air.' },
    {
      type: 'delayedEffect',
      afterMinutes: 60,
      cancelFlag: 'bombeDesamorcee',
      flow: flowFromEffects([
        { type: 'journal', text: 'UNE EXPLOSION DÉCHIRE L’ANTICHAMBRE !' },
        // Souffle centré sur la plante piégée, assez large pour déchirer toute l'antichambre (RAW :
        // « les parois de la loge, l'antichambre et les loges voisines ») ; dégâts tirés + En flammes.
        { type: 'zoneBlast', center: { x: 11, y: 6 }, radius: 10, damage: '1d10+15', conditions: [{ name: 'en-flammes' }] },
      ]),
    },
  ]),
});

export const scenario: TestScenario = {
  id: 'opera-bombe',
  order: 20,
  icon: '💣',
  title: 'Opéra — Bombe',
  tests: 'Minuterie (delayedEffect) armée par trigger → souffle (inflictDamage + En flammes) au franchissement de l’horloge ; détection (test Perception, −1 cran si Poudre noire) → désamorçage (cancelFlag). Objets d’opéra placés.',
  partyNote: 'Pré-tirés (un héros sait « Projectiles (Poudre noire) »)',
  makeParty: () => {
    const P = makePregens();
    P[0].skills.push({ skillId: 'projectiles', spec: 'Poudre noire', characteristic: 'CT', advances: 15 });
    return P;
  },
  scene,
};
