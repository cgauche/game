/**
 * Dispatcher PUR des capacités de TALENTS (LDB 10) : agrège les champs du registre par porteur
 * (niveau = `times` du talent) et expose des helpers typés consommés par combat.ts / combatFlow /
 * rollFlows / store. Aucune mutation. Même patron que `engine/qualities/dispatch.ts`.
 */
import type { Combatant, Weapon } from '../types';
import { groupMatch } from '../groups';
import { isShieldItem } from '../equipCompare';
import { findTalentById } from '../../data';
import type { CombatFeature, CombatFeatureCtx, CastingKind } from './types';

/** Famille d'incantation d'un Talent par son `id` STABLE (« magie-mineure », « beni ») via sa DONNÉE
 *  (`TalentData.combat.castingKind`), ou undefined. Pour les consommateurs qui ont un id, pas un Combattant. */
export function castingKindOf(talentId: string): CastingKind | undefined {
  return findTalentById(talentId)?.combat?.castingKind;
}

/** Domaine d'Arcane du lanceur (LDB 46) : la spécialisation du talent à `castingKind:'arcane'` (Magie des
 *  Arcanes — Métal, Bêtes…), ou undefined. Source DONNÉE (`combat.castingKind`) — remplace les checks en dur
 *  `talentId === 'magie-des-arcanes'` (exemptions d'armure, domaine d'incantation, Souffle de breathType). */
export function arcaneDomainOf(c: Combatant): string | undefined {
  for (const t of c.talents ?? []) if (findTalentById(t.talentId)?.combat?.castingKind === 'arcane') return t.spec;
  return undefined;
}

/** Capacités de combat présentes sur le combattant, lues de la DONNÉE (`TalentData.combat`) : talents
 *  POSSÉDÉS (niveau = times) + talents ACCORDÉS par un effet actif de sort (op `grantTalent`, niveau 1
 *  tant que l'effet dure — Flambeau de Vertu : Sans peur ; Cœurs ardents : Cœur vaillant…, Jalon 2.6). */
export function featuresOf(c: Combatant): { def: CombatFeature; ctx: CombatFeatureCtx }[] {
  const out: { def: CombatFeature; ctx: CombatFeatureCtx }[] = [];
  for (const t of c.talents ?? []) {
    const def = findTalentById(t.talentId)?.combat;
    if (def) out.push({ def, ctx: { combatant: c, level: t.times ?? 1, spec: t.spec } });
  }
  for (const e of c.activeEffects ?? []) {
    if (!e.grantedTalent) continue;
    const def = findTalentById(e.grantedTalent.talentId)?.combat;
    if (def) out.push({ def, ctx: { combatant: c, level: 1, spec: e.grantedTalent.spec } });
  }
  return out;
}

/** Sans peur (LDB 10 l.859) : `c` ignore la Peur/Terreur que `foe` inspire — talent possédé
 *  (vs l'Ennemi spécifié, par Groupes) ou ACCORDÉ par un sort sans spec (toutes sources). */
export function fearImmuneVs(c: Combatant, foe: Pick<Combatant, 'groups'>): boolean {
  return featuresOf(c).some(
    ({ def, ctx }) => def.fearImmune && (ctx.spec == null || groupMatch(ctx.spec, foe.groups ?? [])),
  );
}

/** Somme des niveaux des capacités vérifiant `pred` (0 si aucune). */
function levelSum(c: Combatant, pred: (d: CombatFeature) => boolean): number {
  return featuresOf(c).reduce((s, { def, ctx }) => s + (pred(def) ? ctx.level : 0), 0);
}

/** Pénalité de main secondaire (LDB 14 l.181 : -20), transformée par les capacités (Ambidextre → -10/0).
 *  Interprète le champ DÉCLARATIF `offHandPenalty:{perLevel,zeroAt}` : -20 +perLevel×niveau, 0 dès `zeroAt`. */
export function offHandPenalty(c: Combatant): number {
  let pen = -20;
  for (const { def, ctx } of featuresOf(c)) {
    if (def.offHandPenalty) {
      const { perLevel, zeroAt } = def.offHandPenalty;
      pen = ctx.level >= zeroAt ? 0 : Math.min(0, pen + perLevel * ctx.level);
    }
  }
  return pen;
}

/** Modes d'attaque conférés par les capacités du combattant (ex. 'dual-wield' via Maniement de deux armes). */
export function attackModesFor(c: Combatant): string[] {
  const out: string[] = [];
  for (const { def } of featuresOf(c)) if (def.attackModes) out.push(...def.attackModes);
  return out;
}

