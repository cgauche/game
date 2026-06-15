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
  /** Taillade (Aux Armes p.89) : si l'arme inflige une Blessure Critique, la cible subit en plus
   *  cet État (Hémorragique). Appliqué par combatFlow au point de résolution du Critique. */
  onCritCondition?: string;
  /** Déstabilisante (Aux Armes p.89) : après une touche, l'attaquant peut dépenser `advantageCost`
   *  Avantages pour un Test opposé (`char` + `skill` des deux côtés) ; s'il l'emporte, la cible subit
   *  `condition` (À Terre). Simplification documentée : déclenché d'office quand l'attaquant a les
   *  Avantages requis — comme Assommante s'applique sans choix (combatFlow). */
  onHitKnockdown?: { advantageCost: number; char: CharKey; skill?: string; condition: string };
  /** Arme d'équipe (Indice) (Aux Armes p.124) : arme de siège exigeant une équipe d'Indice servants.
   *  Notre jeu ne modélise pas d'équipe → toute arme d'équipe est maniée EN SOUS-EFFECTIF (1 servant) :
   *  Indice ≥ 3 → Défaut Imprécise (-1 DR) ; Indice ≥ 4 → Défaut Dangereuse (Maladresse sur 9). Lu par
   *  `attackDRAdjust`/`dangerousNine` ; double aussi le temps de recharge (Recharge ×2). */
  crewedTeam?: boolean;
  /** Salve (Indice) (Aux Armes p.126) : chargeur d'Indice tirs avant rechargement — lu par
   *  `magazineSize` comme un chargeur À Répétition (l'arme ne se recharge qu'à 0). Le « plusieurs
   *  tirs par Round à −10 cumulatif » suppose une économie d'Actions multi-tir (1 Action/tour ici). */
  salvo?: boolean;
  /** Tir de zone (Indice) (Aux Armes p.89) : nuage de projectiles. À bout portant (≤ 2 m) → +Indice
   *  Dégâts sur la cible ; à portée → frappe aussi les Indice créatures les plus proches (≤ Indice m).
   *  Appliqué par combatFlow après la touche (réutilise la géométrie de zone). */
  areaFire?: boolean;
  /** Encombrement : délta dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.56/91). */
  encDelta?: number;
  /** +X DR à un Test RATÉ utilisant l'objet (Pratique +1 / Peu Fiable -1, LDB 60 l.59/88). En mêlée
   *  (Test opposé), un jet raté reste comparé : ce DR modifie l'issue ET les Dégâts (via le DR net). */
  testFailDR?: number;
  /** Arme qui endommage l'armure/le bouclier frappé sur une touche réussie (Taille, LDB 63 l.8). */
  damagesArmour?: boolean;
  /** Modificateur aux Tests de Sociabilité du porteur quand l'objet est équipé (Laid -10, LDB 60 l.85). */
  socMod?: number;
  /** ±X DR au Test d'ATTAQUE avec l'arme, réussi ou non (Imprécise -1, LDB 63 l.19). */
  attackDR?: number;
  /** +X DR à TOUT Test de défense de l'adversaire contre cette arme — Parade ET Esquive (Lente +1, LDB 63 l.26). */
  vsDefenseDR?: number;
  /** Rapide (LDB 62 l.318-321) : pré-emption d'initiative + −10 à la PARADE adverse si l'arme de
   *  parade n'est pas Rapide elle-même (les autres Compétences défendent normalement). */
  fastStrike?: boolean;
  /** Lente (LDB 63 l.25) : le porteur frappe toujours en dernier dans le Round. */
  slowStrike?: boolean;
  /** Dangereuse (LDB 63 l.13-14) : tout Test raté incluant un 9 (dizaines ou unités) = Maladresse. */
  fumbleOn9?: boolean;
  /** Épuisante (LDB 63 l.16-17) : Percutante/Dévastatrice de l'arme actives seulement en Charge. */
  chargeGatedDamageAtouts?: boolean;
  /** À Répétition (Indice) (LDB 62 l.264-265) : chargeur de Indice munitions avant rechargement complet. */
  magazine?: boolean;
  /** Protectrice (Indice) (LDB 62 l.306-307) : Indice PA partout quand on OPPOSE l'attaque avec
   *  l'arme ; Indice ≥ 2 → peut aussi opposer les projectiles en Ligne de Vue. */
  parryAP?: boolean;
  /** Perturbante (LDB 62 l.275-276) : au lieu des Dégâts, repousse d'1 m par DR du Test opposé. */
  pushback?: boolean;
  /** Piège-lame (LDB 62 l.292-294) : Critique en défense vs une lame → piéger/briser au lieu du Coup Critique. */
  bladeTrap?: boolean;
  /** Qualité MAGIQUE (ADE2) : l'arme porte une enchantement — ses attaques comptent comme MAGIQUES
   *  (blesse l'Éthéré, LDB 85 p.339). */
  magic?: boolean;
  // --- Qualités d'ARMURE intrinsèques (LDB 63) ---
  /** Flexible : portable SOUS une couche non Flexible → bénéfices des deux (cumul des PA). */
  layerable?: boolean;
  /** Impénétrable : les Coups Critiques obtenus sur un jet de toucher IMPAIR sont ignorés. */
  critImmuneOdd?: boolean;
  /** Partielle : PA de la pièce ignorés sur un jet de toucher PAIR ou un Coup Critique. */
  apIgnoredOnEven?: boolean;
  /** Points faibles : PA de la pièce ignorés sur un Critique d'une arme Empaleuse. */
  apIgnoredOnImpaleCrit?: boolean;
}
