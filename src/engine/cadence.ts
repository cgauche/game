/**
 * « Cadence de combat » — lecture typée de la règle optionnelle `combat-cadence` (cf. `policy.ts`).
 *
 * SEULE source de vérité pour le mode d'automatisation : le reste du moteur/store lit `cadence()`,
 * `cadenceAuto()` ou `cadenceAutoCombat()` — jamais `rule('combat-cadence')` à la main ailleurs.
 * Module FEUILLE pur (n'importe que `policy`).
 */
import { rule } from './policy';

export type Cadence = 'manuel' | 'rapide' | 'auto';

/** Mode courant (défaut `'manuel'`). */
export const cadence = (): Cadence => rule('combat-cadence') as Cadence;

/** Rapide OU auto : les jets des héros se lancent + s'appliquent seuls (sans dépense de ressource). */
export const cadenceAuto = (): boolean => cadence() !== 'manuel';

/** Auto-combat seulement : l'IA joue aussi les héros (cible/action/surincantation/défense) et dépense le Destin. */
export const cadenceAutoCombat = (): boolean => cadence() === 'auto';
