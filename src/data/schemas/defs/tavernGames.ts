/**
 * Schéma de `tavernGames.json` — Jeux de taverne (Nuits agitées & dures journées, ch.16), consommé
 * par `src/engine/tavernGame.ts:44` (type `TavernGame`, 11 entrées réelles). `skill` = `id` de
 * `skills.json` ou `null` (aucune Compétence indiquée → Pari, variante rapide l.11) — string libre
 * car free-form FK non validée ici (grep du JSON : "savoir"/"projectiles"/"pari"/"corps-a-corps").
 * `characteristic` réutilise l'enum `CharKey` du moteur (`src/engine/types.ts:18`). `read` : seule
 * "units-tens" apparaît dans le JSON réel ; "sl" ajouté car explicitement dans le type consommateur
 * (`TavernGame.read`, `src/engine/tavernGame.ts:38`).
 */
import { z } from 'zod';
import { difficultySchema, gameOpSchema, sourceRefSchema } from '../common';

export const file = 'tavernGames.json';

const charKeySchema = z.enum([
  'capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite',
  'intelligence', 'force-mentale', 'sociabilite',
]);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    skill: z.string().nullable(),
    spec: z.string().optional(),
    characteristic: charKeySchema.optional(),
    mode: z.enum(['opposed', 'extended']),
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
    read: z.enum(['sl', 'units-tens']).optional(),
    stake: z.string().optional(),
    source: sourceRefSchema,
  }),
);

export type TavernGamesData = z.infer<typeof schema>;
