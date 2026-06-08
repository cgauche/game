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
import type { SpectreProps } from '../spectral/composeSpectre';
import type { SquigProps } from '../squig/composeSquig';
import type { HulkProps } from '../amorphous/composeHulk';
import type { JabberProps } from '../jabberslythe/composeJabber';

export type CreatureBodyPlan =
  | 'biped' | 'quadruped' | 'winged'
  | 'serpentine' | 'arachnid' | 'avian' | 'cephalopod' | 'spectral' | 'squig' | 'amorphous' | 'jabberslythe' // nouveaux squelettes
  | 'monolithic';

/** Surcharges d'apparence propres à CETTE créature (par-dessus les défauts de sa Race).
 *  Réservé aux espèces NON-canoniques qui se replient sur une race partagée via baseSpeciesOf
 *  (Fimir→Ogre, Géant/Liche/Démonette→Humain) : leur config distincte vit ici, pas sur la race. */
export interface CreaturePerso {
  career?: string;
  monster?: MonsterParts;
  sex?: 'M' | 'F';
  parts?: { cheveux?: number; visage?: number };
  colors?: Palette;
  scale?: number;
  gabarit?: string;
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
  /** Race d'apparence (défauts career/monster/sex/parts/colors/scale). Défaut = baseSpeciesOf(name).
   *  À ne préciser que pour forcer une race autre que celle dérivée du nom. */
  race?: string;
  /** Gabarit (carrure) explicite, rare — sinon hérité de la race (ou du perso). */
  gabarit?: string;
  /** Surcharges d'apparence propres à cette créature (espèces NON-canoniques repliées sur une race
   *  partagée : Fimir/Géant/Liche/Démonette). Par-dessus les défauts de la race. */
  perso?: CreaturePerso;
  /** Props de rendu des nouveaux squelettes (un champ par gabarit ; requis si plan correspond). */
  serpent?: SerpentProps; // plan = serpentine
  spider?: SpiderProps; // plan = arachnid
  bird?: BirdProps; // plan = avian
  octopus?: OctopusProps; // plan = cephalopod
  spectre?: SpectreProps; // plan = spectral
  squig?: SquigProps; // plan = squig
  hulk?: HulkProps; // plan = amorphous
  jabber?: JabberProps; // plan = jabberslythe
}