/** Bonus de Dégâts des talents pour CETTE attaque : Coup puissant (mêlée), Tir précis (distance),
 *  Combat déloyal (Bagarre), Charge berserk/Déterminé (en Charge). LDB 10. */
export function talentDamageBonus(c: Combatant, weapon: Weapon, charged: boolean): number {
  const melee = weapon.type === 'melee';
  const brawl = melee && weapon.subType === 'bagarre'; // Groupe « Bagarre » (id)
  return (
    (melee ? levelSum(c, (d) => !!d.meleeDamageBonus) : levelSum(c, (d) => !!d.rangedDamageBonus)) +
    (brawl ? levelSum(c, (d) => !!d.brawlDamageBonus) : 0) +
    (charged && melee ? levelSum(c, (d) => !!d.chargeDamageBonus) : 0)
  );
}

/** Tueur (LDB 10) : Bonus de Force = Bonus d'Endurance de la cible s'il est plus élevé. */
export function isSlayer(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.slayer);
}

/** Robuste (LDB 10) : réduit tous les Dégâts subis de niveau (min 1 Blessure — plancher déjà garanti). */
export function talentDamageReduction(c: Combatant): number {
  return levelSum(c, (d) => !!d.damageReduction);
}

/** Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique. */
export function talentCritExtraWounds(c: Combatant): number {
  return levelSum(c, (d) => !!d.critExtraWounds);
}

/** Tir sûr (LDB 10) : PA de la cible ignorés au tir (niveau). */
export function talentRangedAPIgnore(c: Combatant): number {
  return levelSum(c, (d) => !!d.rangedAPIgnore);
}

/** La pénalité de Localisation visée est-elle annulée ? Frappe assommante (Tête + arme Assommante,
 *  mêlée) / Tir mortel (à distance). LDB 10. */
export function ignoresCalledShotPenalty(c: Combatant, kind: 'melee' | 'ranged', location: string | null | undefined, weaponHasAssommante: boolean): boolean {
  if (kind === 'ranged') return featuresOf(c).some(({ def }) => def.ignoreCalledShotRanged);
  return location === 'tete' && weaponHasAssommante && featuresOf(c).some(({ def }) => def.ignoreCalledShotHead);
}

/** Tireur d'élite (LDB 10) : ignore les modificateurs de Taille de la cible au tir. */
export function ignoresSizeRangedMods(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.ignoreSizeRangedMods);
}

/** Tireur embusqué (LDB 10) : ajuste le modificateur de bande de portée (Longue → 0, Extrême → ÷2). */
export function sniperRangeAdjust(c: Combatant, mod: number): number {
  if (mod >= 0 || !featuresOf(c).some(({ def }) => def.sniper)) return mod;
  if (mod === -10) return 0; // Longue distance : aucune pénalité
  return Math.ceil(mod / 2); // Portée extrême : moitié des pénalités (−30 → −15)
}

/** Combat instinctif (LDB 10) : +10 × niveau à l'Initiative de combat. */
export function talentInitiativeBonus(c: Combatant): number {
  return 10 * levelSum(c, (d) => !!d.initiativeBonus);
}

/** Tir rapide (LDB 10) : pré-emption d'initiative gratuite avec une arme à distance CHARGÉE. */
export function canPreemptRanged(c: Combatant): boolean {
  if (!featuresOf(c).some(({ def }) => def.strikeFirstRanged)) return false;
  return c.weapons.some((w) => w.type === 'ranged') && c.loaded !== false;
}

/** Vigilance (LDB 10) : peut tester Perception (+0) pour ignorer la Surprise. */
export function hasSurpriseSave(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.surpriseSave);
}

/** Rechargement rapide (toutes armes) / Artilleur (Poudre noire) : +DR au Test de rechargement. LDB 10. */
export function reloadDRBonus(c: Combatant, weapon: Weapon | undefined): number {
  const g = weapon?.subType ?? ''; // id de Groupe (poudre-noire / ingenierie / poudre-noire-et-ingenierie)
  const blackpowder = g === 'poudre-noire' || g === 'ingenierie' || g === 'poudre-noire-et-ingenierie';
  return levelSum(c, (d) => d.reloadDR === 'all' || (d.reloadDR === 'blackpowder' && blackpowder));
}

/** Sprinter / Fuite ! (LDB 10) : +1 Mouvement en Course / en Fuite. */
export function runMovementBonus(c: Combatant): number {
  return featuresOf(c).some(({ def }) => def.runBonus) ? 1 : 0;
}
export function fleeMovementBonus(c: Combatant): number {
  return featuresOf(c).some(({ def }) => def.fleeBonus) ? 1 : 0;
}

