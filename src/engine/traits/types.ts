/**
 * Types du registre des Traits de créature (LDB 85 p.338-343). Le registre `TRAITS` est DÉRIVÉ des
 * `defs/<slug>.ts` (gen-registry.mjs) dans `registry.ts` — même patron que `engine/qualities/`.
 *
 * Un TraitDef ne décrit QUE ce que la source écrit ; les hooks sont consommés aux moments de jeu :
 *  - profil dérivé (charMods/movement/bonusWoundsBE) : `spawn.ts` — statblocks d'ÉDITEUR uniquement
 *    (LDB 77 : « utilisez l'un des profils standard et AJOUTEZ les Traits ») ; les profils du
 *    bestiaire (LDB 78-83) sont imprimés FINALS → jamais réappliqués (anti double-compte) ;
 *  - mathématique de combat : `combat.ts` / `combatFlow.ts` ;
 *  - psychologie/IA : `psychology.ts` / `ai.ts` / `combatFlow.ts` ;
 *  - mouvement & vision : `combatFlow.ts` / `sceneRules` (env).
 */
import type { CharKey } from '../types';

export interface TraitDef {
  /** Libellé FR canonique (clé de correspondance, casse/Indice/parenthèse ignorés). */
  key: string;
  // ── Profil dérivé (appliqué au spawn des statblocks d'éditeur, LDB 77) ──
  /** Modificateurs de Caractéristiques (« Élite : +20 en CC, CT et FM »). */
  charMods?: Partial<Record<CharKey, number>>;
  /** Modificateur de Mouvement (Brutal −1, Rapide +1). */
  movement?: number;
  /** Endurant : +Bonus d'Endurance Blessures (avant modificateur de Taille). */
  bonusWoundsBE?: boolean;
  /** Mutation / Corruption mentale (LDB 85) : tirage sur le Tableau des Corruptions au spawn. */
  mutationAtSpawn?: 'physique' | 'mentale';
  // ── Mathématique de combat ──
  /** Démoniaque (Indice+) / Protection (Indice) : 1d10 ≥ Indice après chaque coup reçu → coup ignoré, même critique. */
  wardSave?: boolean;
  /** Démoniaque / Magique / Fabriqué : toutes les attaques de la créature sont MAGIQUES. */
  magicalAttacks?: boolean;
  /** Éthéré : ne peut être blessée que par les Attaques magiques. */
  etherial?: boolean;
  /** Démoniaque : à 0 PB, l'âme retourne aux Royaumes du Chaos (retirée du jeu). */
  banishedAtZero?: boolean;
  /** Champion : s'il gagne un Test opposé en DÉFENSE de mêlée, il cause des Dégâts comme un attaquant. */
  championDefense?: boolean;
  /** Parasité : −10 pour le toucher en Corps à corps. */
  meleeHitPenalty?: number;
  /** Perturbant : −20 à tous les Tests à Bonus d'Endurance mètres (non cumulable). */
  perturbingAura?: boolean;
  /** Résistance à la Magie (Indice) : le DR des Sorts l'affectant est réduit d'Indice. */
  magicResistance?: boolean;
  /** Immunité (Type) : Dégâts du Type ignorés (y compris critiques). */
  damageImmunity?: boolean;
  /** Instable : fin de Round Engagé avec un adversaire d'Avantage supérieur → perd la différence en PB. */
  unstable?: boolean;
  /** Insensible à la douleur : pénalités de Blessures Critiques (hors amputations) ignorées, États subis. */
  painless?: boolean;
  /** Régénération : début de Round, PB>0 → +1d10 PB ; à 0 → 1d10, 8+ → +1 PB ; 10 → +1 Critique soignée. Pas le Feu. */
  regenerates?: boolean;
  // ── Psychologie / IA ──
  /** Belliqueux : Immunité Psychologique tant qu'elle a plus d'Avantages que son adversaire. */
  psychImmuneIfAhead?: boolean;
  /** Fabriqué : pas d'Int/FM/Soc (Tests auto-réussis) → immunité psy effective ; attaques Magiques. */
  mindless?: boolean;
  /** Bestial : défense à l'Esquive seulement ; fuit sous la moitié de ses PB (sauf Territorial → Frénésie) ;
   *  Brisé si touché par le feu. */
  bestial?: boolean;
  /** À sang-froid : peut inverser tous ses Tests de Force Mentale échoués. */
  coldBlooded?: boolean;
  /** Stupide : sans allié non-Stupide adjacent, Test d'Int (+40) au début du Round ou perd Action + Mouvement. */
  stupid?: boolean;
  /** Rage : dépense tous ses Avantages (min 1 → Haine ; min 3 → Frénésie). */
  rage?: boolean;
  /** Territorial : combat jusqu'à la mort dans sa zone, ne poursuit pas (annule la fuite de Bestial). */
  territorial?: boolean;
  // ── Mouvement & vision ──
  /** Vol (Indice) : se déplace en volant jusqu'à Indice mètres, ignore terrains/obstacles/personnages. */
  fly?: boolean;
  /** Bond : Charge/Course → Mouvement ×2, ignore terrains et personnages traversés. */
  leap?: boolean;
  /** Nuée (Essaim, LDB 85) : la créature est un AMAS → rendu par le gabarit « swarm » + ×5 PB / +10 CC
   *  au spawn (cf. applySwarmBuild). Source UNIQUE de la détection d'essaim (plus de regex éparpillée). */
  swarm?: boolean;
  /** Foulée : Mouvement de Course ×1,5. */
  stride?: boolean;
  /** Vision nocturne / Infravision : voit dans l'obscurité (annule la pénalité d'obscurité). */
  seesInDark?: boolean;
  /** Furtif : +Bonus d'Agilité au DR des Tests de Discrétion (consommé par la Surprise). */
  stealthAgBonus?: boolean;
  /** Partie d'effet NON modélisée — verbatim court, journal/inspecteur (rien d'inventé). */
  note?: string;
}
