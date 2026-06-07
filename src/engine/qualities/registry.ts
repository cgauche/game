/**
 * Registre des qualités d'objet (arme / armure / artisanat) — source UNIQUE des effets.
 * Ajouter une qualité = AJOUTER UNE ENTRÉE ici (plus de `hasQ` éparpillé). Les helpers
 * de `dispatch.ts` lisent ce registre ; combat.ts/items.ts l'appellent aux moments de jeu.
 */
import type { CharKey, Combatant, HitLocation, Weapon } from '../types';

/** Contexte (lecture seule) passé aux hooks fonctionnels ; un hook RENVOIE des données, ne mute pas. */
export interface QualityCtx {
  weapon?: Weapon;
  attacker?: Combatant;
  defender?: Combatant;
  location?: HitLocation;
  /** d100 du toucher (pour les déclencheurs de Critique). */
  roll?: number;
}

export interface QualityDef {
  /** Label FR canonique (correspond au début de la chaîne sur l'objet, insensible casse). */
  key: string;
  type?: 'Atout' | 'Défaut';
  subType?: 'Arme' | 'Armure' | 'Objet';
  /** Préséance : cette qualité l'emporte sur les `beats` si toutes deux présentes (ex. Imprécise > Précise). */
  beats?: string[];
  // --- Effets « moment » (tous optionnels) ---
  /** +X au Test d'ATTAQUE (Précise +10, LDB Armes l.304). */
  attackMod?: number;
  /** Réduit de X les PA de la cible à la mitigation (Perforante 1, l.316). */
  armourReduction?: number;
  /** +X DR aux Dégâts sur une touche (Pointue +1, l.301). */
  damageDR?: number;
  /** +X DR à la PARADE du défenseur quand l'arme est la sienne (Défensive +1, l.273). */
  defenderParryDR?: number;
  /** +X DR à la parade adverse quand l'arme est celle de l'ATTAQUANT (À Enroulement -1, l.259). */
  attackerParryDR?: number;
  /** Déclenche un Coup Critique si vrai (Empaleuse : jet multiple de 10, l.282). */
  critTrigger?: (ctx: QualityCtx) => boolean;
  /** Arme à distance pouvant tirer au contact (Pistolet, l.297-298). */
  canFireWhileEngaged?: boolean;
  /** Objet insensible aux dégâts/destruction (Incassable, l.310). */
  unbreakable?: boolean;
  /** Arme à feu (Poudre noire / Explosion) — Incident de Tir sur Maladresse (LDB 14 l.56-57). */
  firearm?: boolean;
  /** Dégâts : 'maxUnits' = DR-dégâts pris à max(DR, dé des unités) (Dévastatrice, LDB 62 l.279). */
  dmgDRMode?: 'maxUnits';
  /** Dégâts : ajoute le dé des unités aux Dégâts (Percutante, LDB 62 l.313). */
  damageBonusUnits?: boolean;
  /** Annule les Atouts de Dégâts (Dévastatrice/Percutante) sur cette arme (Inoffensive, LDB 62 l.279/313). */
  negatesDamageAtouts?: boolean;
  /** Effet « à la touche » : Test opposé à une localisation → condition infligée si l'attaquant l'emporte
   *  (Assommante : Tête → F vs Endurance+Résistance → Sonné, LDB Armes l.268). Interprété par combatFlow. */
  onHit?: {
    location?: HitLocation;
    opposed: { attacker: CharKey; defender: CharKey; defenderSkill?: string };
    condition: string;
  };
}

/** Table des qualités. Clé = label FR canonique. */
export const QUALITIES: Record<string, QualityDef> = {
  'Précise': { key: 'Précise', type: 'Atout', subType: 'Arme', attackMod: 10 },
  'Perforante': { key: 'Perforante', type: 'Atout', subType: 'Arme', armourReduction: 1 },
  'Pointue': { key: 'Pointue', type: 'Atout', subType: 'Arme', damageDR: 1 },
  'Empaleuse': { key: 'Empaleuse', type: 'Atout', subType: 'Arme', critTrigger: (c) => (c.roll ?? -1) % 10 === 0 },
  'Défensive': { key: 'Défensive', type: 'Atout', subType: 'Arme', defenderParryDR: 1 },
  'À Enroulement': { key: 'À Enroulement', type: 'Atout', subType: 'Arme', attackerParryDR: -1 },
  'Pistolet': { key: 'Pistolet', type: 'Atout', subType: 'Arme', canFireWhileEngaged: true },
  // Dévastatrice / Percutante : effet de Dégâts via le hook `qualityDamageStep` (DR = max(DR, dé des
  // unités) / + dé des unités) ; peuvent être conférées par la Taille (passées en `extra`). LDB 62 l.279/313.
  'Dévastatrice': { key: 'Dévastatrice', type: 'Atout', subType: 'Arme', dmgDRMode: 'maxUnits' },
  'Percutante': { key: 'Percutante', type: 'Atout', subType: 'Arme', damageBonusUnits: true },
  'Incassable': { key: 'Incassable', type: 'Atout', subType: 'Arme', unbreakable: true },
  // Inoffensive : posé sur une arme usée à +0 (effectiveWeapon). `negatesDamageAtouts` = annule
  // Dévastatrice/Percutante (modélisation existante). Effet canon « PA doublés » non encore modélisé (dette ROADMAP).
  'Inoffensive': { key: 'Inoffensive', type: 'Défaut', subType: 'Arme', negatesDamageAtouts: true },
  // Solide (Indice) — Atout d'OBJET (artisanat, LDB 60 l.64-67) : encaisse N dégâts + sauvegarde 9+.
  // Enregistrée comme exemple canonique d'Indice ; ses HOOKS d'effet seront câblés en Phase A (artisanat).
  'Solide': { key: 'Solide', type: 'Atout', subType: 'Objet' },
  // Assommante : touche à la Tête → Test opposé F vs Endurance+Résistance → Sonné (LDB Armes l.268),
  // déclaré via le hook `onHit` ; le Test (RNG) + addCondition sont interprétés dans combatFlow.
  'Assommante': { key: 'Assommante', type: 'Atout', subType: 'Arme', onHit: { location: 'tete', opposed: { attacker: 'F', defender: 'E', defenderSkill: 'Résistance' }, condition: 'Sonné' } },
  // Recharge (Indice) : Indice = DR à cumuler pour recharger (Test étendu de Projectiles, LDB 63 l.28-29) ;
  // lu via qualityIndice dans recomputeLoadout.
  'Recharge': { key: 'Recharge', type: 'Défaut', subType: 'Arme' },
  // Armes à feu : détectées comme Incident de Tir potentiel (oups.ts).
  'À Poudre noire': { key: 'À Poudre noire', type: 'Défaut', subType: 'Arme', firearm: true },
  'À Explosion': { key: 'À Explosion', type: 'Atout', subType: 'Arme', firearm: true },
};
