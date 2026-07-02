/**
 * Attributs de Domaine (LDB 48 — intros des 8 Couleurs, L14) : l'effet PASSIF dont bénéficie
 * tout Sort « issu du Domaine » (subType du sort — application STRICTE : les Arcanes communs,
 * sans subType, n'en bénéficient pas ; le chapitre 47 ne les rattache pas au Domaine du lanceur).
 *
 * Citations (48 - Magie des Couleurs.md) :
 *  - Bête l.9     : « Chaque fois que vous lancez avec succès un Sort du Domaine de la Bête, vous
 *    pouvez aussi gagner le Trait de créature Peur 1 pour les 1d10 prochains Rounds. »
 *  - Cieux l.87   : « Les Sorts infligeant des Dégâts ignorent les PA des armures en métal, et se
 *    dirigent vers toutes les autres cibles dans les 2 mètres, à l'exception de ceux possédant le
 *    Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre BFM […]. »
 *  - Feu l.157    : « Vous pouvez infliger +1 État Enflammé à quiconque ciblé […] à moins qu'il ne
 *    possède le Talent Magie des Arcanes (Feu). Chaque État Enflammé situé à une distance en
 *    mètres égale à votre BFM ajoute +10 aux tentatives de Focalisation ou d'Incantation… »
 *  - Lumière l.240: « Vous pouvez infliger un État Aveuglé aux cibles […] sauf Talent (Lumière).
 *    Si une cible possède Démoniaque ou Mort-vivant, les Sorts infligent une frappe supplémentaire
 *    de BInt Dégâts qui ignore le Bonus d'Endurance et les PA. »
 *  - Métal l.302  : « Les Sorts infligeant des Dégâts ignorent les PA des armures métalliques, et
 *    infligent un bonus de Dégâts égal au nombre de PA de l'armure métallique portée à la
 *    Localisation frappée. »
 *  - Mort l.400   : « Vous pouvez assigner +1 État Exténué à chaque cible vivante affectée […].
 *    Une cible peut n'avoir qu'un seul État Exténué gagné de cette façon à la fois. »
 *  - Ombres l.482 : « les Sorts lancés depuis le Domaine des Ombres ignorent tous les PA non
 *    magiques. »
 *  - Vie l.574    : « +10 pour Incanter ou Focaliser dans un environnement rural […] les créatures
 *    vivantes ciblées se voient retirer tous les États Exténué et Hémorragique, après que tous les
 *    autres effets ont été appliqués […] les Morts-vivants subissent +BFM Dégâts ignorant BE+PA. »
 *
 * Choix jeu-sans-MJ (documentés) : les « vous pouvez » offensifs (Feu/Lumière/Mort) ne sont
 * appliqués qu'aux cibles ADVERSES (un lanceur rationnel n'enflamme pas ses alliés) ; le +10
 * « environnement rural » de la Vie n'est pas câblé (pas de classification de scène) ; l'armure
 * PLATE d'un statblock (matière inconnue) compte comme NON-métal et NON-magique.
 */
import type { Combatant, HitLocation } from './types';
import type { TriggeredEffect } from './flowCore';
import { RNG, defaultRNG } from './dice';
import { groupMatch } from './groups';
import { bypassedAP } from './armourBypass';
import { hasTraitKey } from './traits/dispatch';
import { findDomainById } from '../data';
import { arcaneDomainOf } from './combatFeatures/dispatch';
import { applyOps } from './ops';

/** Forme MINIMALE d'un sort pour la résolution de son Domaine : le RUNTIME lit le seul `domainId`
 *  (id STABLE, indépendant de la langue) ; absent = Sort sans Domaine (Magie Mineure, Prière…). */
type SpellDomainRef = { domainId?: string | null };

/** Le combattant possède-t-il le Talent « Magie des Arcanes (Domaine) » (exemption des riders) ? */
export function hasArcaneTalent(c: Combatant, domain: string): boolean {
  const arc = arcaneDomainOf(c);
  return arc != null && arc.toLowerCase() === domain.toLowerCase();
}

// PA par matière (métal/cuir), PA magiques et ignorance générale : moteur UNIQUE engine/armourBypass.
export { metalAPAt, magicAPOf } from './armourBypass';

