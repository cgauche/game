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
import type { RaceFeature } from '../races/types';
import type { Palette } from '../palette';
import type { SerpentProps } from '../serpentine/composeSerpent';
import type { SpiderProps } from '../arachnid/composeSpider';
import type { BirdProps } from '../avian/composeBird';
import type { OctopusProps } from '../cephalopod/composeOctopus';
import type { SpectreProps } from '../spectral/composeSpectre';
import type { SquigProps } from '../squig/composeSquig';
import type { HulkProps } from '../amorphous/composeHulk';
import type { JabberProps } from '../jabberslythe/composeJabber';
import type { CrabProps } from '../crustace/composeCrab';
import type { FishProps } from '../fish/composeFish';
import type { TheropodProps } from '../theropode/composeTheropod';

export type CreatureBodyPlan =
  | 'biped' | 'quadruped' | 'winged'
  | 'serpentine' | 'arachnid' | 'avian' | 'cephalopod' | 'spectral' | 'squig' | 'amorphous' | 'jabberslythe' | 'crustace' | 'fish' | 'theropode' // nouveaux squelettes
  | 'engin'; // corps STATIQUE (engin de siège) — pas une créature, mais routé par le même registre (pas de props)

/** Surcharges d'apparence propres à CETTE créature (par-dessus les défauts de sa Race).
 *  Réservé aux espèces NON-canoniques qui se replient sur une race partagée via baseSpeciesOf
 *  (Fimir→Ogre, Géant/Liche/Démonette→Humain) : leur config distincte vit ici, pas sur la race. */
export interface CreaturePerso {
  tenue?: string;
  monster?: MonsterParts;
  sex?: 'M' | 'F';
  parts?: { cheveux?: number; visage?: number };
  colors?: Palette;
  scale?: number;
  gabarit?: string;
  /** Traits cosmétiques ADDITIFS par-dessus la race (cornes du Prophète gris…) — contrairement
   *  à `monster` qui REMPLACE toute la structure de race (tête/membres/features). */
  features?: RaceFeature[];
  /** Tête monstrueuse (clé HEADS) remplaçant CELLE DE LA RACE seulement — queue/fourrure/
   *  features de race conservées (basse-cour : tête de vache/poulet sur corps d'homme-bête).
   *  ≠ monster.tete qui bascule dans l'override complet. */
  head?: string;
  /** Yeux remplacés sur l'orbite du visage (CLÉS du catalogue EYE_OPTIONS : noir, chat, rouge…). */
  eyes?: { G?: string; D?: string };
}

export interface CreatureDef {
  /** Libellé canonique d'AFFICHAGE (p.ex. « Cheval », « Griffon », « Skaven »). N'est PAS la clé. */
  label: string;
  /** id d'espèce STABLE (slug, clé de rig). Défaut dérivé = `slugId(label)`. À préciser SEULEMENT
   *  pour désambiguïser une collision future de slug (garde-fou : test d'unicité au build). */
  id?: string;
  /** Gabarit corporel. `winged` = quadrupède + ailes (mêmes props `quad`). */
  plan: CreatureBodyPlan;
  // (de-POC P5/5d) `aliases`/`aliasOnly`/`matchPriority` RETIRÉS : la résolution de rendu se fait
  // par l'id d'espèce explicite / le record / le lookup EXACT `defById(id)` — plus aucun match flou.
  /** Props de rendu du gabarit quad/ailé (requis si plan = quadruped | winged). */
  quad?: QuadProps;
  /** Race d'apparence (défauts tenue/monster/sex/parts/colors/scale). Défaut = baseSpeciesOf(id).
   *  À ne préciser que pour forcer une race autre que celle dérivée de l'id. */
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
  crab?: CrabProps; // plan = crustace
  fish?: FishProps; // plan = fish
  thero?: TheropodProps; // plan = theropode
}
