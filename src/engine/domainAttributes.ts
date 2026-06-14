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
import { RNG, defaultRNG, d10 } from './dice';
import { bonus, effectiveChar } from './characteristics';
import { addCondition, removeCondition, loseWounds, applyZeroWounds, stacks } from './conditions';
import { grantTrait } from './grantedTraits';
import { groupMatch } from './groups';
import { bypassedAP } from './armourBypass';

/** Domaine d'un sort (« issu du Domaine X ») : le subType d'un Sort d'Arcane, sinon null. */
export function domainOf(spell: { type?: string; subType?: string | null }): string | null {
  if (spell.type && spell.type !== 'Magie des Arcanes') return null;
  return spell.subType ?? null;
}

/** Le combattant possède-t-il le Talent « Magie des Arcanes (Domaine) » (exemption des riders) ? */
export function hasArcaneTalent(c: Combatant, domain: string): boolean {
  const re = new RegExp(`^Magie des Arcanes \\(${domain}\\)$`, 'i');
  return (c.talents ?? []).some((t) => re.test(t.name));
}

// PA par matière (métal/cuir), PA magiques et ignorance générale : moteur UNIQUE engine/armourBypass.
export { metalAPAt, magicAPOf } from './armourBypass';

/** Modulation de la MITIGATION d'un Projectile magique par l'attribut du Domaine (Cieux/Métal/
 *  Ombres). `totalAP` = PA effectifs de la cible à la localisation (pièces + plats + magiques).
 *  Exprimé via le bypass GÉNÉRAL (engine/armourBypass) : Chamon/Azyr = métal, Ulgu = non-magique. */
export function domainMissileMods(
  target: Combatant,
  spell: { type?: string; subType?: string | null },
  loc: HitLocation,
  totalAP: number,
): { apIgnored: number; bonusDamage: number } {
  const dom = domainOf(spell);
  if (dom === 'Métal') {
    const m = bypassedAP(target, loc, 'metal', totalAP); // ignore le métal ET l'ajoute aux Dégâts
    return { apIgnored: m, bonusDamage: m };
  }
  if (dom === 'Cieux') return { apIgnored: bypassedAP(target, loc, 'metal', totalAP), bonusDamage: 0 };
  if (dom === 'Ombres') return { apIgnored: bypassedAP(target, loc, 'nonMagic', totalAP), bonusDamage: 0 };
  return { apIgnored: 0, bonusDamage: 0 };
}

const isUndead = (c: Combatant): boolean =>
  groupMatch('Morts-vivants', c.groups ?? []) || (c.traits ?? []).some((t) => /mort[- ]vivant/i.test(t));
const isDaemon = (c: Combatant): boolean =>
  groupMatch('Démons', c.groups ?? []) || (c.traits ?? []).some((t) => /d[ée]moniaque/i.test(t));
/** « cible vivante » (Mort/Vie) : ni Mort-vivant ni Démon. */
export const isLiving = (c: Combatant): boolean => !isUndead(c) && !isDaemon(c);

/** Riders post-lancement appliqués à UNE cible d'un Sort du Domaine (Feu/Lumière/Mort/Vie).
 *  `hostile` = la cible est d'un camp adverse (les riders offensifs ne s'appliquent qu'à elle).
 *  Mute la cible, retourne le journal. */
export function domainOnHitRiders(
  caster: Combatant,
  target: Combatant,
  spell: { type?: string; subType?: string | null },
  hostile: boolean,
): string[] {
  const dom = domainOf(spell);
  if (!dom) return [];
  const lines: string[] = [];
  if (dom === 'Feu' && hostile && !hasArcaneTalent(target, 'Feu')) {
    addCondition(target, 'En flammes');
    lines.push(`${target.name} s'embrase — +1 En flammes (attribut d'Aqshy).`);
  }
  if (dom === 'Lumière') {
    if (hostile && !hasArcaneTalent(target, 'Lumière')) {
      addCondition(target, 'Aveuglé');
      lines.push(`${target.name} est ébloui — +1 Aveuglé (attribut d'Hysh).`);
    }
    if (isUndead(target) || isDaemon(target)) {
      const extra = Math.max(0, bonus(effectiveChar(caster, 'Int')));
      if (extra > 0) {
        loseWounds(target, extra);
        if (target.wounds.current <= 0) applyZeroWounds(target);
        lines.push(`${target.name} est consumé par la lumière pure : ${extra} Blessures (ignore BE et PA — attribut d'Hysh).`);
      }
    }
  }
  if (dom === 'Mort' && hostile && isLiving(target) && !target.shyishExhausted) {
    addCondition(target, 'Exténué');
    target.shyishExhausted = true; // « un seul État Exténué gagné de cette façon à la fois »
    lines.push(`${target.name} est drainé — +1 Exténué (attribut de Shyish).`);
  }
  if (dom === 'Vie') {
    if (isLiving(target)) {
      const ext = stacks(target, 'Exténué');
      const hem = stacks(target, 'Hémorragique');
      if (ext > 0) removeCondition(target, 'Exténué', ext);
      if (hem > 0) removeCondition(target, 'Hémorragique', hem);
      if (ext > 0 || hem > 0) lines.push(`${target.name} est revigoré par Ghyran : Exténué et Hémorragique retirés (attribut de Vie).`);
    } else if (isUndead(target)) {
      const extra = Math.max(0, bonus(effectiveChar(caster, 'FM')));
      if (extra > 0) {
        loseWounds(target, extra);
        if (target.wounds.current <= 0) applyZeroWounds(target);
        lines.push(`${target.name} se flétrit au contact de la Vie : ${extra} Blessures (ignore BE et PA — attribut de Ghyran).`);
      }
    }
  }
  return lines;
}

/** Bête (l.9) : après un Sort de la Bête lancé avec succès, le LANCEUR gagne Peur 1 pour
 *  1d10 Rounds (« vous pouvez » — toujours appliqué, l'aura n'a pas d'inconvénient). */
export function ghurFearAfterCast(caster: Combatant, spell: { type?: string; subType?: string | null }, rng: RNG = defaultRNG): string[] {
  if (domainOf(spell) !== 'Bête') return [];
  const rounds = d10(rng);
  grantTrait(caster, 'Peur 1');
  caster.activeEffects = caster.activeEffects ?? [];
  caster.activeEffects.push({ label: 'Attribut de Ghur (Peur 1)', bonus: 0, roundsLeft: rounds, grantedTrait: 'Peur 1' });
  return [`${caster.name} irradie la férocité de Ghur — Peur 1 pendant ${rounds} Round(s).`];
}
