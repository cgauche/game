/**
 * Camp & relation entre combattants — SOURCE UNIQUE de la notion de « camp », dérivée du `Combatant.kind`
 * (`hero` = groupe joueur, `npc` = neutre, `enemy` = hostile). Les comparaisons `kind` éparses
 * (psychologie, ciblage, IA) expriment la MÊME idée ; cette brique la nomme une fois pour que la donnée
 * authorée (Condition Flow `relation`) ET le code partagent un seul vocabulaire.
 */
import type { Combatant } from './types';

/** Camp ABSOLU d'un combattant (indépendant d'un observateur). */
export type Camp = 'party' | 'neutral' | 'hostile';
export const campOf = (c: Pick<Combatant, 'kind'>): Camp =>
  c.kind === 'hero' ? 'party' : c.kind === 'npc' ? 'neutral' : 'hostile';

/** Relation RELATIVE de `self` envers `other` : soi-même, allié (même camp) ou adversaire (camp différent). */
export type Relation = 'self' | 'ally' | 'opponent';
export const relationOf = (self: Combatant, other: Combatant): Relation =>
  self.id === other.id ? 'self' : campOf(self) === campOf(other) ? 'ally' : 'opponent';
