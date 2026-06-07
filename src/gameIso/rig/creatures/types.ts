/**
 * Définition AUTO-SUFFISANTE d'une créature — déposée dans `creatures/defs/<Nom>.ts`, elle
 * contient TOUT ce qu'il faut pour router + rendre la créature, sans la re-référencer dans
 * aucun tableau central. Le générateur (`scripts/gen-registry.mjs`) collecte ces fichiers en
 * `_registry.generated.ts` ; `creatures/index.ts` en dérive les tables et matchers.
 *
 * Ajouter une créature = créer UN fichier ici, puis `npm run gen` (auto en dev/build).
 */
import type { QuadProps } from '../quadruped/quadSkeleton';
import type { MonsterParts } from '../parts/monstrous';
import type { Palette } from '../palette';
import type { SerpentProps } from '../serpentine/composeSerpent';
import type { SpiderProps } from '../arachnid/composeSpider';
import type { BirdProps } from '../avian/composeBird';
import type { OctopusProps } from '../cephalopod/composeOctopus';

export type CreatureBodyPlan =
  | 'biped' | 'quadruped' | 'winged'
  | 'serpentine' | 'arachnid' | 'avian' | 'cephalopod' // nouveaux squelettes (limbless/8-pattes/oiseau/tentacules)
  | 'monolithic';

/** Config d'une ESPÈCE bipède monstrueuse/humanoïde (ce qui était éparpillé dans les tables
 *  SPECIES_* d'enemyProfile). Tout optionnel : un bipède « humain nu » n'a besoin de rien. */
export interface BipedConfig {
  career?: string; // tenue par défaut (SPECIES_CAREER) — ex. Skaven, Nu, Mendiant…
  monster?: MonsterParts; // parts monstrueuses auto (SPECIES_AUTO_MONSTER) — tête/queue/…
  sex?: 'M' | 'F'; // sexe forcé (SPECIES_SEX) — ex. Vampire = M
  parts?: { cheveux?: number; visage?: number }; // coiffure/visage épinglés (SPECIES_PARTS)
  colors?: Palette; // surcharges de palette (SPECIES_COLORS)
  /** Échelle GLOBALE du token en jeu (×) — pour les bipèdes hors-norme (Géant) qui doivent
   *  apparaître bien plus grands sans déformer/clipper la boîte 120×150. Défaut 1. */
  scale?: number;
}

export interface CreatureDef {
  /** Nom canonique (clé d'espèce, p.ex. « Cheval », « Griffon », « Skaven »). */
  name: string;
  /** Gabarit corporel. `winged` = quadrupède + ailes (mêmes props `quad`). */
  plan: CreatureBodyPlan;
  /** Synonymes de nom (accents retirés) — routage par nom (limite de mot) dérivé de cette liste. */
  aliases?: string[];
  /** Regex EXACTE de matching (source), alternative aux `aliases` quand il faut un contrôle fin
   *  (préfixe `\bnain`, mot entier `\brat\b`, alternatives…). Reprend les patterns de l'ancien
   *  detectSpecies. Si absent, le matching se fait sur nom+aliases (limite de mot). */
  match?: string;
  /** Priorité de matching (plus BAS = testé en premier). Désambiguïse les chevauchements
   *  de nom : « rat ogre » → Skaven avant Ogre, Minotaure avant Homme-bête, etc. Défaut 100. */
  matchPriority?: number;
  /** Props de rendu du gabarit quad/ailé (requis si plan = quadruped | winged). */
  quad?: QuadProps;
  /** Config d'espèce bipède (si plan = biped). */
  biped?: BipedConfig;
  /** Props de rendu des nouveaux squelettes (un champ par gabarit ; requis si plan correspond). */
  serpent?: SerpentProps; // plan = serpentine
  spider?: SpiderProps; // plan = arachnid
  bird?: BirdProps; // plan = avian
  octopus?: OctopusProps; // plan = cephalopod
}
