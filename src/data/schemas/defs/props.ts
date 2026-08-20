/**
 * Schéma de `props.json` — accessoires de scène : couche sémantique (solidité/opacité/couvert/lumière),
 * EMPREINTE de grille, recette VOLUMIQUE locale et places assises. La FORME vit dans `common.ts`
 * (`propDataSchema` et ses sous-schémas nommés, partagés avec le rapport « consommateurs par champ »),
 * miroir de l'interface `PropData` (`src/data/props.types.ts`).
 */
import { z } from 'zod';
import { propDataSchema } from '../common';

export const file = 'props.json';

export const schema = z.array(propDataSchema);
