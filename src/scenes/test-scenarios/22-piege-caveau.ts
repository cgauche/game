import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import { flowFromEffects, testFlow, type Condition } from '../../state/flow';
import type { Terrain } from '../../state/scene';
import type { TestScenario } from './_shared';

/**
 * « Le Caveau piégé » — VITRINE du système Flow + Condition en DONNÉES pures (zéro code applicatif).
 * Démontre l'authoring complet d'un piège dans l'éditeur :
 *  - INTERACTIONS : un levier et une clé (props `interact`) posent des flags ;
 *  - CONDITION composée (ET / OU / NON) : la herse du trésor s'ouvre si l'on a la CLÉ **ou** tiré le
 *    LEVIER, **et** seulement si l'ALARME n'a pas retenti — impossible à exprimer avant `ConditionEditor` ;
 *  - TEST à branches : une dalle piégée déclenche un Test d'Athlétisme (réussite = esquive ; échec =
 *    piques [dégâts + À Terre] ET déclenchement de l'alarme, qui referme la herse).
 * Tout est un document `Scene` : reproductible et éditable dans l'éditeur (triggers/interact/conditions).
 */
const W = 14, H = 10;
const scene = arena({ id: 'test-piege-caveau', nom: 'Le Caveau piégé', w: W, h: H, terrain: 'pierre', heroStart: { x: 2, y: 5 } });
scene.ambiance = 'interieur';
scene.startMessage =
  'Un caveau humide. Au fond, une herse close protège un coffre. Un levier rouillé, une dalle suspecte au sol… et quelque part, une clé.';

// Murs périmétriques + un renfoncement (le « trésor ») fermé par la herse à droite.
const tiles = scene.levels[0].tiles as Terrain[];
const set = (x: number, y: number, t: Terrain) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t; };
for (let x = 0; x < W; x++) { set(x, 0, 'mur'); set(x, H - 1, 'mur'); }
for (let y = 0; y < H; y++) { set(0, y, 'mur'); set(W - 1, y, 'mur'); }
for (let y = 1; y < H - 1; y++) if (y !== 5) set(10, y, 'mur'); // cloison du trésor, trouée en (10,5) = la herse

// La herse du trésor : ouverte si (on TIENT la clé OU on a tiré le levier) ET NON alarme — composition
// ET/OU/NON + lecture de l'inventaire VIVANT (`hasItem`), toute authorée dans `ConditionEditor`.
const HERSE_WHEN: Condition = {
  kind: 'all',
  of: [
    { kind: 'any', of: [{ kind: 'hasItem', trapping: 'Clé en fer' }, { kind: 'flag', expr: 'levier_tire' }] },
    { kind: 'not', of: { kind: 'flag', expr: 'alarme' } },
  ],
};

scene.entities.push(
  { id: 'levier', kind: 'prop', ref: 'roue-dentee', pos: { x: 2, y: 2 }, label: 'Mécanisme rouillé',
    interact: { flow: flowFromEffects([
      { type: 'setFlag', flag: 'levier_tire' },
      { type: 'journal', text: 'Le mécanisme cède dans un grincement — quelque chose s’ébranle derrière le mur.' },
    ]) } },
  { id: 'cle', kind: 'prop', ref: 'cle', pos: { x: 2, y: 8 }, label: 'Clé en fer, posée là',
    interact: { consume: true, flow: flowFromEffects([
      { type: 'giveTrapping', trapping: 'Clé en fer' },
      { type: 'journal', text: 'Vous empochez la lourde clé en fer.' },
    ]) } },
  { id: 'herse-grille', kind: 'prop', ref: 'grille', pos: { x: 10, y: 5 }, label: 'Herse du trésor' },
  { id: 'tresor', kind: 'prop', ref: 'coffre', pos: { x: 12, y: 5 }, label: 'Coffre du trésor',
    interact: { consume: true, flow: flowFromEffects([
      { type: 'giveMoney', gold: 5 },
      { type: 'giveTrapping', trapping: 'Épée', qualities: ['Précise'], identified: false },
      { type: 'journal', text: 'Le coffre regorge d’or et d’une lame finement ouvragée.' },
    ]) } },
);

scene.triggers.push(
  // Dalle piégée (centre) : Test d'Athlétisme → esquive, sinon piques + À Terre + alarme.
  {
    id: 'dalle-piegee',
    rect: { x: 5, y: 4, w: 2, h: 3 },
    once: true,
    flow: testFlow(
      { skill: 'Athlétisme', difficulty: 'intermediaire', label: 'Esquiver les piques de la dalle' },
      flowFromEffects([{ type: 'journal', text: 'Un déclic — vous vous figez juste à temps, les piques claquent dans le vide.' }]),
      flowFromEffects([
        { type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 5 }, { op: 'condition', name: 'a-terre' }] },
        { type: 'setFlag', flag: 'alarme' },
        { type: 'journal', text: 'Les piques jaillissent ! Dans le fracas, une cloche d’alarme retentit — la herse se verrouille.' },
      ]),
    ),
  },
  // La herse du trésor : franchir (10,5) avec la bonne condition ouvre le passage et récompense.
  {
    id: 'herse',
    rect: { x: 10, y: 5, w: 1, h: 1 },
    when: HERSE_WHEN,
    flow: flowFromEffects([
      { type: 'setFlag', flag: 'herse_ouverte' },
      { type: 'giveXp', amount: 30 },
      { type: 'journal', text: 'La herse coulisse : le trésor est à vous.' },
    ]),
  },
);

export const scenario: TestScenario = {
  id: 'piege-caveau',
  order: 22,
  icon: '🪤',
  title: 'Le Caveau piégé',
  tests: 'Vitrine Flow+Condition : interactions (levier/clé → flags), condition composée (clé OU levier) ET NON alarme pour la herse, dalle piégée = Test d’Athlétisme à branches (esquive / piques + À Terre + alarme).',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};
