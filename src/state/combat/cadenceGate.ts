/**
 * Prédicat de cadence partagé (module FEUILLE, sans dépendance d'arène) — extrait de `roundHooks` pour
 * que la brique cadence-aware (`triggeredTest`) le lise sans créer de cycle d'imports avec `roundHooks`.
 */
import { cadenceAuto } from '../../engine/cadence';
import type { Combatant } from '../../engine/types';

/**
 * Un Test de fin de Round de `c` doit-il être une étape de CASCADE influençable (modale) plutôt qu'un
 * jet silencieux résolu dans le hook ? VRAI uniquement pour un HÉROS en cadence MANUELLE — en rapide/auto
 * (`cadenceAuto`), le héros est auto-résolu COMME un monstre → jet silencieux dans le hook (pas de cascade
 * redondante). C'est l'axe RÉEL de l'interactivité (kind × cadence), PAS `kind` seul (un héros auto-piloté
 * n'est pas « interactif »). Une seule source pour tous les hooks d'upkeep + le collecteur de cascade.
 */
export function roundTestInteractive(c: Combatant): boolean {
  return c.kind === 'hero' && !cadenceAuto();
}
