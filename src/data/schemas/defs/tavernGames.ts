/**
 * Schéma de `tavernGames.json` — Jeux de taverne (Nuits agitées & dures journées, ch.16), consommé
 * par `src/engine/tavernGame.ts:44` (type `TavernGame`, 13 entrées réelles). `skill` = `id` de
 * `skills.json` ou `null` (aucune Compétence indiquée → Pari, variante rapide l.11) — string libre
 * car free-form FK non validée ici (grep du JSON : "savoir"/"projectiles"/"pari"/"corps-a-corps").
 * `characteristic` réutilise l'enum `CharKey` du moteur (`src/engine/types.ts:18`).
 *
 * `desc` = la règle RECOPIÉE (CLAUDE.md règle 5), Markdown de la source compris. Un paragraphe que
 * l'extraction coupe sur une frontière de page est RECOLLÉ par-dessus son ancre de folio — aucun
 * caractère n'est réécrit (garde : `src/data/tavern-desc-verbatim.test.ts`).
 */
import { z } from 'zod';
import { difficultySchema, gameOpSchema, sourceRefSchema } from '../common';

export const file = 'tavernGames.json';

const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

/** Les effets de LANCER enregistrés (`registerSequenceThrow`, `src/state/sequenceCore.ts`) — ce qui
 *  indexe est le nom d'un EFFET, jamais l'identité d'une entrée de catalogue. */
