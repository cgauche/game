/** Types du registre des qualités d'objet (arme/armure/artisanat). Le registre `QUALITIES` est
 *  DÉRIVÉ des `defs/<slug>.ts` (gen-registry.mjs) dans `registry.ts`. */
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
  /** Encombrement : délta dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.56/91). */
  encDelta?: number;
  /** +X DR à un Test RATÉ utilisant l'objet (Pratique +1 / Peu Fiable -1, LDB 60 l.59/88). En mêlée
   *  (Test opposé), un jet raté reste comparé : ce DR modifie l'issue ET les Dégâts (via le DR net). */
  testFailDR?: number;
  /** Arme qui endommage l'armure/le bouclier frappé sur une touche réussie (Taille, LDB 63 l.8). */
  damagesArmour?: boolean;
  /** Modificateur aux Tests de Sociabilité du porteur quand l'objet est équipé (Laid -10, LDB 60 l.85). */
  socMod?: number;
}
