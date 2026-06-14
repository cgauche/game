/**
 * Miracles de Ranald (dieu des filous et de la chance) — LDB 42, 6 miracles. Curation B4 :
 * « Que la chance persiste » accorde des Points de Chance (op gainFortune, au-delà du maximum),
 * « Grâce de Ranald » booste l'Agilité ; les énigmes de filou (crochetage, illusions de richesse,
 * passer inaperçu, chat-espion) restent narratives. Aucune op nouvelle.
 */
import { SpellSpec } from '../../engine/spellspec';

export const MIRACLES_RANALD: SpellSpec[] = [
  {
    label: 'Grâce de Ranald',
    // « Votre cible gagne +10 en Agilité, +10 en Discrétion et +1 Talent Souplesse féline. » —
    //   Agilité + Souplesse féline mécaniques ; le +10 en Discrétion (Compétence nommée) reste journalisé.
    ops: [
      { op: 'charMod', char: 'Ag', mod: 10 },
      { op: 'grantTalent', talent: 'Souplesse féline' },
      { op: 'narrative', text: 'Grâce de Ranald : la cible gagne aussi +10 en Discrétion pour la durée — arbitrage MJ.' },
    ],
    durationRounds: { bonusOf: 'Ag' },
    curated: true,
    source: 'LDB 42 — Miracles de Ranald « Grâce de Ranald »',
  },
  {
    label: 'Invitation',
    // « L'un des systèmes de verrouillage d'une porte/fenêtre/trappe cède (+1 par +2 DR). » —
    //   crochetage divin : arbitré.
    ops: [{ op: 'narrative', text: 'Invitation : un système de verrouillage (serrure, loquet, corde) d’une porte/fenêtre/trappe cède, +1 par +2 DR — arbitrage MJ.' }],
    durationRounds: null,
    curated: true,
    source: 'LDB 42 — Miracles de Ranald « Invitation »',
  },
  {
    label: 'Que la chance persiste',
    // « Gagnez +1 Point de Chance (peut dépasser le maximum normal), +1 par +2 DR. Vous ne pouvez
    //   plus invoquer ce Miracle avant d'avoir atteint 0 Point de Chance. » — gainFortune (non
    //   temporaire, au-delà du max) ; le verrou de relance reste journalisé.
    ops: [
      { op: 'gainFortune', amount: 1, perSL: { every: 2, amount: 1 } },
      { op: 'narrative', text: 'Que la chance persiste : vous ne pourrez ré-invoquer ce Miracle qu’une fois revenu à 0 Point de Chance — arbitrage MJ.' },
    ],
    durationRounds: null, // Spécial
    curated: true,
    source: 'LDB 42 — Miracles de Ranald « Que la chance persiste »',
  },
  {
    label: 'Riche, pauvre, mendiant, voleur',
    // « Pour chaque cible, choisissez une illusion (bourse pleine/vide, tenue riche/pauvre, objet de
    //   valeur imperceptible), +1 par +2 DR. » — illusion de richesse : arbitré.
    ops: [{ op: 'narrative', text: 'Riche, pauvre, mendiant, voleur : par cible, une illusion au choix (bourse vide/pleine, tenue misérable/riche, objet de valeur imperceptible), +1 effet par +2 DR — arbitrage MJ.' }],
    durationRounds: null, // « (Bonus de Sociabilité) minutes »
    curated: true,
    source: 'LDB 42 — Miracles de Ranald « Riche, pauvre, mendiant, voleur »',
  },
  {
    label: "Vous ne m'avez pas vu, n'est-ce pas?",
    // « Les cibles passent inaperçues tant qu'elles n'attirent pas l'attention (toucher, attaquer,
    //   appeler, lancer un Sort, faire du bruit). » — discrétion surnaturelle : arbitré.
    ops: [{ op: 'narrative', text: 'Vous ne m’avez pas vu : les cibles passent inaperçues tant qu’elles n’attirent pas l’attention (toucher, attaquer, parler, incanter, faire du bruit) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: "LDB 42 — Miracles de Ranald « Vous ne m'avez pas vu, n'est-ce pas? »",
  },
  {
    label: 'Yeux de chat',
    // « Un chat envoyé divin (invulnérable) ; vous percevez ce qu'il perçoit et dirigez son
    //   Mouvement, mais ne percevez plus par vos sens (vulnérable). » — serviteur divin de
    //   reconnaissance : non modélisé (en attente du moteur d'invocation) : arbitré.
    ops: [{ op: 'narrative', text: 'Yeux de chat : un chat-serviteur invulnérable explore les environs ; vous percevez par ses sens et dirigez ses pas, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ.' }],
    durationRounds: { bonusOf: 'Soc' },
    curated: true,
    source: 'LDB 42 — Miracles de Ranald « Yeux de chat »',
  },
];
