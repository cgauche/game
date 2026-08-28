/**
 * Schéma de `peripeties.json` — Table des Péripéties de voyage (1d10, `Source/…/51 - Magie du
 * Chaos.md` l.210-221 — le fichier mélange 2 chapitres réels du LDB post-ré-extraction Marker, cette
 * table appartient au conseil MJ « Voyage », pas aux sorts du Chaos, #309 phase 3), miroir strict de
 * `Peripetie` (`src/data/peripeties.ts`). 10 entrées, une par face du d10.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'peripeties.json';
export const famille = 'entite';

const doc = document(
  'peripeties',
  famille,
  {
    roll: z.number(),
    /** Ce que le MOTEUR sait jouer sans rien inventer (cf. `src/data/peripeties.ts`). */
    kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),
  },
  {
    roll: { label: 'Face du dé', hint: 'Valeur du d10 qui déclenche cette Péripétie' },
    kind: { label: 'Nature de la Péripétie', hint: 'Ce que le moteur sait jouer sans rien inventer' },
  },
  {
    codex: { keys: ['peripeties'] },
    edit: { dataset: 'peripeties' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;
