import type { BoneId } from '../bones';
import type { View } from '../facing';
import type { StoredPalette, Palette } from '../palette';
import type { GabaritDef } from '../gabarits/types';
import type { MonsterParts } from '../parts/monstrous';

/** Trait de corps d'une race, ancré à un os, éventuellement échelonné à la taille de l'os. */
export interface RaceFeature {
  bone: BoneId;
  svg: string;                  // tokens @peau/@metal… (palette partagée)
  layer?: number;               // ordre peintre (défaut: derrière la part de l'os si négatif)
  scale?: 'bone' | 'fixed';     // 'bone' = suit (thickness,length) de l'os ; 'fixed' = taille fixe (défaut)
  view?: View;                  // limite la feature à une vue (ex. crocs vampire = 'front' seul)
}

/** Identité d'une race bipède : carrure par défaut + peau/tête/traits/posture + défauts d'espèce
 *  (tenue/couleurs/sexe/coiffure/échelle). Dissout PROPS-via-baseSpeciesOf, palettes et postures
 *  d'espèce et la config biped des defs créature. */
export interface RaceDef {
  id: string;                   // 'Humain', 'Ogre', 'Skaven'… (== sortie canonique de baseSpeciesOf)
  gabarit: string;              // id du gabarit par défaut
  gabaritOverride?: Partial<Pick<GabaritDef, 'sl' | 'st' | 'legs' | 'arms' | 'head'>>;
  palette?: StoredPalette;      // peau/cheveux/yeux par défaut (ex-palettes d'espèce)
  paletteF?: StoredPalette;    // variante féminine (sinon palette sert aux deux sexes)
  head?: string;                // id de part de tête monstrueuse (HEADS), sinon visage humain cosmétique
  legs?: string;                // id de jambes monstrueuses (LEGS) remplaçant les 2 cuisses (ex. chèvre)
  armG?: string;                // id de bras monstrueux (ARMS) remplaçant l'épaule gauche
  armD?: string;                // id de bras monstrueux (ARMS) remplaçant l'épaule droite (ex. griffe)
  dropHeadgear?: boolean;       // saute le couvre-chef de tenue (ex. vampire : pas de chapeau de cour)
  features?: RaceFeature[];     // traits de corps (gut, barbe, queue, cornes…)
  pose?: Record<string, number>;// posture de repos (ex-SPECIES_POSE), front + profil
  // Défauts d'espèce (ex-BipedConfig des defs créature) :
  career?: string;              // tenue par défaut
  monster?: MonsterParts;       // parts monstrueuses auto (tête/queue/cornes…) — ex. tête de rat du Skaven
  colors?: Palette;             // surcharges de palette
  sex?: 'M' | 'F';              // sexe forcé
  parts?: { cheveux?: number; visage?: number }; // coiffure/visage épinglés
  scale?: number;               // échelle globale du token en jeu (Géant)
}
