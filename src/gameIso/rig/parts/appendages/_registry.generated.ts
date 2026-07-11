// GÉNÉRÉ par scripts/gen-registry.mjs — NE PAS ÉDITER À LA MAIN.
// Ajouter une entrée = déposer un fichier dans defs/ puis `npm run gen`.
import type { AppendageDef } from './types';
import { appendage as e0 } from './defs/cornes-caprin';
import { appendage as e1 } from './defs/cornes-demon';
import { appendage as e2 } from './defs/cornes-generique';
import { appendage as e3 } from './defs/cornes-gor';
import { appendage as e4 } from './defs/cornes-taureau';
import { appendage as e5 } from './defs/cornes-vestigiales';
import { appendage as e6 } from './defs/queue-fouet';
import { appendage as e7 } from './defs/queue-generique';
import { appendage as e8 } from './defs/queue-rat';

export const APPENDAGE_DEFS: AppendageDef[] = [e0, e1, e2, e3, e4, e5, e6, e7, e8];

/** Union GÉNÉRÉE des `id` déclarés dans les defs — le typage réel des consommateurs. */
export type AppendageId =
  | 'cornes-caprin'
  | 'cornes-demon'
  | 'cornes-generique'
  | 'cornes-gor'
  | 'cornes-taureau'
  | 'cornes-vestigiales'
  | 'queue-fouet'
  | 'queue-generique'
  | 'queue-rat';
