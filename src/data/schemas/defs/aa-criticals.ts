/**
 * Schéma de `aa-criticals.json` — Blessures critiques ALTERNATIVES (Aux Armes), 4 familles
 * (Tête/Bras/Corps/Jambe). Reflet de l'interface `AAEntry` (`src/engine/aaCritical.ts`). Système
 * ALTERNATIF optionnel (policy `combat-aa-blessures=aa`).
 *
 * PROVENANCE : chaque entrée porte son `source: {book:'aux-armes', page}` — folios relevés aux ancres
 * `data-folio` d'AA 07 (83 Tête, 84 Bras, 85 Torse, 86 Jambe), cf.
 * `src/data/aa-criticals-folio.test.ts`.
 *
 * MODÉLISATION (réfs nues) : `blessures` = colonne Blessures (T = triviale, non comptée pour la mort ;
 * nombre = Blessures perdues ; Mort = létal). `ops`/`resist`/`traumas` = corps mécanique immédiat, y
 * compris les sous-effets à durée Rounds (#125), les durées en jours (#153), l'objet lâché (#153) et
 * l'Amputation structurée (#153). La cascade « Aide Médicale → Test étendu de Guérison » (#166) passe
 * par `escalation.medicalAidGate`, l'escalade doigt/pied sans soin (#167) par
 * `escalation.perRound`/`apresDelai`, le Test de Dextérité par action de « Main ensanglantée » (#165)
 * par l'op `handGate`. `desc` = « Effets supplémentaires » VERBATIM.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';
import { gameOpSchema } from '../grammaire/mecanique';
import { critEscalationSchema, amputationSchema } from './criticals';

export const file = 'aa-criticals.json';
// Les 4 familles de Localisation sont des CLÉS FIXES du document, donc des CHAMPS : `config`, jamais
// un `record` à clés libres (#1467 L1b V-FLIP-CONFIG).
export const famille = 'config';

const aaEntrySchema = z.strictObject({
  id: z.string(),
  min: z.number(),
  max: z.number(),
  label: z.string(),
  /** Colonne « Blessures » : Blessures supplémentaires perdues (0 = trivial « T », absent = létal). */
  blessures: z.number().optional(),
  trivial: z.boolean().optional(),
  ops: z.array(gameOpSchema).optional(),
  resist: z
    .strictObject({
      difficulty: difficultySchema,
      onFail: z.array(gameOpSchema),
      /** id STABLE `skills.json` — Test conditionnel HORS-Résistance (ex. Athlétisme, l.2609). */
      skill: z.string().optional(),
    })
    .optional(),
  traumas: z.array(z.string()).optional(),
  // Amputation (« voir Amputation p.180 de WFJDR ») — MÊME forme partagée que le chemin LDB (`amputationSchema`) :
  // le vocabulaire `timing`/`loss` vaut pour l'AA (mêmes textes « Une fois la rencontre terminée… »/« un orteil par DR »).
  amputation: amputationSchema.optional(),
  /** Escalade GATÉE par les soins (« Main ouverte » l.2571 / « Pied écrasé » l.2624) — partagée LDB. */
  escalation: critEscalationSchema.optional(),
  lethal: z.boolean().optional(),
  desc: z.string(),
  source: sourceRefSchema,
});

const doc = document(
  'aa-criticals',
  famille,
  {
    tete: z.array(aaEntrySchema),
    bras: z.array(aaEntrySchema),
    corps: z.array(aaEntrySchema),
    jambe: z.array(aaEntrySchema),
  },
  {
    tete: { label: 'Table — Tête (Aux Armes)' },
    bras: { label: 'Table — Bras (Aux Armes)' },
    corps: { label: 'Table — Corps (Aux Armes)' },
    jambe: { label: 'Table — Jambe (Aux Armes)' },
  },
  {
    codex: { keys: ['aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe'] },
    edit: { none: 'édité par TABLEAU NICHÉ : les 4 catégories Codex `aaCriticals*` éditent chacune un champ de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
