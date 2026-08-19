/**
 * INTENTION LOCALE — le mode « je choisis mon geste AVANT de cliquer le champ » (spec HUD zone 4).
 *
 * Arbitrage fondateur (utilisateur, 2026-08-16, verbatim) : « Ca ne change pas les actions par défaut
 * sur le grid comme le déplacement/attaque, ou la charge/course, c'est juste pour qu'on les
 * selectionner volontairement depuis l'interface. Car actuellement pour charger, il est difficile de
 * connaitre la distance. » — l'intention n'ouvre AUCUN second chemin de jeu : elle AFFICHE la portée
 * du geste, et le clic qui suit est celui d'avant. Elle se dissout à ce clic (ou à Échap / au re-clic
 * de sa case).
 *
 * COOP : `localIntent` vit à la RACINE du store, HORS `battle` — le mode est LOCAL au client (aucun
 * intent réseau à l'armement, seul le COMMIT du geste part), et `applyHostSnapshot` le préserve
 * (`netFlow.ts`). Les POSTURES, elles, sont du JEU : elles vivent dans `battle`.
 *
 * Chaque action du registre qui arme une intention déclare, en donnée (`intent` de `actions.json`),
 * l'id de la PORTÉE que le champ doit peindre ; le code de cette portée vit ici, jamais en JSON.
 */
import type { Get } from './flowTypes';
import { computeChargeReach, computeRunReach, displayedReach } from './combatFlow';
import { findActionById } from '../data/index';

/** Le mode d'intention ARMÉ (un seul à la fois) : l'id d'action du registre qui l'a posé. */
export interface LocalIntent {
  actionId: string;
}

/** Les PORTÉES affichables, par id (`intent` de `actions.json`) : case → coût, comme toute portée du
 *  moteur. `null` = l'intention n'a pas de bande de cases à peindre (la portée d'ARME se lit aux
 *  bandes de tir existantes, `HighlightsView.rangeBandSource` — jamais une 2ᵉ écriture de la même
 *  vérité). */
export const INTENT_REACH: Record<string, ((get: Get) => Map<string, number>) | null> = {
  'portee-mouvement': displayedReach,
  'portee-course': computeRunReach,
  'portee-charge': computeChargeReach,
  'portee-arme': null,
};

/** Id de PORTÉE de l'intention armée (`intent` de son action), ou `null` — la seule lecture par
 *  laquelle une surface apprend CE QUE le joueur a demandé à voir. */
export function armedIntentPortee(get: Get): string | null {
  const armed = get().localIntent;
  return (armed ? findActionById(armed.actionId)?.intent : undefined) ?? null;
}

/** Bande de cases à peindre pour l'intention ARMÉE — vide si aucune, si l'action ne déclare pas de
 *  portée, ou si sa portée n'a rien à montrer. Source UNIQUE du 3ᵉ `kind` de surbrillance. */
export function intentReach(get: Get): Map<string, number> {
  const portee = armedIntentPortee(get);
  const reach = portee ? INTENT_REACH[portee] : null;
  return reach ? reach(get) : new Map();
}

/** Portée d'ARME : l'intention qui délègue son affichage aux BANDES DE TIR existantes (`rangeBand`),
 *  au lieu d'ouvrir une 2ᵉ écriture de la même vérité. */
export const PORTEE_ARME = 'portee-arme';
