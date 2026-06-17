/**
 * Traits de créature TEMPORISÉS accordés par un sort (Jalon 2.6 — op `grantTrait`) :
 * Envol (Vol), Effrayant (Peur), Terrifiant (Terreur), Protection (9+), Perturbant,
 * Sang corrosif, Vision dans l'obscurité (Infravision), Vaincre les impies (Haine)…
 *
 * Principe : le trait (`TraitInstance` structuré — `{ id:'peur', value:2 }`) est POSÉ dans `c.traits`
 * → tous les consommateurs EXISTANTS (dispatch `engine/traits/`, psychologie, IA, déplacement) le voient
 * comme un trait natif ; il est RETIRÉ (une instance) à l'expiration de l'`ActiveEffect` porteur
 * (`grantedTrait`) — fin de Round (`endOfRound`) OU échéance d'horloge (cascade #T3).
 *
 * Les champs psy dérivés au spawn (`causesPeur`/`causesTerreur`/`psychImmune`/`psychTraits`)
 * sont re-synchronisés : les SCALAIRES sont re-dérivés du parse complet de `c.traits` (ils ne
 * viennent que des traits) ; `psychTraits` est ajusté ADDITIVEMENT (on n'y retire que la
 * contribution du trait accordé) car des entrées peuvent venir d'ailleurs (mutations).
 */
import { Combatant } from './types';
import { parsePsychTraits } from './psychology';
import type { TraitInstance } from './statEntry';

/** Re-dérive les scalaires psy depuis les traits courants (Peur/Terreur/Immunité). */
function resyncPsychScalars(c: Combatant): void {
  const p = parsePsychTraits(c.traits ?? []);
  c.causesPeur = p.causesPeur;
  c.causesTerreur = p.causesTerreur;
  c.psychImmune = p.psychImmune;
}

/** Égalité STRUCTURELLE de deux `TraitInstance` (la même instance accordée doit être retrouvée). */
const sameInstance = (a: TraitInstance, b: TraitInstance): boolean =>
  a.id === b.id && (a.value ?? null) === (b.value ?? null) && (a.arg ?? '') === (b.arg ?? '')
  && (a.count ?? null) === (b.count ?? null) && (a.range ?? null) === (b.range ?? null);

/** Index de la DERNIÈRE occurrence de `t` dans `list` (celle posée par le sort), ou -1. */
const lastIndexOfInstance = (list: TraitInstance[], t: TraitInstance): number => {
  for (let k = list.length - 1; k >= 0; k--) if (sameInstance(list[k], t)) return k;
  return -1;
};

/** Accorde le `TraitInstance` (structuré — `{ id:'vol', value:35 }`, `{ id:'haine', arg:'Morts-vivants' }`) :
 *  posé tel quel, psychologie re-synchronisée. Mute `c`. */
export function grantTrait(c: Combatant, t: TraitInstance): void {
  c.traits = [...(c.traits ?? []), t];
  c.liveTraits = [...(c.liveTraits ?? []), t]; // modificateurs de PROFIL du trait accordé → appliqués en DIRECT (collecteur passif)
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([t]).psychTraits ?? [];
  if (contrib.length) c.psychTraits = [...(c.psychTraits ?? []), ...contrib];
}

/** Retire UNE instance du trait accordé (jamais un natif en double : la dernière occurrence — celle
 *  posée par le sort) et synchronise la psychologie dérivée. Mute `c`. */
export function removeGrantedTrait(c: Combatant, t: TraitInstance): void {
  const i = lastIndexOfInstance(c.traits ?? [], t);
  if (i < 0) return;
  c.traits = [...c.traits!.slice(0, i), ...c.traits!.slice(i + 1)];
  const li = lastIndexOfInstance(c.liveTraits ?? [], t); // retire l'occurrence accordée des modificateurs de profil en direct
  if (li >= 0) c.liveTraits = [...c.liveTraits!.slice(0, li), ...c.liveTraits!.slice(li + 1)];
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([t]).psychTraits ?? [];
  for (const pt of contrib) {
    const j = (c.psychTraits ?? []).findIndex((x) => x.type === pt.type && (x.cible ?? '') === (pt.cible ?? ''));
    if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
  }
  if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
}

/** Retire les traits accordés par les effets actifs EXPIRÉS d'une liste (helper partagé
 *  fin-de-Round / purge d'horloge). Mute `c`. */
export function dropExpiredGrantedTraits(c: Combatant, expired: { grantedTrait?: TraitInstance }[]): void {
  for (const e of expired) if (e.grantedTrait) removeGrantedTrait(c, e.grantedTrait);
}
