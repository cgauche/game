/**
 * SUSPENSION d'une SOURCE passive — mécanisme GÉNÉRAL, module FEUILLE (types + durée seuls).
 *
 * Une source (entité Codex : symptôme, État, mutation, trait, objet, talent…) portée par un
 * `ActiveEffect` à durée voit TOUT ce qu'elle émet ignoré tant que l'effet dure : ses `PassiveMod`
 * sont écartés par le collecteur unique (`passiveMods`), donc les États qu'elle porte tombent à la
 * réconciliation (`syncDerivedConditions`) et reviennent d'office à l'expiration (l'effet quitte la
 * liste ; `LDB 16 l.117`).
 *
 * Deux porteurs aujourd'hui, un seul mécanisme : l'op `suppressSymptom` (Racine de terre, `LDB 72
 * l.28`) et la dépense de Détermination sur un État porté (`LDB 17 l.61`, fenêtre `ResolveWindow`).
 *
 * LIMITE MESURÉE : seules les sources qui s'ANNONCENT (`PassiveMod.src`) sont suspendables. Les
 * séquelles, la Faim, la Soif et l'Ivresse émettent SANS `src` (`engine/trauma.ts`) — rien ne les
 * suspend par ce canal.
 */
import type { Combatant, ActiveEffect } from './types';
import type { Duration } from './duration';
import type { CodexTarget } from './ruleRefs';

/** Deux identités Codex désignent-elles la MÊME entité ? (comparaison par ids STABLES). */
export function memeSource(a: CodexTarget | undefined, b: CodexTarget | undefined): boolean {
  return !!a && !!b && a.category === b.category && a.id === b.id;
}

/** La source `src` est-elle SUSPENDUE chez `c` par un effet actif ? */
export function sourceSuspended(c: Combatant, src: CodexTarget | undefined): boolean {
  if (!src) return false;
  return (c.activeEffects ?? []).some((e) => memeSource(e.suppressedSource, src));
}

/** POSEUR UNIQUE de la suspension — miroir de `sourceSuspended`. `effectId` (facultatif) REMPLACE
 *  l'effet de même id : un porteur qui ne doit jamais empiler deux fenêtres concurrentes le nomme. */
export function suspendSource(c: Combatant, src: CodexTarget, duration: Duration, label: string, effectId?: string): void {
  const garde = (c.activeEffects ?? []).filter((e) => !effectId || e.effectId !== effectId);
  const effet: ActiveEffect = { label, bonus: 0, duration, suppressedSource: src, ...(effectId ? { effectId } : {}) };
  c.activeEffects = [...garde, effet];
}
