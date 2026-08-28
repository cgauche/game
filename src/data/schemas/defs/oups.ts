/**
 * Schéma de `oups.json` — Maladresses, folio 160 : les 7 bandes du Tableau des Oups !
 * (`LDB 14 l.21-30`) et l'Incident de Tir (`LDB 14 l.32-34`), section DISTINCTE du livre, hors de la
 * table. Ces deux sections du livre partagent ICI un seul dataset ; le découpage côté produit est la
 * question #1544.
 *
 * UNE SEULE FORME D'ENTRÉE, la disjonction portée par un REFINE ⟺ (`affinerEntree`) : `min`/`max` sont
 * déclarés optionnels, et le refine exige les deux sens — un `misfire` ne porte NI l'un NI l'autre, une
 * bande d100 porte les DEUX. Une union de deux `strictObject` dirait la même chose au parse, mais elle
 * n'a ni `.shape` ni enveloppe : `document()` ne saurait y poser ni sa provenance, ni son `type`, ni
 * ses métas d'édition. La contrainte reste au schéma, elle change seulement de porteur.
 *
 * La VUE TS reste l'union manuscrite `OupsRow = OupsEntry | OupsMisfireEntry` (`src/data/oups.ts`) :
 * le handle scelle ses nœuds (`z.infer` vaut `unknown`), aucun type n'est dérivé d'ici. C'est cette
 * union qui donne à `OUPS_TABLE` ses `min`/`max` NON optionnels (lus par `findTableEntry`) et au Codex
 * sa discrimination `'min' in o` (`src/ui/compendium/registry.ts`, bloc `key: 'oups'`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'oups.json';
export const famille = 'entite';

/** Effets mécaniques que le moteur sait jouer (`OupsKind` + `misfire`, `src/engine/oups.ts`). */
const KINDS = [
  'selfWound',
  'weaponDamageActLast',
  'actionPenalty',
  'loseMovement',
  'loseAction',
  'trauma',
  'hitAlly',
  'misfire',
] as const;

const doc = document(
  'oups',
  famille,
  {
    min: z.number().optional(),
    max: z.number().optional(),
    kind: z.enum(KINDS),
  },
  {
    min: { label: 'Borne basse du d100' },
    max: { label: 'Borne haute du d100' },
    kind: { label: 'Effet mécanique', hint: 'misfire = Incident de Tir, HORS table (LDB 14 folio 160)' },
  },
  {
    codex: { keys: ['oups'] },
    edit: { dataset: 'oups' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { kind?: string; min?: number; max?: number };
        const borne = e.min !== undefined || e.max !== undefined;
        if (e.kind === 'misfire' && borne) {
          ctx.addIssue({
            code: 'custom',
            path: ['min'],
            message: "oups : l'Incident de Tir est HORS table (LDB 14 folio 160) — il ne porte NI min NI max.",
          });
        }
        if (e.kind !== 'misfire' && (e.min === undefined || e.max === undefined)) {
          ctx.addIssue({
            code: 'custom',
            path: ['min'],
            message: `oups : une ligne du Tableau des Oups ! est une BANDE d100 — min ET max sont exigés (kind « ${e.kind} »).`,
          });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
