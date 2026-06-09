/**
 * Psychologie À LA RENCONTRE (hors combat) — cœur pur de la couture C de l'audit « combat-only ».
 *
 * Décision de design (2026-06-10, retour playtest) : la **Peur / Terreur** (trait de créature) ne se
 * teste **QU'EN COMBAT**. Hors combat, les créatures croisées sont supposées non hostiles — sinon une
 * simple galerie de monstres (ou un PNJ inoffensif de grande Taille) inonderait le joueur de Tests de
 * Calme. Seuls les **Traits psy CIBLÉS et SOCIAUX** se déclenchent à la rencontre hors combat
 * (Animosité / Haine / Préjugé / Phobie / Amour / Camaraderie) — RAW LDB 21, dont l'exemple canonique
 * (l.16) se passe DANS UNE TAVERNE. Le combat, lui, garde Peur/Terreur (cf. `collectHeroPsych`).
 *
 * Pur et découplé : prend les PNJ déjà décrits en `Combatant` (groups). Immunité (Psychologie) et
 * Frénésie court-circuitent. Le branchement (entrée de scène / dialogue → modale) vit dans la couche state.
 */
import { Combatant } from './types';
import { targetedTrigger, isPsychImmune, PsychType } from './psychology';

export interface EncounterPsychTrigger {
  kind: PsychType;
  sourceId: string;
  indice: number;
  cible?: string;
}

/** Premier Test de Psychologie dû à `hero` face aux `npcs` présents HORS COMBAT, ou null. Peur/Terreur
 *  exclues (combat seulement) ; seul un Trait ciblé déclenché par un membre du groupe présent compte. */
export function encounterPsych(hero: Combatant, npcs: Combatant[]): EncounterPsychTrigger | null {
  if (isPsychImmune(hero)) return null; // immunité (Détermination en combat) / Frénésie → aucun Test
  const tt = targetedTrigger(hero, npcs); // Animosité/Haine/Préjugé/Phobie envers un groupe présent (LDB 21)
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, indice: tt.indice ?? 0, cible: tt.cible };
  return null;
}