/** Porte-Bouclier (LDB 10) : +niveau Avantage en défense gagnée au Bouclier. Bouclier = `isShieldItem`
 *  (source UNIQUE du prédicat de bouclier — Atout « Bouclier » ou nom « Bouclier… »), pas de regex dupliquée. */
export function shieldAdvantageLevel(c: Combatant, parryWeapon: Weapon | undefined): number {
  if (!parryWeapon || !isShieldItem(parryWeapon)) return 0;
  return levelSum(c, (d) => !!d.shieldAdvantage);
}

/** Riposte (LDB 10) : contre-attaque en défense gagnée si l'arme de parade est Rapide. */
export function hasRiposte(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.riposte);
}

/** Renversement (LDB 10) : vole TOUS les Avantages adverses au lieu de +1 sur un opposé gagné. */
export function hasStealAdvantage(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.stealAdvantage);
}

/** Maîtrise du combat (LDB 10) : compte pour 1+niveau personnes au calcul du surnombre. */
export function outnumberCountBonus(c: Combatant): number {
  return levelSum(c, (d) => !!d.outnumberCount);
}

/** Mâchoires d'acier (LDB 10) : Test de Résistance pour retirer des États Sonné (1 + DR). */
export function hasStunSave(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.stunSave);
}

/** Cœur vaillant (LDB 10) : récupération du Brisé même Engagé. */
export function hasBraveheart(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.braveheart);
}

/** Endurci (LDB 10) : PB d'Hémorragique ignorés (niveau). */
export function bleedIgnoreLevel(c: Combatant): number {
  return levelSum(c, (d) => !!d.bleedIgnore);
}

/** Résistance à la Magie — TALENT (LDB 10) : −2 × niveau au DR des Sorts affectant le porteur. */
export function talentMagicResistance(c: Combatant): number {
  return 2 * levelSum(c, (d) => !!d.magicResistance2);
}

/** Harmonisation aethyrique (LDB 10) : pas d'Imparfaite sur un double RÉUSSI de Focalisation. */
export function hasFocusHarmony(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.focusNoMiscastOnDouble);
}

/** Effrayant (LDB 10) : Indice de Peur du porteur (niveau), 0 sinon. */
export function talentFearIndice(c: Combatant): number {
  return levelSum(c, (d) => !!d.causesFear);
}

/** +DR de talent à un Test de la Compétence `skillLabel` (Menaçant → Intimidation…). LDB 10. */
export function talentTestDR(c: Combatant, skillLabel: string | undefined): number {
  if (!skillLabel) return 0;
  const low = skillLabel.toLowerCase();
  return featuresOf(c).reduce((s, { def, ctx }) => s + (def.testDR && low.includes(def.testDR.match) ? ctx.level : 0), 0);
}

/** Négociateur (LDB 60 l.12) : un Marchandage gagné réduit le prix de 20 % même sans Succès
 *  Stupéfiant. Lu par merchantFlow à la conclusion (remplace le name-match `=== 'Négociateur'`). */
export function hasBargainBonus(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.bargainBonus);
}

/** Inversion d'un Test RATÉ de `skillLabel` (Sociable → Ragot…) : renvoie le plafond de DR
 *  éventuel (`capDR`), `null` si aucun talent ne s'applique. LDB 10. */
export function talentReverseFailed(c: Combatant, skillLabel: string | undefined): { capDR?: number } | null {
  if (!skillLabel) return null;
  const low = skillLabel.toLowerCase();
  for (const { def } of featuresOf(c)) {
    if (def.reverseFailed && low.includes(def.reverseFailed.match)) return { capDR: def.reverseFailed.capDR };
  }
  return null;
}

/** Costaud (LDB 10) : limite d'Encombrement +2 × niveau. Remplace le check `talentId === 'costaud'`. */
export function talentEncumbranceBonus(c: Combatant): number {
  return 2 * levelSum(c, (d) => !!d.encumbranceBonus);
}

/** Âme pure (LDB 10) : seuil de Corruption relevé de niveau. Remplace le check `talentId === 'ame-pure'`. */
export function talentCorruptionThreshold(c: Combatant): number {
  return levelSum(c, (d) => !!d.corruptionThreshold);
}

/** Chirurgie (LDB 10) : le combattant peut opérer (mode de soin chirurgical). Remplace `talentId === 'chirurgie'`. */
export function hasSurgery(c: Combatant): boolean {
  return featuresOf(c).some(({ def }) => def.surgery);
}
