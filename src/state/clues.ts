// Mécanique MAISON du carnet d'enquête (#670) — aucune règle RAW : le livre ne définit aucun
// système de carnet, seulement de la prose d'enquête. `Indice`/`Affaire` (données, `campaignNarratif.ts`)
// restent la SOURCE ; ce module ne porte que l'ÉTAT RUNTIME (quel stade est atteint, statut, épingle).
import type { Indice } from './campaignNarratif';

/** État runtime d'un indice révélé au carnet. Absent de `GameState.clues` = indice CACHÉ. */
export interface ClueState {
  /** id du stade actuellement atteint (dernier révélé). */
  stadeCourant: string;
  /** 'révélé' = piste active ; 'réfuté' = fausse piste (barrée mais RELISIBLE au carnet). */
  statut: 'révélé' | 'réfuté';
  /** Suivi joueur (épingle en tête du carnet). */
  épinglé?: boolean;
  /** Progression : un stade franchi + le gameTime (minutes) où il l'a été. Ordre chronologique. */
  historique: { stade: string; at: number }[];
}

/**
 * Révèle/avance/RÉACTIVE un indice au carnet — résulte TOUJOURS en `statut: 'révélé'` au stade
 * cible (une piste écartée par `discreditClue` redevient active au prochain `revealClue`, même
 * stade). `stade` fourni cible ce stade précis ; omis, cible le PREMIER stade si l'indice est
 * encore absent, sinon le stade courant (ré-affirmation). Seul vrai no-op : indice DÉJÀ révélé au
 * stade cible (rien ne change, y compris l'historique). Renvoie un Record NEUF, jamais de
 * mutation en place.
 */
export function revealClue(
  clues: Record<string, ClueState>,
  indice: Indice,
  now: number,
  stade?: string,
): Record<string, ClueState> {
  const existing = clues[indice.id];
  let target: string;
  if (stade !== undefined) {
    if (!indice.stades.some((s) => s.id === stade)) {
      console.warn(`revealClue : stade « ${stade} » inconnu de l'indice « ${indice.id} ».`);
      return clues;
    }
    target = stade;
  } else if (!existing) {
    target = indice.stades[0].id;
  } else {
    target = existing.stadeCourant;
  }
  const isNewStade = !existing || existing.stadeCourant !== target;
  if (existing && !isNewStade && existing.statut === 'révélé') return clues;
  const historique = isNewStade
    ? [...(existing?.historique ?? []), { stade: target, at: now }]
    : (existing?.historique ?? []);
  return { ...clues, [indice.id]: { stadeCourant: target, statut: 'révélé', épinglé: existing?.épinglé, historique } };
}

/**
 * Écarte un indice comme fausse piste (`statut: 'réfuté'`) — reste consultable au carnet, barré.
 * Absent → créé d'abord révélé à son premier stade (une fausse piste jamais montrée au joueur avant
 * d'être écartée reste relisible), puis réfuté dans le même appel. Idempotent : indice DÉJÀ réfuté →
 * no-op (Record inchangé, pas de journal de bruit côté handler).
 */
export function discreditClue(
  clues: Record<string, ClueState>,
  indice: Indice,
  now: number,
): Record<string, ClueState> {
  const existing = clues[indice.id];
  if (!existing) {
    const premier = indice.stades[0].id;
    return { ...clues, [indice.id]: { stadeCourant: premier, statut: 'réfuté', historique: [{ stade: premier, at: now }] } };
  }
  if (existing.statut === 'réfuté') return clues;
  return { ...clues, [indice.id]: { ...existing, statut: 'réfuté' } };
}

/** Épingle/désépingle un indice PRÉSENT au carnet — no-op si l'indice est encore caché. */
export function togglePin(clues: Record<string, ClueState>, indiceId: string): Record<string, ClueState> {
  const existing = clues[indiceId];
  if (!existing) return clues;
  return { ...clues, [indiceId]: { ...existing, épinglé: !existing.épinglé } };
}
