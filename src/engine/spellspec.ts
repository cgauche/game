/**
 * SpellSpec — spec STRUCTURÉE d'un sort/prière : ce que le sort FAIT, exprimé en
 * `GameOp` (engine/ops), au lieu d'être deviné par regex sur sa description au
 * moment de l'application (POC du Jalon 0.7).
 *
 * Chaque sort/prière a une entrée CURÉE dans le registre `src/data/spellspecs/` (un fichier par
 * famille), recopiée de sa description canon (spells.json / LDB), citée en commentaire. Les 243
 * sorts sont curés — il n'y a plus de repli regex (l'ancien `fallbackSpec` a été supprimé une fois
 * la couverture totale atteinte). La résolution (jet d'incantation, NI, Maladresse, Projectile
 * magique) reste dans engine/magic ; la spec ne décrit que les EFFETS d'un lancement réussi.
 */
import { GameOp, Formula } from './ops';

export interface SpellSpec {
  label: string;
  /** Désambiguïsation des labels en DOUBLE entre familles (« Enchevêtrement » existe en
   *  Sort d'Arcane ET en Miracle de Taal) : absent = la spec vaut pour tout type. */
  type?: string;
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
  // EFFETS « lourds » (invocation, zone persistante, vol de vie, métamorphose) — RETIRÉS de la spec :
  // ils vivent désormais dans la donnée éditable `SpellData.effects` (ops `summon`/`zone`/`lifeSteal`/
  // `polymorph` du Flow), résolues par la couche state. La spec ne garde que la métadonnée de
  // RÉSOLUTION (durée, ZdE, opposition, téléportation…).
  /** OPPOSITION de la cible (jet supplémentaire DANS la modale d'incantation — multijet, jamais
   *  auto-roulé). `resist` : « le Test d'Incantation est opposé par la cible » (Fauche-démon → FM,
   *  Parole de Tzeentch → Intelligence) ; `contact` : un Sort de Portée Contact frappe via un Test
   *  opposé de Corps à corps (Bagarre) en combat (LDB 46 l.174). La cible l'emporte → Sort résisté
   *  (aucune op) ; sinon les ops portent sur la MARGE de DR. Résolu par `resolveOpposed` au point de
   *  résolution du flux `cast` (slot d'opposition), gaté avant `applyCast`. */
  opposed?: {
    kind: 'resist' | 'contact';
    /** `resist` : Caractéristique/Compétence opposée de la cible (FM, Intelligence, Calme…). */
    skill?: string;
    char?: import('./types').CharKey;
  };
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
 *  - le drapeau `curated` reste vrai pour toute entrée du registre.
 */
export function spellSupport(
  ops: GameOp[],
  spec: SpellSpec,
  missile: boolean,
): 'mecanique' | 'partiel' | 'narratif' {
  // Les EFFETS (ops) vivent désormais sur la donnée app-owned (`SpellData.effects`, Flow éditable) ;
  // l'appelant les extrait du Flow (feuilles EffectOp) et les passe ici. La spec ne porte plus que les
  // MÉTADONNÉES de résolution (zone/téléportation/poussée/souffle…) qui qualifient aussi la mécanique.
  // Les ops `summon`/`zone`/`lifeSteal`/`polymorph` (effets « lourds » remontés dans le Flow) sont
  // non-narratives → déjà comptées par le filtre ci-dessous (plus de `spec.persistentZone`).
  const mech = ops.filter((o) => o.op !== 'narrative').length > 0 || missile || spec.zdeRadiusMeters != null
    || spec.breathAttack != null || spec.teleportMeters != null || spec.pushMeters != null;
  const narr = ops.some((o) => o.op === 'narrative') || (!spec.curated && ops.length === 0);
  if (mech && narr) return 'partiel';
  if (mech) return 'mecanique';
  return 'narratif';
}
