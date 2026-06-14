/**
 * SpellSpec — spec STRUCTURÉE d'un sort/prière : ce que le sort FAIT, exprimé en
 * `GameOp` (engine/ops), au lieu d'être deviné par regex sur sa description au
 * moment de l'application (POC du Jalon 0.7).
 *
 * Deux origines :
 *  - CURÉE : entrée du registre `src/data/spellspecs/` (un fichier par famille),
 *    recopiée de la description canon (spells.json / LDB), citée en commentaire.
 *  - REPLI : `fallbackSpec` synthétise une spec depuis la desc avec les parseurs
 *    historiques (parseHealFormula / parseCharBuffs / parseConditionEffect) —
 *    iso-comportement avec le POC pour les sorts non encore curés.
 *
 * La résolution (jet d'incantation, NI, Maladresse, Projectile magique) reste
 * dans engine/magic ; la spec ne décrit que les EFFETS d'un lancement réussi.
 */
import { GameOp, Formula } from './ops';
import type { ZoneEffect } from './zones';
import {
  SpellLike,
  parseHealFormula,
  parseCharBuffs,
  parseConditionEffect,
  durationRoundsFormula,
} from './magic';

export interface SpellSpec {
  label: string;
  /** Désambiguïsation des labels en DOUBLE entre familles (« Enchevêtrement » existe en
   *  Sort d'Arcane ET en Miracle de Taal) : absent = la spec vaut pour tout type. */
  type?: string;
  /** Ops appliquées à la cible quand le sort est lancé (référent des formules = LANCEUR). */
  ops: GameOp[];
  /** Durée en Rounds si exprimable (littéral / « (Bonus de X) Rounds » du lanceur) ;
   *  null = Instantané ou durée hors échelle tactique (minutes/heures/jours) —
   *  on n'invente PAS un nombre de rounds (LDB). */
  durationRounds: Formula | null;
  /** RAYON de Zone d'Effet en MÈTRES (specs curées dont la zone vit dans la desc —
   *  « dans un rayon de (Bonus de Sociabilité) mètres », Feu de l'âme/Comète…) ;
   *  prioritaire sur le parsing du champ Cible (zdeRadiusTiles). */
  zdeRadiusMeters?: Formula;
  /** La zone ÉPARGNE le lanceur (Poussée repousse « toutes les créatures » autour de SOI ;
   *  Feu de l'âme châtie les ennemis) — il est exclu de la collecte des cibles. */
  zdeExcludesCaster?: boolean;
  /** TÉLÉPORTATION du lanceur (Jalon 2.6 — « vous vous téléportez de BFM mètres ») : après
   *  l'Appliquer, le jeu propose le choix d'une case d'arrivée dans ce rayon (survol des
   *  obstacles, atterrissage libre). `teleportPerSL` : « +BFM par +2 DR ». */
  teleportMeters?: Formula;
  teleportPerSL?: { every: number; metersFormula: Formula };
  /** POUSSÉE (Jalon 2.6 — « repoussées de BFM mètres ») : chaque cible affectée est repoussée
   *  en ligne (direction lanceur→cible) jusqu'à l'obstacle ; la collision est journalisée
   *  (Dégâts = distance restante, arbitrage MJ — rien d'inventé). */
  pushMeters?: Formula;
  /** Sort « Souffle » (LDB 47 p.244) : « Vous effectuez immédiatement une attaque de Souffle,
   *  comme si vous aviez dépensé 2 Avantages pour activer le Trait de créature Souffle. […]
   *  Dégâts égaux à votre Bonus d'Endurance. » — délégué à l'attaque de ZONE du trait
   *  (applyAreaAttack), centrée sur la cible du sort ; Type selon le Domaine du lanceur. */
  breathAttack?: true;
  /** Attaques en chaîne (LDB 47 — L13) : « Si [le Projectile] réduit la cible à 0 Blessure, il
   *  rebondit sur une autre cible dans la portée initiale du Sort, et à une distance en mètres
   *  de la cible précédente égale à votre BFM, infligeant de nouveau les mêmes Dégâts. Il peut
   *  rebondir un nombre maximum de fois égal à votre BFM. » */
  chainOnKill?: { maxBounces: Formula; hopMeters: Formula };
  /** ZONE PERSISTANTE posée par le sort (L11 — Mur de feu : « Quiconque traverse le mur » ;
   *  Grands feux d'U'Zhul : « le feu continue de brûler dans la ZdE pour la durée […] au début
   *  d'un Round ») : forme + effets, durée = celle du sort. Le mur est tracé PERPENDICULAIRE à
   *  l'axe lanceur→cible, centré sur la cible (simplification : pas d'UI de tracé libre). */
  persistentZone?: {
    shape: 'disc' | 'wall';
    /** Disque : rayon en mètres (« ZdE (BFM) mètres »). */
    radiusMeters?: Formula;
    /** Mur : longueur en mètres (« large d'un nombre de mètres égal à votre BFM »). */
    lengthMeters?: Formula;
    /** « Pour chaque +2 DR, vous pouvez allonger la longueur de BFM mètres » (Mur de feu). */
    lengthPerSL?: { every: number; metersFormula: Formula };
    blocksLoS?: boolean;
    onCross?: ZoneEffect;
    perRound?: ZoneEffect;
  };
  /** VOL DE VIE (LDB 48 — Mort : Caresse de Laniph, Vol de vie) : le lanceur récupère une fraction
   *  des Blessures réellement infligées par le Projectile (`num/den`, arrondi). Consommé dans la
   *  branche missile (engine/magic ne connaît pas le lanceur côté soin). */
  lifeSteal?: { num: number; den: number; round: 'floor' | 'ceil' };
  /** Ops appliquées au LANCEUR à l'incantation (en plus de celles sur la cible) : « vous retirez
   *  tout État Exténué dont vous souffrez » (Vol de vie), buffs de soi d'un sort offensif… Référent
   *  des formules = le lanceur. Appliquées une seule fois par lancement (missile ou soutien). */
  casterOps?: GameOp[];
  /** Vrai pour une entrée du registre (sinon : repli regex sur la desc). */
  curated: boolean;
  /** Citation source (desc spells.json, LDB chap/ligne) pour les entrées curées. */
  source?: string;
}

