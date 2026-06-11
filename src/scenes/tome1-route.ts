/**
 * CAMPAGNE — Tome 1, Chapitre 2 : « Erreur sur la personne » → « Du Sang Sur la Route ».
 * Sourcé de `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/02 - Chapitre 2 - Erreur sur la personne.md`.
 *
 * Deux rencontres distinctes sur LA MÊME carte (le butin/XP est par rencontre et par corps,
 * jamais global à la scène) :
 *   1. Rolf Hurtsis — le mutant solitaire qui charge à la sortie du virage.
 *   2. La bande de Knud Cratinx — 4 brigands mutants + leur chef à l'arbalète, à la diligence renversée.
 * Puis l'arrivée des patrouilleurs routiers (social). Tout est éditable (schéma `Scene`).
 *
 * Statblocks et butin VERBATIM du chapitre (PNJ p.30) — rien d'inventé.
 */
import { Scene, Terrain, CustomStatblock } from '../state/scene';

const W = 28;
const H = 14;

// ── Profils canon (ch.2, « PNJ ») ────────────────────────────────────────────
const ROLF: CustomStatblock = {
  name: 'Rolf Hurtsis',
  char: { M: 4, CC: 32, CT: 25, F: 27, E: 28, I: 40, Ag: 45, Dex: 39, Int: 29, FM: 25, Soc: 0, B: 8 },
  traits: ['Arme (Dague) +4', 'Bestial', 'Mutation (Chair putréfiée)'],
};
// Brigands : profil commun, Blessures restantes et Mutation distinctes (blessés par Kastor).
const brigand = (name: string, B: number): CustomStatblock => ({
  name,
  char: { M: 4, CC: 45, CT: 30, F: 35, E: 35, I: 30, Ag: 40, Dex: 30, Int: 30, FM: 30, Soc: 30, B },
  traits: ['Arme +7', 'Corruption (Mineure)', 'Mutation'],
});
const KNUD: CustomStatblock = {
  name: 'Knud Cratinx',
  char: { M: 4, CC: 36, CT: 43, F: 39, E: 32, I: 35, Ag: 33, Dex: 29, Int: 33, FM: 35, Soc: 30, B: 12 },
  traits: ['À distance (Arbalète) +9 (60)', 'Arme (Épée) +7', 'Corruption (Mineure)', 'Mutation (Écailles épineuses)'],
};

// Textes des documents (handouts), sourcés du chapitre (Document 3 / Document 4).
const HERITAGE =
  "Messires Lock, Stock & Barl, Notaires, Garten Weg, Bögenhafen.\n\n" +
  "Cher Herr Lieberung,\n\nAprès de longues recherches, nous sommes portés à croire que vous êtes le dernier " +
  "parent vivant de feu le baronet Lieberung, d'Ubersreik. Si cela s'avère exact, vous êtes l'unique bénéficiaire " +
  "de ses dernières volontés, ainsi que du titre et de toutes les terres s'y rattachant.\n\nPrésentez-vous à nos " +
  "bureaux avec une déclaration sous serment confirmant votre identité de Kastor Aloysius Lieberung, et nous vous " +
  "remettrons le manoir de Lieberung ainsi que la somme de vingt mille couronnes d'or impériales.\n\n" +
  "Votre dévoué serviteur, Dietrich Barl. — Signé le dixième jour de Nachhexen, 2512 CI.";
const AFFIDAVIT =
  "Nous, soussignés, jurons solennellement que le porteur de ce document se nomme Kastor Aloysius Lieberung.\n\n" +
  "Ingrid Zicherman, prêtresse — Temple de Sigmar, Nuln.\nOskar Helmut, maître de guilde — Guilde des marchands, Nuln.\n" +
  "Sous le regard de Julius Schwungrad, Honorable Société des Avocats, Nuln.";

