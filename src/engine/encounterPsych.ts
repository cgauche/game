/**
 * Psychologie À LA RENCONTRE (hors combat) — cœur pur de la couture C de l'audit « combat-only ».
 *
 * LDB 21-Psychologie : les Tests de Peur/Terreur/Animosité/Préjugé/Phobie se déclenchent « chaque fois
 * que vous rencontrez » le groupe/la source (l.22/50/55), pas seulement au combat — l'exemple canonique
 * d'Animosité (l.16) se passe DANS UNE TAVERNE. Cette fonction évalue, pour un héros, le 1er Test de
 * Psychologie dû lors d'une rencontre avec un ensemble de PNJ présents (scène ou dialogue).
 *
 * Pur et découplé : prend les PNJ déjà décrits en `Combatant` (size, causesPeur/Terreur, groups —
 * dérivés par l'appelant comme au spawn). PAS de Ligne de Vue (une rencontre = une présence, pas une
 * portée tactique). Réutilise exactement les primitives de combat (`fearSourceFor`, `targetedTrigger`)
 * pour rester cohérent avec `collectHeroPsych`. Le branchement (entrée de scène / dialogue → modale
 * `pendingPsych`) vit dans la couche state.
 */
import { Combatant } from './types';
import { fearSourceFor, targetedTrigger, PsychType } from './psychology';

export interface EncounterPsychTrigger {
  kind: PsychType;
  sourceId: string;
  indice: number;
  cible?: string;
}

/** Premier Test de Psychologie dû à `hero` face aux `npcs` présents (Peur/Terreur de Taille ou de
 *  statbloc d'abord, puis Trait ciblé déclenché par un membre du groupe), ou null si aucun. Une source
 *  déjà en `psychState` n'est pas re-déclenchée. Immunité (Psychologie) et Frénésie court-circuitent. */
export function encounterPsych(hero: Combatant, npcs: Combatant[]): EncounterPsychTrigger | null {
  if (hero.psychImmune || hero.frenzied) return null;
  const state = hero.psychState ?? [];
  for (const npc of npcs) {
    const src = fearSourceFor(hero, npc); // Peur/Terreur (Taille LDB 85 + statbloc « Peur N »/« Terreur N »)
    if (src && !state.some((p) => p.sourceId === npc.id)) return { kind: src.kind, sourceId: npc.id, indice: src.indice };
  }
  const tt = targetedTrigger(hero, npcs); // Animosité/Haine/Préjugé/Phobie envers un groupe présent (LDB 21)
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, indice: tt.indice ?? 0, cible: tt.cible };
  return null;
}
