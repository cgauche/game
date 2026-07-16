/**
 * Résolveur de l'Incident de Tir d'Artillerie par Salve (Aux Armes, « Salve », AA 10 l.270-277) —
 * CODE GÉNÉRIQUE lisant la DONNÉE verbatim (`artillery-misfire.json` via `data/artilleryMisfire`).
 * Module FRÈRE de `structureCritical.ts` (même patron : `findTableEntry` pour le lookup, issue
 * STRUCTURÉE et PURE — ne mute rien, l'appelant applique). AA 10 l.264 : « Si l'arme subit un
 * Incident de tir à n'importe quel moment du processus, déterminez-en les effets puis faites un jet
 * dans le tableau suivant » — cette table se tire EN PLUS de l'Incident de tir générique (LDB), et
 * UNIQUEMENT pour une arme à Atout *Salve* (branchement : `state/combatFlow.ts::applyOups`).
 */
import { d10, type RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { ARTILLERY_MISFIRE, type ArtilleryMisfireEntry } from '../data/artilleryMisfire';

export interface ArtillerySalveMisfireResolved {
  entry: ArtilleryMisfireEntry;
  /** id STABLE de l'entrée (slug) — pour toute logique/réf ; `name` reste l'affichage. */
  id: string;
  name: string;
  /** Jet d10 effectif. */
  roll: number;
  /** Nombre de fois où l'effet de Dégâts à l'équipe se répète (0 pour le tir perdu, ligne 10). */
  hits: number;
  /** La pièce d'artillerie est-elle détruite (lignes 1-9) ? */
  destroyed: boolean;
  note: string;
}

/** Résout un Incident de Tir d'Artillerie par Salve (AA 10 l.270-277) : tire le d10 sur
 *  `ARTILLERY_MISFIRE`. `salveRemaining` = Indice de Salve restant au moment de l'Incident (lignes
 *  8-9 et 10, « Pour chaque Indice de Salve restant »). `forcedRoll` = d10 imposé (tests). PUR. */
export function rollArtillerySalveMisfire(salveRemaining: number, rng: RNG = defaultRNG, forcedRoll?: number): ArtillerySalveMisfireResolved {
  const roll = forcedRoll ?? d10(rng);
  const entry = findTableEntry(ARTILLERY_MISFIRE, roll);
  const hits = entry.strayFire ? 0 : entry.perSalveIndex ? Math.max(0, salveRemaining) : 1;
  return { entry, id: entry.id, name: entry.name, roll, hits, destroyed: entry.destroyed, note: entry.note };
}