function build(): Scene {
  const tiles: Terrain[] = new Array(W * H).fill('herbe');
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t;
  };
  // La grand-route Middenheim–Altdorf, est-ouest, sur deux rangées.
  for (let x = 0; x < W; x++) {
    set(x, 6, 'route');
    set(x, 7, 'route');
  }
  // Lisière de forêt (la Drakwald), obstacles épars de part et d'autre.
  for (const [x, y] of [
    [3, 2], [5, 3], [8, 1], [11, 2], [6, 11], [10, 12], [13, 10],
    [16, 2], [19, 1], [22, 3], [24, 2], [17, 11], [21, 12], [25, 11],
  ] as const)
    set(x, y, 'bois');

  return {
    id: 'tome1-route',
    nom: 'Du Sang sur la Route — Chapitre 2',
    description:
      'La grand-route serpente entre les bois sombres de la Drakwald. Deux heures après l\'auberge, ' +
      'à la sortie d\'un virage, une vision d\'horreur attend les voyageurs.',
    dimensions: { w: W, h: H },
    ambiance: 'foret',
    startMessage:
      'Chapitre 2 — Du Sang sur la Route. Une silhouette accroupie se redresse au milieu du chemin, une main tranchée pendant de sa bouche…',
    entryPoints: { ouest: { x: 1, y: 6 } },
    tiles,
    entities: [
      { id: 'start', kind: 'heroStart', pos: { x: 1, y: 6 } },

      // ── Décor d'ambiance au site du massacre (diligence renversée) ──
      { id: 'epave', kind: 'prop', pos: { x: 20, y: 7 }, ref: 'epave-carrosse', label: 'Diligence renversée' },
      { id: 'cheval', kind: 'prop', pos: { x: 19, y: 5 }, ref: 'cheval-mort' },
      { id: 'sang1', kind: 'prop', pos: { x: 18, y: 6 }, ref: 'mare-sang' },
      { id: 'sang2', kind: 'prop', pos: { x: 21, y: 8 }, ref: 'mare-sang' },

      // ── Corps DÉJÀ morts (tués avant l'arrivée du groupe) → cherchables par corps ──
      // Le premier cocher, près de Rolf : tué d'un carreau, porte une chemise de mailles (ch.2).
      {
        id: 'corps-cocher1',
        kind: 'prop',
        ref: 'cadavre',
        pos: { x: 8, y: 8 },
        label: 'Corps du cocher',
        interact: {
          effects: [
            { type: 'journal', text: 'Le cocher des Quatre Saisons, tué d\'un carreau d\'arbalète au cou. Il porte encore sa chemise de mailles à manches.' },
            { type: 'giveTrapping', trapping: 'Chemise de mailles' },
          ],
        },
      },
      // Le second cocher, au massacre : chemise de mailles + tromblon avec ses munitions (ch.2).
      {
        id: 'corps-cocher2',
        kind: 'prop',
        ref: 'cadavre',
        pos: { x: 22, y: 8 },
        label: 'Second cocher',
        interact: {
          effects: [
            { type: 'journal', text: 'Le second cocher gît près de la diligence ; son tromblon repose à côté de lui.' },
            { type: 'giveTrapping', trapping: 'Chemise de mailles' },
            { type: 'giveTrapping', trapping: 'Tromblon' },
          ],
        },
      },
      // Les autres victimes (artisans, initié de Sigmar, ouvrier) : Knud a déjà tout pillé (ch.2).
      {
        id: 'corps-victimes',
        kind: 'prop',
        ref: 'cadavre',
        pos: { x: 19, y: 8 },
        label: 'Victimes de l\'attaque',
        interact: {
          effects: [{ type: 'journal', text: 'Un couple d\'artisans, un initié de Sigmar, un ouvrier. Aucun objet de valeur : Knud a déjà tout ramassé.' }],
        },
      },
      // Kastor Lieberung, à l'écart sous un buisson : LE sosie, et ses deux lettres (ch.2).
      {
        id: 'corps-lieberung',
        kind: 'prop',
        ref: 'cadavre',
        pos: { x: 24, y: 5 },
        label: 'Cadavre sous un buisson',
        interact: {
          effects: [
            { type: 'journal', text: 'Deux carreaux dans le dos. En le retournant, vous le reconnaissez : c\'est le sosie de l\'un de vous ! Un parchemin dépasse de sa veste.' },
            { type: 'document', title: 'Document 3 — L\'héritage', text: HERITAGE },
            { type: 'document', title: 'Document 4 — L\'affidavit', text: AFFIDAVIT },
            { type: 'giveTrapping', trapping: 'Lettre d\'héritage de Kastor Lieberung' },
            { type: 'giveTrapping', trapping: 'Affidavit d\'identité' },
            { type: 'giveXp', amount: 10 }, // « 10 points chacun pour avoir découvert la lettre d'héritage »
            { type: 'setFlag', flag: 'heritage_trouve' },
          ],
        },
      },
    ],

    dialogues: [
      // L'arrivée de la Loi : 5 patrouilleurs menés par Magnus Pflaster (ch.2).
      {
        id: 'dlg-pflaster',
        start: 'p1',
        nodes: [
          {
            id: 'p1',
            speaker: 'Sergent Pflaster',
            text: 'Cinq cavaliers galopent jusqu\'à vous. « Halte ! Vous ressemblez fort à des bandits. Qu\'est-il arrivé ici ? »',
            choices: [
              {
                text: 'Expliquer poliment l\'attaque des mutants',
                effects: [
                  { type: 'journal', text: 'Les patrouilleurs vous croient et prennent les choses en main. « C\'était votre jumeau ? Désolé, mon gars. »' },
                  { type: 'giveXp', amount: 5 }, // « 5 points pour ne pas avoir éveillé les soupçons »
                  { type: 'setFlag', flag: 'patrouilleurs_ok' },
                  { type: 'endDialogue' },
                ],
              },
              {
                text: 'Les défier',
                effects: [
                  { type: 'journal', text: 'Insultés, les patrouilleurs vous arrêtent et vous emmènent à l\'auberge-relais pour un interrogatoire serré.' },
                  { type: 'setFlag', flag: 'patrouilleurs_ok' },
                  { type: 'endDialogue' },
                ],
              },
            ],
          },
        ],
      },
    ],

    triggers: [
      // 1) Rolf charge à la sortie du virage.
      {
        id: 't-rolf',
        rect: { x: 4, y: 5, w: 4, h: 4 },
        once: true,
        effects: [
          { type: 'journal', text: 'La créature recrache son repas — une main tranchée — et se rue sur vous, dague ensanglantée au poing.' },
          { type: 'startCombat', encounter: 'enc-rolf' },
        ],
      },
      // 2) Plus loin, hurlements et craquements : la bande de Knud au site du massacre.
      {
        id: 't-bande',
        rect: { x: 13, y: 4, w: 6, h: 5 },
        once: true,
        condition: 'rolf_vaincu',
        effects: [
          { type: 'journal', text: 'Une diligence renversée gît au milieu de la route, entourée de corps. Des mutants s\'acharnent — l\'un dévore un cadavre, un autre, écailleux, fouille les corps : Knud Cratinx, leur chef.' },
          { type: 'startCombat', encounter: 'enc-bande' },
        ],
      },
      // 3) L'arrivée de la Loi, une fois la bande défaite.
      {
        id: 't-loi',
        rect: { x: 16, y: 5, w: 8, h: 4 },
        once: true,
        condition: 'bande_vaincue',
        effects: [{ type: 'startDialogue', dialogue: 'dlg-pflaster' }],
      },
      // 4) Sortie est → fin du chapitre (la suite reprend vers Altdorf).
      {
        id: 't-sortie-est',
        rect: { x: 27, y: 6, w: 1, h: 2 },
        once: true,
        condition: 'bande_vaincue',
        effects: [
          { type: 'journal', text: 'Le cortège reprend la route vers la dernière auberge avant Altdorf, l\'Auberge des Sept Rayons.' },
          { type: 'setFlag', flag: 'ch2_termine' },
        ],
      },
    ],

    encounters: [
      // Rencontre 1 : Rolf seul. « 10 points pour avoir vaincu Rolf Hurtsis ».
      {
        id: 'enc-rolf',
        enemies: [{ statblock: ROLF, pos: { x: 6, y: 6 }, appearance: { monster: {} } }],
        onVictory: [
          { type: 'setFlag', flag: 'rolf_vaincu' },
          { type: 'giveXp', amount: 10 },
          { type: 'journal', text: 'Le mutant s\'effondre. Sous la chair pourrie, un visage presque familier… (cherchez les corps alentour).' },
        ],
      },
      // Rencontre 2 : les 4 brigands + Knud. « 20 points chacun pour avoir vaincu les mutants ».
      // Butin du chef (vivant jusqu'ici) remis à la victoire ; les corps déjà morts se fouillent à part.
      {
        id: 'enc-bande',
        enemies: [
          { statblock: brigand('Terenz', 3), pos: { x: 16, y: 6 }, appearance: { monster: { tete: 'minuscule' } } },
          { statblock: brigand('Mikael', 1), pos: { x: 18, y: 5 }, appearance: { monster: { tete: 'chien' } } },
          { statblock: brigand('Johann', 4), pos: { x: 17, y: 8 }, appearance: { monster: { tete: 'ogive' } } },
          { statblock: brigand('Erik', 2), pos: { x: 19, y: 7 }, appearance: { monster: { jambes: 'chevre' } } },
          { statblock: KNUD, pos: { x: 22, y: 6 }, weapon: 'Arbalète', appearance: { monster: { tete: 'lezard' } } },
        ],
        onVictory: [
          { type: 'setFlag', flag: 'bande_vaincue' },
          { type: 'giveXp', amount: 20 },
          // Possessions de Knud (ch.2, p.30) : 2 CO 3/13, un anneau (3 CO), un médaillon d'argent (1 CO).
          { type: 'giveMoney', gold: 2, silver: 3, brass: 13 },
          { type: 'giveTrapping', trapping: 'Anneau (3 CO)' },
          { type: 'giveTrapping', trapping: 'Médaillon en argent' },
          { type: 'journal', text: 'Sur le corps écailleux de Knud : quelques pièces, un anneau et un médaillon d\'argent renfermant le portrait d\'un des artisans morts.' },
        ],
      },
    ],
    flags: {},
  };
}

export const tome1Route: Scene = build();
