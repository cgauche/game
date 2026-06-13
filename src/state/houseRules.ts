/**
 * Règles maison — PERSISTANCE du store de surcharge des règles optionnelles (engine/policy).
 *
 * Le moteur reste pur : c'est la couche state qui lit/écrit le localStorage et pousse les surcharges
 * dans le registre via `loadRuleOverrides`/`setRule`. À appeler une fois au démarrage de l'app
 * (`loadHouseRules`) ; le panneau in-game écrit via `setHouseRule`/`resetHouseRule` (persistance
 * immédiate). Même patron que `projectLibrary` / roster.
 */
import { ruleOverrides, loadRuleOverrides, setRule, resetRule, type RuleValue } from '../engine/policy';

const KEY = 'wfrp4.house-rules.v1';

/** Charge les règles maison persistées vers le registre du moteur (démarrage de l'app). */
export function loadHouseRules(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) loadRuleOverrides(JSON.parse(raw) as Record<string, RuleValue>);
  } catch {
    /* localStorage indisponible ou JSON corrompu : on garde les défauts RAW. */
  }
}

/** Persiste l'état courant des surcharges. */
export function saveHouseRules(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ruleOverrides()));
  } catch {
    /* ignore (mode privé, quota…) */
  }
}

/** Surcharge une règle (depuis le panneau) ET persiste. */
export function setHouseRule(id: string, value: RuleValue): void {
  setRule(id, value);
  saveHouseRules();
}

/** Réinitialise une règle au défaut RAW ET persiste. */
export function resetHouseRule(id: string): void {
  resetRule(id);
  saveHouseRules();
}
