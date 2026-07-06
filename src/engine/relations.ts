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

/** Relation RELATIVE de `a` envers `b` : soi-même, allié (même camp) ou adversaire (camp différent).
 *  Structurel (id + camp) pour être consommable par les vues d'acteur (`ActorView`) comme par les
 *  `Combatant` (via `campOf`). */
export type Relation = 'self' | 'ally' | 'opponent';
export const relationBetween = (a: { id: string; camp: Camp }, b: { id: string; camp: Camp }): Relation =>
  a.id === b.id ? 'self' : a.camp === b.camp ? 'ally' : 'opponent';

/** Ce combattant suit-il les règles de PERSONNAGE (#143) ? — prédicat UNIQUE, DISTINCT du camp
 *  (`campOf`, ci-dessus) et du contrôle (`pilotedByHuman`/`controlsCombatant`, netOwnership.ts).
 *  Gouverne des mécaniques écrites au Personnage dans la source, jamais étendues aux créatures
 *  génériques : Corruption (LDB 19), composant d'incantation (LDB 46 l.107-111), Tests de fin de
 *  combat Maladie/Corruption (LDB 18 l.5, LDB 20 l.14/206). Un héros l'est TOUJOURS ; tout autre
 *  combattant seulement si explicitement flagué en donnée (cf. `Combatant.followsCharacterRules`). */
export const followsCharacterRules = (c: Pick<Combatant, 'kind' | 'followsCharacterRules'>): boolean =>
  c.kind === 'hero' || c.followsCharacterRules === true;