/**
 * Niveau de prise en charge MÉCANIQUE d'un sort (pour l'inventaire et les badges UI) :
 *  - 'mecanique' : tous ses effets connus sont appliqués par le moteur (ops mécaniques
 *    et/ou résolution de Projectile magique) ;
 *  - 'partiel'   : effets mécaniques + un volet journalisé « arbitrage MJ » ;
 *  - 'narratif'  : RIEN n'est appliqué mécaniquement — l'effet est journalisé verbatim
 *    (sorts utilitaires, Traits temporisés, enchantements d'arme…) ;
 *  - le drapeau `curated` distingue une spec relue de la source d'un repli regex.
 */
export function spellSupport(
  spec: SpellSpec,
  missile: boolean,
): 'mecanique' | 'partiel' | 'narratif' {
  const mech = spec.ops.filter((o) => o.op !== 'narrative').length > 0 || missile || spec.zdeRadiusMeters != null
    || spec.persistentZone != null || spec.breathAttack != null || spec.teleportMeters != null || spec.pushMeters != null;
  const narr = spec.ops.some((o) => o.op === 'narrative') || (!spec.curated && spec.ops.length === 0);
  if (mech && narr) return 'partiel';
  if (mech) return 'mecanique';
  return 'narratif';
}

/**
 * Spec de REPLI : reconstruit les effets exactement comme le POC les devinait —
 * priorité exclusive soin > modificateurs de caractéristique > État (premier
 * motif reconnu seulement, comportement historique d'applyCast).
 */
export function fallbackSpec(spell: SpellLike): SpellSpec {
  const ops: GameOp[] = [];
  const heal = parseHealFormula(spell.desc);
  const buffs = parseCharBuffs(spell.desc);
  const cond = parseConditionEffect(spell.desc);
  if (heal != null) {
    ops.push({ op: 'heal', amount: heal });
  } else if (buffs.length) {
    for (const b of buffs) ops.push({ op: 'charMod', char: b.char, mod: b.bonus });
  } else if (cond) {
    if (cond.op === 'remove') ops.push({ op: 'removeCondition', name: cond.name, value: cond.value });
    else ops.push({ op: 'condition', name: cond.name!, value: cond.value });
  }
  // Sinon : effet purement narratif — le log d'incantation suffit (rien d'inventé).
  return {
    label: spell.label,
    ops,
    durationRounds: durationRoundsFormula(spell.duration),
    curated: false,
  };
}