const throwEffectSchema = z.enum([
  'dr', 'dr-ecrete', 'toute-la-reserve', 'points-de-la-ligne', 'points-de-la-ligne-suivante',
  'chiffres-du-de', 'gain-au-choix', 'aucun-gain', 'termine-le-passage',
]);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    skill: z.string().nullable(),
    spec: z.string().optional(),
    characteristic: charKeySchema.optional(),
    /** RÉGIME RAPIDE (règle optionnelle `tavern-games-rapides`) — le Test qu'il joue pour CETTE
     *  entrée, quand la table veut autre chose que la lettre. DÉFAUT (absent) = `NADJ 16 l.11` mot à
     *  mot : « la Compétence indiquée dans la section "Jeu" […] Si aucune Compétence n'est indiquée
     *  […] Pari ». Une section « Jeu » qui n'indique qu'une CARACTÉRISTIQUE (Bras de fer l.34 : « un
     *  Test opposé étendu de Force ») tombe donc sur Pari par défaut ; jouer la Force à sa place est
     *  une lecture d'ESPRIT — elle s'écrit ICI, en donnée éditable et taguée maison, jamais en
     *  arbitrage de code qui dévierait du verbatim. */
    fastSkill: z.strictObject({
      skill: z.string().optional(),
      spec: z.string().optional(),
      char: charKeySchema.optional(),
      /** Tag MAISON obligatoire : cet override n'est pas dans la source. */
      maison: z.string(),
    }).optional(),
    /** Absent quand le jeu ne se résout pas au Test : l'Al-zahr est un jeu de MISE (`pot`). */
    mode: z.enum(['opposed', 'extended']).optional(),
    target: z.number().optional(),
    drCap: z.number().optional(),
    /** Id du départage d'égalité résolu par le socle de séquence (`units-lowest` Dominos l.107,
     *  `nul` Boules l.57) — consommé par `src/state/sequenceCore.ts` (`resolveSequenceTie`). */
    tieBreak: z.enum(['units-lowest', 'nul']).optional(),
    /** Bonus de Caractéristique ajouté au DR de chaque manche (Bras de fer l.34 : Force) — consommé
     *  par `SequenceParams.drBonus` (`src/state/sequenceCore.ts`). */
    drBonus: charKeySchema.optional(),
    /** Effets PAR MANCHE en `GameOp[]` (Bras de fer l.34-35 : +1 Avantage au vainqueur du tour,
     *  +1 Exténué tous les (Bonus d'Endurance) tours) — `SequenceParams.rounds`. */
    roundOps: z.strictObject({
      winner: z.array(gameOpSchema).optional(),
      attrition: z.array(gameOpSchema).optional(),
      attritionEvery: z.union([z.number(), z.strictObject({ charBonus: charKeySchema })]).optional(),
    }).optional(),
    /** Effectif RAW d'un camp d'un jeu d'ÉQUIPE (Middenball l.119 : 11 par équipe) — le groupe le
     *  complète de figurants (`src/state/tavernFlow.ts`). */
    team: z.strictObject({ size: z.number() }).optional(),
    /** FORME d'un tour (capacité DÉCLARÉE, jamais déduite d'un effectif) : `team` = tous testent et on
     *  somme par équipe (Middenball l.121) ; `thrower` = un tour, un lanceur (Torchon l.111). */
    roundShape: z.enum(['team', 'thrower', 'pot', 'volley']).optional(),
    /** Options de Test d'une manche (Middenball l.121 : Bagarre (+20) OU Athlétisme (+0)) — le choix
     *  va au joueur ; la 1ʳᵉ option est celle que suivent les porteurs sans siège et les figurants. */
    options: z.array(z.strictObject({
      skill: z.string().optional(),
      spec: z.string().optional(),
      char: charKeySchema.optional(),
      difficulty: difficultySchema,
      /** Test de COMBAT : l'Avantage s'y applique (« +10 à un Test de Combat ou de Psychologie
       *  approprié », LDB 14 l.30) — consommé par `src/state/tavernFlow.ts`. */
      combatTest: z.boolean().optional(),
    })).optional(),
    /** Formule de score d'un CAMP (`registerSequenceScore` : `sum` pour une équipe, l.121). */
    campScore: z.enum(['min', 'max', 'sum', 'first']).optional(),
    /** Seuil d'un acquis de manche (Middenball l.121 : but à 25 DR d'équipe). */
    scoreThreshold: z.number().optional(),
    /** Mi-temps (Middenball l.121 : deux mi-temps de trois tours). */
    phases: z.strictObject({ count: z.number(), rounds: z.number() }).optional(),
    /** Effectif du cercle qui esquive (Torchon l.109-111 : 11 danseurs, cible tirée au sort). */
    dancers: z.number().optional(),
    /** Table de score par plage de DR (Torchon l.111) — lue par `findTableEntry` via le socle. */
    table: z.array(z.strictObject({
      min: z.number(), max: z.number(), points: z.number(), label: z.string(),
    })).optional(),
    /** VOLÉE de lancers (famille 7 du socle) : Bête l.42, Arène l.65, Fléchettes l.83, Boules l.57.
     *  `gain`/`critique`/`maladresse`/`depassement` nomment un effet de lancer ENREGISTRÉ
     *  (`registerSequenceThrow`, `src/state/sequenceCore.ts`), jamais un id de jeu. */
    volley: z.strictObject({
      throws: z.number(),
      reserve: z.number().optional(),
      pick: z.enum(['reserve', 'choix']).optional(),
      rows: z.array(z.strictObject({
        min: z.number().optional(),
        max: z.number().optional(),
        difficulty: difficultySchema.optional(),
        points: z.number().optional(),
        label: z.string(),
      })).optional(),
      gain: throwEffectSchema,
      critique: throwEffectSchema.optional(),
      maladresse: throwEffectSchema.optional(),
      depassement: throwEffectSchema.optional(),
      libre: z.strictObject({ min: z.number(), max: z.number() }).optional(),
      exact: z.number().optional(),
      manches: z.number().optional(),
      ordre: z.enum(['declare', 'tirage']).optional(),
      /** Unité de borne de la famille quand la règle ne fixe aucun terme (anti-boucle, pas une règle). */
      manchesBorne: z.number().optional(),
    }).optional(),
    /** TEST COMBINÉ à conséquences distinctes (famille 9 du socle) — Cerevis l.97 : un seul dé, deux
     *  lectures. `tours` est un ARBITRAGE MAISON ÉDITABLE (le RAW ne dit pas quand la partie s'arrête). */
    combined: z.strictObject({
      second: z.strictObject({
        skill: z.string().optional(),
        spec: z.string().optional(),
        char: charKeySchema.optional(),
      }),
      failEvery: z.number().optional(),
      eraseEvery: z.number().optional(),
      ops: z.array(gameOpSchema).optional(),
      markLoser: z.boolean().optional(),
      /** Id d'État (`etats.json`) dont l'apparition arrête la partie (l.88 « rouler sous la table »). */
      stopCondition: z.string().optional(),
      tours: z.number().optional(),
    }).optional(),
    /** Unité de ce que le jeu compte, au pluriel (affichage : « quilles », « points »…). */
    scoreUnit: z.string().optional(),
    /** CAMPS ASYMÉTRIQUES (famille 8 du socle) — Alvatafl l.27-28 : chaque camp convertit son total en
     *  prises sur l'adversaire (`div`), et sa victoire au Critique se lit au dé des unités (`mult`). */
    sides: z.array(z.strictObject({
      id: z.string(),
      label: z.string(),
      pieces: z.number(),
      div: z.number(),
      mult: z.number(),
    })).optional(),
    /** MISE / POT / ABANDON / ÉLIMINATION (Al-zahr l.17) — famille (5) du socle de séquence,
     *  consommée par `SequenceParams.pot` (`src/state/sequenceCore.ts`). `effect` est le nom d'un
     *  effet de pot ENREGISTRÉ (`registerSequencePotEffect`), jamais un id de jeu. */
    pot: z.strictObject({
      dice: z.strictObject({ count: z.number(), faces: z.number() }),
      targetRange: z.strictObject({ min: z.number(), max: z.number() }).optional(),
      manchesPerPlayer: z.number().optional(),
      /** Unité de borne de la famille : tours qu'une manche peut prendre (anti-boucle, pas une règle). */
      roundsPerManche: z.number().optional(),
      rows: z.array(z.strictObject({
        min: z.number(),
        max: z.number(),
        effect: z.enum(['rafle-le-pot', 'reprend-mise', 'cible-ou-passe', 'remise-ou-abandon', 'quitte-la-manche']),
        /** Paramètre de l'effet : combien de mises il déplace (défaut 1). */
        mises: z.number().optional(),
        label: z.string(),
      })),
    }).optional(),
    source: sourceRefSchema,
  }),
);

export type TavernGamesData = z.infer<typeof schema>;
