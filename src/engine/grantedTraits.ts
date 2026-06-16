/**
 * Traits de créature TEMPORISÉS accordés par un sort (Jalon 2.6 — op `grantTrait`) :
 * Envol (Vol), Effrayant (Peur), Terrifiant (Terreur), Protection (9+), Perturbant,
 * Sang corrosif, Vision dans l'obscurité (Infravision), Vaincre les impies (Haine)…
 *
 * Principe : le trait est POSÉ dans `c.traits` (la chaîne canon — « Peur 2 ») → tous les
 * consommateurs EXISTANTS (dispatch `engine/traits/`, psychologie, IA, déplacement) le voient
 * comme un trait natif ; il est RETIRÉ (une instance) à l'expiration de l'`ActiveEffect`
 * porteur (`grantedTrait`) — fin de Round (`endOfRound`) OU échéance d'horloge (cascade #T3).
 *
 * Les champs psy dérivés au spawn (`causesPeur`/`causesTerreur`/`psychImmune`/`psychTraits`)
 * sont re-synchronisés : les SCALAIRES sont re-dérivés du parse complet de `c.traits` (ils ne
 * viennent que des traits) ; `psychTraits` est ajusté ADDITIVEMENT (on n'y retire que la
 * contribution du trait accordé) car des entrées peuvent venir d'ailleurs (mutations).
 */
import { Combatant } from './types';
import { parsePsychTraits } from './psychology';

/** Re-dérive les scalaires psy depuis les traits courants (Peur/Terreur/Immunité). */
function resyncPsychScalars(c: Combatant): void {
  const p = parsePsychTraits(c.traits ?? []);
  c.causesPeur = p.causesPeur;
  c.causesTerreur = p.causesTerreur;
  c.psychImmune = p.psychImmune;
}

/** Accorde le trait (chaîne canon, ex. « Vol 35 », « Haine (Morts-vivants) ») et synchronise
 *  la psychologie dérivée. Mute `c`. */
export function grantTrait(c: Combatant, trait: string): void {
  c.traits = [...(c.traits ?? []), trait];
  c.liveTraits = [...(c.liveTraits ?? []), trait]; // modificateurs de PROFIL du trait accordé → appliqués en DIRECT (collecteur passif)
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([trait]).psychTraits ?? [];
  if (contrib.length) c.psychTraits = [...(c.psychTraits ?? []), ...contrib];
}

/** Retire UNE instance du trait accordé (jamais un natif en double : on retire la dernière
 *  occurrence — celle posée par le sort) et synchronise la psychologie dérivée. Mute `c`. */
export function removeGrantedTrait(c: Combatant, trait: string): void {
  const i = (c.traits ?? []).lastIndexOf(trait);
  if (i < 0) return;
  c.traits = [...c.traits!.slice(0, i), ...c.traits!.slice(i + 1)];
  const li = (c.liveTraits ?? []).lastIndexOf(trait); // retire l'occurrence accordée des modificateurs de profil en direct
  if (li >= 0) c.liveTraits = [...c.liveTraits!.slice(0, li), ...c.liveTraits!.slice(li + 1)];
  resyncPsychScalars(c);
  const contrib = parsePsychTraits([trait]).psychTraits ?? [];
  for (const pt of contrib) {
    const j = (c.psychTraits ?? []).findIndex((x) => x.type === pt.type && (x.cible ?? '') === (pt.cible ?? ''));
    if (j >= 0) c.psychTraits = [...c.psychTraits!.slice(0, j), ...c.psychTraits!.slice(j + 1)];
  }
  if (c.psychTraits && !c.psychTraits.length) delete c.psychTraits;
}

/** Retire les traits accordés par les effets actifs EXPIRÉS d'une liste (helper partagé
 *  fin-de-Round / purge d'horloge). Mute `c`. */
export function dropExpiredGrantedTraits(c: Combatant, expired: { grantedTrait?: string }[]): void {
  for (const e of expired) if (e.grantedTrait) removeGrantedTrait(c, e.grantedTrait);
}