/** Modulation de la MITIGATION d'un Projectile par l'attribut du Domaine (Cieux/Métal/Ombres) — PARAMÈTRE
 *  lu en DONNÉES (`DomainData.missile`) : `bypass` (matière ignorée) + `bonusFromBypass` (Métal : ajoute
 *  les PA ignorés aux Dégâts). `totalAP` = PA effectifs de la cible à la localisation. */
export function domainMissileMods(
  target: Combatant,
  spell: SpellDomainRef,
  loc: HitLocation,
  totalAP: number,
): { apIgnored: number; bonusDamage: number } {
  const missile = findDomainById(spell.domainId)?.missile;
  if (!missile) return { apIgnored: 0, bonusDamage: 0 };
  const ignored = bypassedAP(target, loc, missile.bypass, totalAP);
  return { apIgnored: ignored, bonusDamage: missile.bonusFromBypass ? ignored : 0 };
}

const isUndead = (c: Combatant): boolean =>
  groupMatch('Morts-vivants', c.groups ?? []) || hasTraitKey(c.traits, 'mort-vivant');
const isDaemon = (c: Combatant): boolean =>
  groupMatch('Démons', c.groups ?? []) || hasTraitKey(c.traits, 'demoniaque');
/** « cible vivante » (Mort/Vie) : ni Mort-vivant ni Démon. */
export const isLiving = (c: Combatant): boolean => !isUndead(c) && !isDaemon(c);

/** Riders « à la touche » d'un Sort du Domaine (Feu → En flammes ; Lumière → Aveuglé + frappe ;
 *  Mort → Exténué ; Vie → purge/flétrissure) — DONNÉE éditable (`DomainData.onHitEffects`, `TriggeredEffect[]`).
 *  Le gating (cible adverse / vivante / mort-vivante / résistance par Talent) vit dans les Conditions Flow
 *  `relation`/`has`. Appliqués par le dispatcher `state/triggeredEffects` (qui détient `runSpellFlowLines`). */
export function domainOnHitEffects(spell: SpellDomainRef): TriggeredEffect[] {
  // `DomainData.effects` est typé avec la feuille `Effect` complète (couche state, pour l'éditeur de
  // Flow partagé) ; un rider de Domaine ne porte JAMAIS de transition/dialogue (que des `GameOp`), donc
  // le rétrécir à la feuille `EffectOp` engine-pure est SAIN (signature publique du moteur = pure, #8).
  return (findDomainById(spell.domainId)?.effects ?? []) as TriggeredEffect[];
}

/** Bonus d'incantation lié à l'ENVIRONNEMENT (LDB 48 l.690 — Vie/Ghyran : « Recevez un bonus de +10 aux
 *  lancers pour Incanter ou Focaliser dans un environnement rural ou sauvage »). Lu en DONNÉE
 *  (`DomainData.environmentBonus`) ; `env` = classification de la Scène (`Scene.environment`). 0 si le
 *  Domaine n'a pas d'attribut d'environnement ou si l'environnement courant n'y figure pas. */
export function domainEnvironmentBonus(spell: SpellDomainRef, env: string | null | undefined): number {
  const eb = findDomainById(spell.domainId)?.environmentBonus;
  if (!eb || !env) return 0;
  return eb.environments.includes(env) ? eb.mod : 0;
}

/** Le Sort relève-t-il du Domaine de la SORCELLERIE (LDB 49) ? Marqueur DONNÉE (`DomainData.sorcery`). */
export function isSorceryDomain(spell: SpellDomainRef): boolean {
  return findDomainById(spell.domainId)?.sorcery === true;
}

/** Ops post-incantation appliquées AU LANCEUR après un Sort de Domaine réussi — PARAMÈTRE en données
 *  (`DomainData.casterOps` : `GameOp[]`). Ex. Bête (Ghur) : `grantTrait` Peur 1 pendant 1d10 Rounds.
 *  Exécutées via `applyOps` — source unique, pas de réimplémentation de grantTrait ici. */
export function domainCasterOps(caster: Combatant, spell: SpellDomainRef, rng: RNG = defaultRNG): string[] {
  const ops = findDomainById(spell.domainId)?.casterOps;
  if (!ops?.length) return [];
  return applyOps(caster, ops, { rng, label: 'Attribut de domaine' });
}
