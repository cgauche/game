/**
 * CAMPAGNE — L'Ennemi dans l'Ombre (Tome 1), ouverture.
 * Sourcé de « Chapitre 1 : On recherche : aventuriers courageux » :
 * l'auberge-relais « La Diligence » puis l'embuscade des mutants sur la route.
 *
 * Ce document respecte le schéma `Scene` : il est donc ouvrable et modifiable
 * dans l'éditeur de niveau (exigence : tout le contenu de campagne est éditable).
 */
import { Scene, Terrain } from '../state/scene';

const W = 22;
const H = 16;

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };

  // Route est-ouest (la grand-route Middenheim–Altdorf) sur deux rangées.
  for (let x = 0; x < W; x++) {
    set(x, 11, 'route');
    set(x, 12, 'route');
  }

  // Auberge « La Diligence » : un BÂTIMENT (taverne) à façade pleine dont la porte
  // (au sud, en 6,7) ouvre sur la Grande Salle — scène d'intérieur séparée
  // `tome1-auberge-interieur` (Gustav, les clients, l'affiche y vivent). Cf. la
  // feature `buildings` ci-dessous. Sentier d'approche de la porte vers la route :
  for (let y = 8; y <= 10; y++) set(6, y, 'sol');

  // Quelques arbres en lisière (décor / obstacles).
  for (const [x, y] of [[15, 3], [17, 4], [19, 2], [16, 6], [20, 7], [18, 8]] as const) set(x, y, 'bois');

  // Sentier de la porte vers la route.
  for (let y = 9; y <= 10; y++) set(6, y, 'sol');

  return {
    id: 'tome1-intro',
    nom: "La Diligence — L'Ennemi dans l'Ombre",
    description:
      "À deux jours d'Altdorf, votre groupe atteint l'auberge-relais « La Diligence ». " +
      'Parlez à l\'aubergiste, puis reprenez la route — mais le voyage réserve une mauvaise surprise.',
    dimensions: { w: W, h: H },
    ambiance: 'jour',
    buildings: [
      {
        id: 'auberge-diligence',
        type: 'taverne',
        foot: { x: 3, y: 2, w: 7, h: 6 },
        facing: 'S',
        reveal: 'door',
        door: { x: 6, y: 7 },
        interiorScene: 'tome1-auberge-interieur',
        entry: 'entree',
        label: 'La Diligence',
        params: { roofMaterial: 'chaume' },
      },
    ],
    tiles,
    startMessage:
      "Chapitre 1 — Vous approchez de l'auberge-relais « La Diligence », à deux jours d'Altdorf.",
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } },
      {
        id: 'corps',
        kind: 'objet',
        pos: { x: 19, y: 12 },
        label: 'Cadavre près de la diligence',
        loot: ['Lettre scellée de Kastor Lieberung', "Papiers d'identité"],
      },
    ],
    // Gustav et sa salle de bar vivent désormais dans la scène d'intérieur
    // `tome1-auberge-interieur` (dialogue `dlg-gustav` inclus), atteinte par la
    // porte du bâtiment « La Diligence ».
    dialogues: [],
    triggers: [
      {
        id: 'ambush',
        rect: { x: 14, y: 11, w: 6, h: 2 },
        once: true,
        effects: [
          { type: 'journal', text: 'Sur la route, une diligence renversée… et des silhuettes difformes qui se repaissent des restes.' },
          { type: 'startCombat', encounter: 'enc-mutants' },
        ],
      },
      {
        // Transition vers la suite, une fois l'embuscade nettoyée.
        id: 'sortie-est',
        rect: { x: 21, y: 11, w: 1, h: 2 },
        once: true,
        condition: 'mutants_vaincus',
        effects: [
          { type: 'journal', text: 'La route s’enfonce vers Altdorf…' },
          { type: 'transition', scene: 'tome1-route', entry: 'ouest' },
        ],
      },
    ],
    encounters: [
      {
        id: 'enc-mutants',
        enemies: [
          { ref: 'Mutant', pos: { x: 16, y: 11 } },
          { ref: 'Mutant', pos: { x: 18, y: 12 } },
          { ref: 'Mutant', pos: { x: 17, y: 13 } },
        ],
        onVictory: [
          { type: 'setFlag', flag: 'mutants_vaincus' },
          {
            type: 'journal',
            text:
              'Les mutants gisent au sol. Sur une victime, vous trouvez une lettre scellée au nom de Kastor Lieberung — ' +
              'fouillez le cadavre près de la diligence pour la récupérer.',
          },
        ],
      },
    ],
    flags: {},
  };
}

export const tome1Intro: Scene = build();
